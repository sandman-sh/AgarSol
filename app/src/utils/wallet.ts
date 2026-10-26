import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { baseConnection } from './solana';

// Types for Browser Solana Providers
export interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: { toBase58: () => string; toBuffer?: () => Uint8Array };
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string } }>;
  disconnect: () => Promise<void>;
  signTransaction?: (transaction: unknown) => Promise<unknown>;
  signAllTransactions?: (transactions: unknown[]) => Promise<unknown[]>;
  signAndSendTransaction?: (transaction: unknown, options?: unknown) => Promise<{ signature: string }>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
  }
}

export interface WalletState {
  isConnected: boolean;
  walletName: string | null;
  publicKey: string | null;
  balanceSol: number;
}

// Detect installed browser Solana wallet
export function getAvailableWallet(): { name: string; provider: SolanaProvider } | null {
  if (typeof window === 'undefined') return null;

  if (window.phantom?.solana?.isPhantom) {
    return { name: 'Phantom', provider: window.phantom.solana };
  }
  if (window.solana?.isPhantom) {
    return { name: 'Phantom', provider: window.solana };
  }
  if (window.solflare?.isSolflare) {
    return { name: 'Solflare', provider: window.solflare };
  }
  if (window.backpack?.isBackpack) {
    return { name: 'Backpack', provider: window.backpack };
  }
  if (window.solana) {
    return { name: 'Solana Wallet', provider: window.solana };
  }
  return null;
}

// Connect to browser wallet
export async function connectBrowserWallet(): Promise<{
  publicKey: string;
  walletName: string;
  balance: number;
} | null> {
  const detected = getAvailableWallet();
  if (!detected) {
    // If no wallet extension installed, provide helpful prompt
    window.open('https://phantom.app/', '_blank');
    throw new Error('No Solana wallet extension found. Please install Phantom or Solflare!');
  }

  try {
    const res = await detected.provider.connect();
    const pubkeyStr = res.publicKey.toBase58();

    // Fetch live Devnet balance
    let balance = 0;
    try {
      const pubkey = new PublicKey(pubkeyStr);
      const lamports = await baseConnection.getBalance(pubkey);
      balance = lamports / LAMPORTS_PER_SOL;
    } catch {
      // Default to 0 if RPC unavailable
    }

    localStorage.setItem('nomnom_connected_wallet', pubkeyStr);
    return {
      publicKey: pubkeyStr,
      walletName: detected.name,
      balance,
    };
  } catch (err) {
    const e = err as Error;
    if (e.message?.includes('User rejected')) {
      throw new Error('Connection request was rejected in wallet');
    }
    throw e;
  }
}

// Auto-connect if user previously approved
export async function checkExistingWalletConnection(): Promise<{
  publicKey: string;
  walletName: string;
  balance: number;
} | null> {
  const saved = localStorage.getItem('nomnom_connected_wallet');
  if (!saved) return null;
  const detected = getAvailableWallet();
  if (!detected) return null;
  try {
    const res = await detected.provider.connect({ onlyIfTrusted: true });
    const pubkeyStr = res.publicKey.toBase58();
    let balance = 0;
    try {
      const pubkey = new PublicKey(pubkeyStr);
      const lamports = await baseConnection.getBalance(pubkey);
      balance = lamports / LAMPORTS_PER_SOL;
    } catch {
      // Default to 0
    }
    return {
      publicKey: pubkeyStr,
      walletName: detected.name,
      balance,
    };
  } catch {
    return null;
  }
}

// Disconnect
export async function disconnectBrowserWallet(): Promise<void> {
  const detected = getAvailableWallet();
  if (detected?.provider?.disconnect) {
    try {
      await detected.provider.disconnect();
    } catch {
      // Ignore
    }
  }
  localStorage.removeItem('nomnom_connected_wallet');
}

// Custom nickname storage for wallet users
export function getSavedNicknameForWallet(walletPubkey: string): string | null {
  return localStorage.getItem(`nomnom_nick_${walletPubkey}`);
}

export function saveNicknameForWallet(walletPubkey: string, name: string): void {
  localStorage.setItem(`nomnom_nick_${walletPubkey}`, name);
}

// Random Nickname generator for guest players
const GUEST_PREFIXES = ['Nommer', 'Wagmi', 'Blob', 'Degen', 'SolSniper', 'Rollup', 'Pepe', 'Bonk', 'Aura', 'Whale'];
export function generateRandomGuestNick(): string {
  const prefix = GUEST_PREFIXES[Math.floor(Math.random() * GUEST_PREFIXES.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${prefix}_${num}`;
}
