import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url');
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_key');
    // Ensure real credentials exist and ignore sample/dummy placeholders
    if (
      !url ||
      !key ||
      key.includes('sampleKey') ||
      url.includes('your-project') ||
      url.includes('pbbzrdjebqkxlyukwvxn')
    ) {
      return null;
    }
    supabaseInstance = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }
  return supabaseInstance;
}

// Generate cryptographically unguessable room code (e.g. "rm-9xKp2mQt7vL4")
export function generateUnguessableRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  let str = '';
  for (let i = 0; i < array.length; i++) {
    str += chars[array[i] % chars.length];
  }
  return `rm-${str}`;
}

// Multiplayer Player State Broadcast Protocol
export interface RemotePlayerCell {
  id: string;
  x: number;
  y: number;
  mass: number;
  radius: number;
}

export interface RemotePlayerState {
  playerId: string;
  name: string;
  skinId: string;
  wallet: string | null;
  cells: RemotePlayerCell[];
  kills: number;
  lastUpdate: number;
}

export class RoomManager {
  private channel: RealtimeChannel | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;
  private roomId: string = 'global';
  private onRemotePlayersUpdate?: (players: Map<string, RemotePlayerState>) => void;
  private remotePlayers = new Map<string, RemotePlayerState>();
  private cleanupInterval: number | null = null;

  constructor(roomId: string, onUpdate?: (players: Map<string, RemotePlayerState>) => void) {
    this.roomId = roomId;
    this.onRemotePlayersUpdate = onUpdate;
    this.init();
  }

  private handleIncomingState(state: RemotePlayerState) {
    if (state && state.playerId) {
      state.lastUpdate = Date.now();
      this.remotePlayers.set(state.playerId, state);
      if (this.onRemotePlayersUpdate) {
        this.onRemotePlayersUpdate(new Map(this.remotePlayers));
      }
    }
  }

  private handleIncomingElimination(playerId: string) {
    if (playerId) {
      this.remotePlayers.delete(playerId);
      if (this.onRemotePlayersUpdate) {
        this.onRemotePlayersUpdate(new Map(this.remotePlayers));
      }
    }
  }

  private init() {
    // 1. Browser Native BroadcastChannel for ultra-smooth local multi-tab / device sync
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcastChannel = new BroadcastChannel(`nomnom_room_${this.roomId}`);
        this.localBroadcastChannel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'player_state') {
            this.handleIncomingState(payload);
          } else if (type === 'player_eliminated') {
            this.handleIncomingElimination(payload?.playerId);
          }
        };
      }
    } catch {
      // Ignore
    }

    // 2. Supabase Realtime WebSocket for cross-network multiplayer
    try {
      const supabase = getSupabase();
      if (supabase) {
        this.channel = supabase.channel(`room_${this.roomId}`, {
          config: {
            broadcast: { self: false, ack: false },
            presence: { key: `client_${Date.now()}_${Math.random()}` },
          },
        });

        this.channel
          .on('broadcast', { event: 'player_state' }, (payload) => {
            this.handleIncomingState(payload.payload as RemotePlayerState);
          })
          .on('broadcast', { event: 'player_eliminated' }, (payload) => {
            const { playerId } = (payload.payload as { playerId: string }) || {};
            this.handleIncomingElimination(playerId);
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              if (this.channel) {
                try {
                  supabase.removeChannel(this.channel);
                } catch {
                  // Ignore
                }
                this.channel = null;
              }
            }
          });

        // Clean up stale players who disconnected
        this.cleanupInterval = window.setInterval(() => {
          const now = Date.now();
          let changed = false;
          this.remotePlayers.forEach((p, id) => {
            if (now - p.lastUpdate > 4500) {
              this.remotePlayers.delete(id);
              changed = true;
            }
          });
          if (changed && this.onRemotePlayersUpdate) {
            this.onRemotePlayersUpdate(new Map(this.remotePlayers));
          }
        }, 2000);
      }
    } catch {
      // Fallback gracefully if offline
    }
  }

  // Broadcast local player state to all real players in the same room
  broadcastState(state: RemotePlayerState) {
    // Local BroadcastChannel
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({
          type: 'player_state',
          payload: state,
        });
      } catch {
        // Ignore
      }
    }

    // Supabase Realtime WebSocket
    if (this.channel) {
      try {
        this.channel.send({
          type: 'broadcast',
          event: 'player_state',
          payload: state,
        });
      } catch {
        // Ignore
      }
    }
  }

  broadcastElimination(playerId: string) {
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage({
          type: 'player_eliminated',
          payload: { playerId },
        });
      } catch {
        // Ignore
      }
    }

    if (this.channel) {
      try {
        this.channel.send({
          type: 'broadcast',
          event: 'player_eliminated',
          payload: { playerId },
        });
      } catch {
        // Ignore
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.close();
      } catch {
        // Ignore
      }
      this.localBroadcastChannel = null;
    }
    if (this.channel) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          supabase.removeChannel(this.channel);
        }
      } catch {
        // Ignore
      }
      this.channel = null;
    }
    this.remotePlayers.clear();
  }
}

// Generate shareable invite link for unguessable room
export function getRoomInviteUrl(roomId: string): string {
  if (typeof window === 'undefined') return `?room=${roomId}`;
  const origin = window.location.origin;
  return `${origin}/?room=${encodeURIComponent(roomId)}`;
}

