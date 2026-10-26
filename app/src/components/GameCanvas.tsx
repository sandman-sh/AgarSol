import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  EXTRACTION_ZONES,
  SKINS,
  BASE_MASS,
  VIRUS_COUNT,
  VIRUS_RADIUS,
  VIRUS_MASS,
  MIN_SPLIT_MASS,
  MIN_EJECT_MASS,
  EJECTED_PELLET_MASS,
  PELLET_COUNT,
} from '../constants';
import type { SkinDefinition } from '../constants';
import { sounds } from '../utils/audio';
import type { LeaderboardEntry } from './Leaderboard';
import confetti from 'canvas-confetti';
import { TouchControls } from './TouchControls';
import { RoomManager, type RemotePlayerState } from '../utils/supabase';

interface GameCanvasProps {
  isPlaying: boolean;
  isSpectating: boolean;
  playerName: string;
  selectedSkinId: string;
  initialDeposit: number;
  darkMode: boolean;
  showMass: boolean;
  roomId?: string;
  walletAddress?: string | null;
  onUpdateMass: (newMass: number, killsDelta: number) => void;
  onExtractTriggered: () => void;
  onZoneChange?: (inZone: boolean) => void;
  onPlayerEliminated: (killerName: string, finalMass: number, kills: number, survivalSec: number) => void;
  onUpdateLeaderboard: (entries: LeaderboardEntry[]) => void;
  onDispatchErMove: (x: number, y: number, vx: number, vy: number) => void;
  onOpenMenu: () => void;
}

// Authentic Agar.io Cell Structure
interface Cell {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  impulseX: number;
  impulseY: number;
  mass: number;
  radius: number;
  targetRadius: number;
  wobblePhase: number;
  mergeCooldown: number;
}

interface EjectedMass {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  color: string;
  stroke: string;
  shooterId: string;
  createdAt: number;
}

interface Virus {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  feedCount: number;
  wobble: number;
}

interface Pellet {
  id: number;
  x: number;
  y: number;
  color: string;
  value: number;
}

interface Bot {
  id: string;
  name: string;
  skin: SkinDefinition;
  cells: Cell[];
  kills: number;
  aiTimer: number;
  targetX: number;
  targetY: number;
  respawnTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  life: number;
}

const BOT_NAMES = [
  'Wizardio',
  'PhantomWhale',
  'SolSniper',
  'RollupChad',
  'GigaBlob',
  'AuraHunter',
  'ZeroGasKing',
  'BonkArmy',
  'DevnetNommer',
  'WagmiBlob',
  'PepeKing',
  'SolanaWhale',
  'MicroRollup',
  'SvmMaster',
];

const PELLET_COLORS = [
  '#FF3366',
  '#00E676',
  '#00B0FF',
  '#FFD600',
  '#AA00FF',
  '#FF6D00',
  '#1DE9B6',
  '#F50057',
  '#76FF03',
  '#651FFF',
];

// File-scoped constants for spatial hash grid
const CELL_BUCKET_SIZE = 300;
const BUCKETS_X = Math.ceil(WORLD_WIDTH / CELL_BUCKET_SIZE);
const BUCKETS_Y = Math.ceil(WORLD_HEIGHT / CELL_BUCKET_SIZE);

// Authentic Agar.io Radius & Speed Formulas
const getCellRadius = (mass: number): number => Math.max(14, Math.sqrt(mass) * 7.2);
const getCellSpeed = (mass: number): number => Math.max(1.7, Math.min(8.2, 32 / Math.pow(mass, 0.36)));

export const GameCanvas: React.FC<GameCanvasProps> = ({
  isPlaying,
  isSpectating,
  playerName,
  selectedSkinId,
  initialDeposit,
  darkMode,
  showMass,
  roomId = 'global',
  walletAddress = null,
  onUpdateMass,
  onExtractTriggered,
  onZoneChange,
  onPlayerEliminated,
  onUpdateLeaderboard,
  onDispatchErMove,
  onOpenMenu,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inZone, setInZone] = useState(false);
  const localPlayerIdRef = useRef<string>(`p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const roomManagerRef = useRef<RoomManager | null>(null);

  // Store latest props in a ref so the main 60 FPS animation loop NEVER re-mounts or flickers
  const propsRef = useRef({
    isPlaying,
    isSpectating,
    playerName,
    selectedSkinId,
    initialDeposit,
    darkMode,
    showMass,
    roomId,
    walletAddress,
    onUpdateMass,
    onExtractTriggered,
    onZoneChange,
    onPlayerEliminated,
    onUpdateLeaderboard,
    onDispatchErMove,
    onOpenMenu,
  });

  useEffect(() => {
    propsRef.current = {
      isPlaying,
      isSpectating,
      playerName,
      selectedSkinId,
      initialDeposit,
      darkMode,
      showMass,
      roomId,
      walletAddress,
      onUpdateMass,
      onExtractTriggered,
      onZoneChange,
      onPlayerEliminated,
      onUpdateLeaderboard,
      onDispatchErMove,
      onOpenMenu,
    };
  });

  // Supabase Realtime Room Manager Lifecycle
  useEffect(() => {
    const activeRoomId = roomId || 'global';
    const rm = new RoomManager(activeRoomId, (players) => {
      const others = new Map<string, RemotePlayerState>();
      players.forEach((p, id) => {
        if (id !== localPlayerIdRef.current) {
          others.set(id, p);
        }
      });
      stateRef.current.remotePlayers = others;
    });
    roomManagerRef.current = rm;

    return () => {
      rm.destroy();
    };
  }, [roomId]);

  // Persistent Game Engine State
  const stateRef = useRef<{
    playerCells: Cell[];
    bots: Bot[];
    pellets: Pellet[];
    viruses: Virus[];
    ejectedPellets: EjectedMass[];
    particles: Particle[];
    floatingTexts: FloatingText[];
    remotePlayers: Map<string, RemotePlayerState>;
    lastBroadcastTime: number;
    mouse: { x: number; y: number };
    camera: { x: number; y: number; scale: number };
    inExtractionZone: boolean;
    screenShake: number;
    lastErDispatch: number;
    lastLeaderboardSync: number;
    lastHudSyncTime: number;
    wKeyCooldown: number;
    ambientAngle: number;
    gameStartTime: number;
    spawnShieldUntil: number;
    playerKills: number;
    peakMass: number;
    touchSteerPoint: { x: number; y: number } | null;
  }>({
    playerCells: [],
    bots: [],
    pellets: [],
    viruses: [],
    ejectedPellets: [],
    particles: [],
    floatingTexts: [],
    remotePlayers: new Map(),
    lastBroadcastTime: 0,
    mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    camera: { x: 2250, y: 2250, scale: 0.9 },
    inExtractionZone: false,
    screenShake: 0,
    lastErDispatch: 0,
    lastLeaderboardSync: 0,
    lastHudSyncTime: 0,
    wKeyCooldown: 0,
    ambientAngle: 0,
    gameStartTime: Date.now(),
    spawnShieldUntil: 0,
    playerKills: 0,
    peakMass: BASE_MASS,
    touchSteerPoint: null,
  });

  // Spawn or reset player cells
  const resetPlayerCells = useCallback(() => {
    const bonusMass = Math.round(propsRef.current.initialDeposit * 3000);
    const startMass = BASE_MASS + bonusMass;
    const startRadius = getCellRadius(startMass);

    // Pick safe spawn location away from large dangerous predator blobs
    let spawnX = Math.random() * 2000 + 1250;
    let spawnY = Math.random() * 2000 + 1250;
    const dangerousEntities = stateRef.current.bots.flatMap((b) => b.cells).filter((c) => c.mass > 100);
    for (let attempts = 0; attempts < 6; attempts++) {
      const tooClose = dangerousEntities.some(
        (dc) => Math.hypot(dc.x - spawnX, dc.y - spawnY) < dc.radius + 200
      );
      if (!tooClose) break;
      spawnX = Math.random() * 3000 + 750;
      spawnY = Math.random() * 3000 + 750;
    }

    stateRef.current.playerCells = [
      {
        id: `p_${Date.now()}`,
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        impulseX: 0,
        impulseY: 0,
        mass: startMass,
        radius: startRadius,
        targetRadius: startRadius,
        wobblePhase: Math.random() * Math.PI * 2,
        mergeCooldown: 0,
      },
    ];
    stateRef.current.gameStartTime = Date.now();
    stateRef.current.spawnShieldUntil = Date.now() + 3000; // 3-second invulnerability spawn shield
    stateRef.current.playerKills = 0;
    stateRef.current.peakMass = startMass;
  }, []);

  useEffect(() => {
    if (isPlaying) {
      resetPlayerCells();
    }
  }, [isPlaying, resetPlayerCells]);

  // Initial Arena Population (1800 Pellets, 18 Spiked Viruses, 14 Intelligent Bots)
  useEffect(() => {
    // 1. Food Pellets
    const pellets: Pellet[] = [];
    for (let i = 0; i < PELLET_COUNT; i++) {
      pellets.push({
        id: i,
        x: Math.random() * (WORLD_WIDTH - 80) + 40,
        y: Math.random() * (WORLD_HEIGHT - 80) + 40,
        color: PELLET_COLORS[Math.floor(Math.random() * PELLET_COLORS.length)],
        value: Math.random() < 0.25 ? 2 : 1,
      });
    }
    stateRef.current.pellets = pellets;

    // 2. Viruses (Spiked green gears, mass 100)
    const viruses: Virus[] = [];
    for (let i = 0; i < VIRUS_COUNT; i++) {
      viruses.push({
        id: i,
        x: Math.random() * (WORLD_WIDTH - 800) + 400,
        y: Math.random() * (WORLD_HEIGHT - 800) + 400,
        vx: 0,
        vy: 0,
        mass: VIRUS_MASS,
        radius: VIRUS_RADIUS,
        feedCount: 0,
        wobble: 0,
      });
    }
    stateRef.current.viruses = viruses;

    // 3. Dynamic Bots
    const bots: Bot[] = BOT_NAMES.map((name, i) => {
      const bSkin = SKINS[i % SKINS.length];
      const startBotMass = Math.floor(Math.random() * 70) + 25;
      const rad = getCellRadius(startBotMass);
      return {
        id: `bot_${i}`,
        name,
        skin: bSkin,
        kills: Math.floor(Math.random() * 2),
        aiTimer: Math.random() * 2,
        targetX: Math.random() * WORLD_WIDTH,
        targetY: Math.random() * WORLD_HEIGHT,
        respawnTimer: 0,
        cells: [
          {
            id: `bcell_${i}_0`,
            x: Math.random() * (WORLD_WIDTH - 600) + 300,
            y: Math.random() * (WORLD_HEIGHT - 600) + 300,
            vx: 0,
            vy: 0,
            impulseX: 0,
            impulseY: 0,
            mass: startBotMass,
            radius: rad,
            targetRadius: rad,
            wobblePhase: Math.random() * Math.PI * 2,
            mergeCooldown: 0,
          },
        ],
      };
    });
    stateRef.current.bots = bots;
  }, []);

  // Action Triggers for Keyboard & On-Screen Touch Controls
  const triggerCashOut = useCallback(() => {
    if (stateRef.current.inExtractionZone) {
      propsRef.current.onExtractTriggered();
    }
  }, []);

  const triggerSplit = useCallback(() => {
    const { isPlaying: playing, selectedSkinId: skinId } = propsRef.current;
    if (!playing) return;
    const currentSkin = SKINS.find((s) => s.id === skinId) || SKINS[0];
    const { playerCells, mouse, camera } = stateRef.current;
    if (playerCells.length >= 16) return;

    let didSplit = false;
    const newCells: Cell[] = [];
    const worldMouseX = (mouse.x - window.innerWidth / 2) / camera.scale + camera.x;
    const worldMouseY = (mouse.y - window.innerHeight / 2) / camera.scale + camera.y;

    playerCells.forEach((c) => {
      if (c.mass >= MIN_SPLIT_MASS && playerCells.length + newCells.length < 16) {
        didSplit = true;
        const halfMass = Math.floor(c.mass / 2);
        c.mass = halfMass;
        c.targetRadius = getCellRadius(halfMass);
        c.mergeCooldown = Math.max(16, halfMass * 0.02);

        let dx = worldMouseX - c.x;
        let dy = worldMouseY - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        dx /= dist;
        dy /= dist;

        const splitRadius = getCellRadius(halfMass);
        const launchPower = 28;

        newCells.push({
          id: `cell_${Date.now()}_${Math.random()}`,
          x: c.x + dx * (c.radius + 8),
          y: c.y + dy * (c.radius + 8),
          vx: 0,
          vy: 0,
          impulseX: dx * launchPower,
          impulseY: dy * launchPower,
          mass: halfMass,
          radius: splitRadius,
          targetRadius: splitRadius,
          wobblePhase: Math.random() * Math.PI * 2,
          mergeCooldown: Math.max(16, halfMass * 0.02),
        });

        for (let p = 0; p < 8; p++) {
          stateRef.current.particles.push({
            x: c.x,
            y: c.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 4 + 2,
            color: currentSkin.fill,
            alpha: 1,
            life: 0,
            maxLife: 24,
          });
        }
      }
    });

    if (didSplit) {
      sounds.playSplitSound();
      stateRef.current.playerCells = [...playerCells, ...newCells];
      stateRef.current.screenShake = 6;
    }
  }, []);

  const triggerEject = useCallback(() => {
    const { isPlaying: playing, selectedSkinId: skinId } = propsRef.current;
    if (!playing) return;
    const currentSkin = SKINS.find((s) => s.id === skinId) || SKINS[0];
    const now = performance.now();
    if (now - stateRef.current.wKeyCooldown < 65) return;
    stateRef.current.wKeyCooldown = now;

    const { playerCells, mouse, camera, ejectedPellets } = stateRef.current;
    let didEject = false;
    const worldMouseX = (mouse.x - window.innerWidth / 2) / camera.scale + camera.x;
    const worldMouseY = (mouse.y - window.innerHeight / 2) / camera.scale + camera.y;

    playerCells.forEach((c) => {
      if (c.mass >= MIN_EJECT_MASS) {
        didEject = true;
        c.mass -= EJECTED_PELLET_MASS;
        c.targetRadius = getCellRadius(c.mass);

        let dx = worldMouseX - c.x;
        let dy = worldMouseY - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        dx /= dist;
        dy /= dist;

        const ejectSpeed = 22;
        ejectedPellets.push({
          id: Date.now() + Math.random(),
          x: c.x + dx * (c.radius + 14),
          y: c.y + dy * (c.radius + 14),
          vx: dx * ejectSpeed,
          vy: dy * ejectSpeed,
          mass: EJECTED_PELLET_MASS,
          color: currentSkin.fill,
          stroke: currentSkin.stroke,
          shooterId: c.id,
          createdAt: performance.now(),
        });
      }
    });

    if (didEject) {
      sounds.playEjectSound();
      let newTotal = 0;
      playerCells.forEach((c) => (newTotal += c.mass));
      propsRef.current.onUpdateMass(newTotal, 0);
    }
  }, []);

  // Keyboard Event Handlers (Space = Split, W = Eject Mass, E = Cash Out, ESC = Menu)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const { isPlaying: playing, onOpenMenu: openMenu } = propsRef.current;

    if (e.code === 'Escape') {
      openMenu();
      return;
    }

    if (!playing) return;

    if (e.code === 'KeyE') {
      triggerCashOut();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      triggerSplit();
      return;
    }

    if (e.code === 'KeyW') {
      e.preventDefault();
      triggerEject();
      return;
    }
  }, [triggerCashOut, triggerSplit, triggerEject]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    stateRef.current.mouse.x = e.clientX;
    stateRef.current.mouse.y = e.clientY;
  }, []);

  const handleTouch = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      // Find steering touch: ignore touches in the action button corner (bottom-right)
      const isLandscape = window.innerHeight < 520 || (window.innerWidth > window.innerHeight * 1.3 && window.innerHeight < 600);
      const buttonZoneWidth = isLandscape ? 155 : 120;
      const buttonZoneHeight = isLandscape ? 85 : 150;

      let steeringTouch = e.touches[0];
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const inButtonZone = t.clientX > window.innerWidth - buttonZoneWidth && t.clientY > window.innerHeight - buttonZoneHeight;
        if (!inButtonZone) {
          steeringTouch = t;
          break;
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const tx = steeringTouch.clientX - rect.left;
        const ty = steeringTouch.clientY - rect.top;
        stateRef.current.mouse.x = tx;
        stateRef.current.mouse.y = ty;
        stateRef.current.touchSteerPoint = { x: tx, y: ty };
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length === 0) {
      stateRef.current.touchSteerPoint = null;
    }
  }, []);

  // Main 60-144 FPS Engine & Render Loop (Mounts once, never flickers)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = performance.now();

    const checkCanvasSize = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    checkCanvasSize();
    window.addEventListener('resize', checkCanvasSize);
    window.addEventListener('mousemove', handleMouseMove);

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.08);
      lastTime = currentTime;
      const dt60 = dt * 60;

      const {
        isPlaying: activePlaying,
        isSpectating: activeSpectating,
        playerName: activeName,
        selectedSkinId: activeSkinId,
        darkMode: activeDarkMode,
        showMass: activeShowMass,
        initialDeposit: activeStake,
        onUpdateMass: massCallback,
        onPlayerEliminated: eliminatedCallback,
        onUpdateLeaderboard: leaderboardCallback,
        onDispatchErMove: erMoveCallback,
      } = propsRef.current;

      const activeSkin = SKINS.find((s) => s.id === activeSkinId) || SKINS[0];
      const isPlayerShielded = activePlaying && Date.now() < stateRef.current.spawnShieldUntil;
      const shieldRemaining = isPlayerShielded
        ? Math.max(0, (stateRef.current.spawnShieldUntil - Date.now()) / 1000)
        : 0;

      const {
        playerCells,
        bots,
        pellets,
        viruses,
        ejectedPellets,
        particles,
        floatingTexts,
        mouse,
        camera,
      } = stateRef.current;

      // Screen shake decay
      if (stateRef.current.screenShake > 0) {
        stateRef.current.screenShake = Math.max(0, stateRef.current.screenShake - dt * 28);
      }

      // --- 1. Ejected Mass Pellets Physics ---
      const now = performance.now();
      for (let i = ejectedPellets.length - 1; i >= 0; i--) {
        const ep = ejectedPellets[i];
        ep.x += ep.vx * dt60;
        ep.y += ep.vy * dt60;
        ep.vx *= Math.pow(0.88, dt60);
        ep.vy *= Math.pow(0.88, dt60);

        ep.x = Math.max(12, Math.min(WORLD_WIDTH - 12, ep.x));
        ep.y = Math.max(12, Math.min(WORLD_HEIGHT - 12, ep.y));

        let hitVirus = false;
        for (let vIdx = 0; vIdx < viruses.length; vIdx++) {
          const v = viruses[vIdx];
          if (Math.hypot(ep.x - v.x, ep.y - v.y) < v.radius) {
            hitVirus = true;
            v.feedCount += 1;
            v.mass += ep.mass;
            v.radius = Math.min(110, Math.sqrt(v.mass * 50));
            v.wobble = 14;

            if (v.feedCount >= 7) {
              v.feedCount = 0;
              sounds.playVirusExplode();
              const angle = Math.atan2(ep.vy, ep.vx);
              viruses.push({
                id: Date.now() + Math.random(),
                x: v.x + Math.cos(angle) * (v.radius + 35),
                y: v.y + Math.sin(angle) * (v.radius + 35),
                vx: Math.cos(angle) * 22,
                vy: Math.sin(angle) * 22,
                mass: VIRUS_MASS,
                radius: VIRUS_RADIUS,
                feedCount: 0,
                wobble: 18,
              });
            }
            break;
          }
        }

        if (hitVirus) {
          ejectedPellets.splice(i, 1);
          continue;
        }

        // Eat ejected pellets: Player Cells (disabled during initial 3s spawn shield)
        if (activePlaying && !isPlayerShielded) {
          let eaten = false;
          for (let pIdx = 0; pIdx < playerCells.length; pIdx++) {
            const pc = playerCells[pIdx];
            const isOwner = pc.id === ep.shooterId;
            if (isOwner && now - ep.createdAt < 650) continue;

            if (Math.hypot(ep.x - pc.x, ep.y - pc.y) < pc.radius) {
              pc.mass += ep.mass;
              pc.targetRadius = getCellRadius(pc.mass);
              ejectedPellets.splice(i, 1);
              eaten = true;
              break;
            }
          }
          if (eaten) continue;
        }

        // Eat ejected pellets: Bots
        for (let bIdx = 0; bIdx < bots.length; bIdx++) {
          const b = bots[bIdx];
          let eaten = false;
          for (let bcIdx = 0; bcIdx < b.cells.length; bcIdx++) {
            const bc = b.cells[bcIdx];
            if (Math.hypot(ep.x - bc.x, ep.y - bc.y) < bc.radius) {
              bc.mass += ep.mass;
              bc.targetRadius = getCellRadius(bc.mass);
              ejectedPellets.splice(i, 1);
              eaten = true;
              break;
            }
          }
          if (eaten) break;
        }
      }

      // Moving viruses
      viruses.forEach((v) => {
        if (v.wobble > 0) v.wobble = Math.max(0, v.wobble - dt * 10);
        if (Math.abs(v.vx) > 0.1 || Math.abs(v.vy) > 0.1) {
          v.x += v.vx * dt60;
          v.y += v.vy * dt60;
          v.vx *= Math.pow(0.92, dt60);
          v.vy *= Math.pow(0.92, dt60);
        }
      });

      // Spatial Partitioning Grid
      const spatialGrid: number[][] = Array.from({ length: BUCKETS_X * BUCKETS_Y }, () => []);
      for (let pIdx = 0; pIdx < pellets.length; pIdx++) {
        const p = pellets[pIdx];
        const bx = Math.min(BUCKETS_X - 1, Math.max(0, Math.floor(p.x / CELL_BUCKET_SIZE)));
        const by = Math.min(BUCKETS_Y - 1, Math.max(0, Math.floor(p.y / CELL_BUCKET_SIZE)));
        spatialGrid[by * BUCKETS_X + bx].push(pIdx);
      }

      // --- 2. Player Physics & Multicell Management ---
      let playerCenterX = 2250;
      let playerCenterY = 2250;

      if (activePlaying && playerCells.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let totalPlayerMass = 0;

        const worldMouseX = (mouse.x - canvas.width / 2) / camera.scale + camera.x;
        const worldMouseY = (mouse.y - canvas.height / 2) / camera.scale + camera.y;

        for (let i = 0; i < playerCells.length; i++) {
          const c = playerCells[i];

          c.radius += (c.targetRadius - c.radius) * Math.min(1, dt * 12);
          if (c.mergeCooldown > 0) c.mergeCooldown = Math.max(0, c.mergeCooldown - dt);

          if (c.mass > 100) {
            c.mass -= c.mass * 0.0016 * dt;
            c.targetRadius = getCellRadius(c.mass);
          }

          const dx = worldMouseX - c.x;
          const dy = worldMouseY - c.y;
          const dist = Math.hypot(dx, dy) || 1;

          const baseSpeed = getCellSpeed(c.mass);
          const deadzone = 12;

          if (dist > deadzone) {
            const targetVx = (dx / dist) * baseSpeed;
            const targetVy = (dy / dist) * baseSpeed;
            c.vx += (targetVx - c.vx) * Math.min(1, dt * 10);
            c.vy += (targetVy - c.vy) * Math.min(1, dt * 10);
          } else {
            c.vx *= Math.pow(0.85, dt60);
            c.vy *= Math.pow(0.85, dt60);
          }

          c.x += (c.vx + c.impulseX) * dt60;
          c.y += (c.vy + c.impulseY) * dt60;

          c.impulseX *= Math.pow(0.88, dt60);
          c.impulseY *= Math.pow(0.88, dt60);
          if (Math.hypot(c.impulseX, c.impulseY) < 0.1) {
            c.impulseX = 0;
            c.impulseY = 0;
          }

          c.x = Math.max(c.radius, Math.min(WORLD_WIDTH - c.radius, c.x));
          c.y = Math.max(c.radius, Math.min(WORLD_HEIGHT - c.radius, c.y));

          sumX += c.x;
          sumY += c.y;
          totalPlayerMass += c.mass;

          // Eat Pellets via Spatial Hash Grid (disabled during initial 3s spawn shield)
          if (!isPlayerShielded) {
            const minBX = Math.max(0, Math.floor((c.x - c.radius) / CELL_BUCKET_SIZE));
            const maxBX = Math.min(BUCKETS_X - 1, Math.floor((c.x + c.radius) / CELL_BUCKET_SIZE));
            const minBY = Math.max(0, Math.floor((c.y - c.radius) / CELL_BUCKET_SIZE));
            const maxBY = Math.min(BUCKETS_Y - 1, Math.floor((c.y + c.radius) / CELL_BUCKET_SIZE));

            let atePellet = false;
            for (let by = minBY; by <= maxBY; by++) {
              for (let bx = minBX; bx <= maxBX; bx++) {
                const bucket = spatialGrid[by * BUCKETS_X + bx];
                for (let bIdx = 0; bIdx < bucket.length; bIdx++) {
                  const pIdx = bucket[bIdx];
                  const p = pellets[pIdx];
                  if (Math.hypot(c.x - p.x, c.y - p.y) < c.radius) {
                    c.mass += p.value;
                    c.targetRadius = getCellRadius(c.mass);
                    p.x = Math.random() * (WORLD_WIDTH - 80) + 40;
                    p.y = Math.random() * (WORLD_HEIGHT - 80) + 40;
                    p.color = PELLET_COLORS[Math.floor(Math.random() * PELLET_COLORS.length)];
                    atePellet = true;

                    if (particles.length < 100 && Math.random() < 0.35) {
                      particles.push({
                        x: p.x,
                        y: p.y,
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 3,
                        radius: 2,
                        color: p.color,
                        alpha: 1,
                        life: 0,
                        maxLife: 15,
                      });
                    }
                  }
                }
              }
            }

            if (atePellet) {
              sounds.playEatPellet();
            }
          }
        }

        playerCenterX = sumX / playerCells.length;
        playerCenterY = sumY / playerCells.length;

        if (totalPlayerMass > stateRef.current.peakMass) {
          stateRef.current.peakMass = totalPlayerMass;
        }

        // Multicell collisions & recombination
        for (let i = 0; i < playerCells.length; i++) {
          for (let j = i + 1; j < playerCells.length; j++) {
            const c1 = playerCells[i];
            const c2 = playerCells[j];
            const dx = c2.x - c1.x;
            const dy = c2.y - c1.y;
            const dist = Math.hypot(dx, dy) || 1;
            const minDist = c1.radius + c2.radius;

            if (c1.mergeCooldown <= 0 && c2.mergeCooldown <= 0) {
              if (dist < Math.max(c1.radius, c2.radius) * 0.75) {
                c1.mass += c2.mass;
                c1.targetRadius = getCellRadius(c1.mass);
                sounds.playMergeSound();

                for (let p = 0; p < 12; p++) {
                  particles.push({
                    x: (c1.x + c2.x) / 2,
                    y: (c1.y + c2.y) / 2,
                    vx: (Math.random() - 0.5) * 7,
                    vy: (Math.random() - 0.5) * 7,
                    radius: Math.random() * 4 + 2,
                    color: activeSkin.fill,
                    alpha: 1,
                    life: 0,
                    maxLife: 20,
                  });
                }

                playerCells.splice(j, 1);
                j--;
                continue;
              }
            } else if (dist < minDist) {
              const overlap = (minDist - dist) * 0.5;
              const pushX = (dx / dist) * overlap;
              const pushY = (dy / dist) * overlap;
              c1.x -= pushX * 0.35;
              c1.y -= pushY * 0.35;
              c2.x += pushX * 0.35;
              c2.y += pushY * 0.35;
            }
          }
        }

        // Virus Collision
        viruses.forEach((v) => {
          for (let i = playerCells.length - 1; i >= 0; i--) {
            const c = playerCells[i];
            const dist = Math.hypot(c.x - v.x, c.y - v.y);

            if (!isPlayerShielded && c.mass > VIRUS_MASS * 1.15 && dist < c.radius) {
              sounds.playVirusExplode();
              stateRef.current.screenShake = 16;

              const totalPieces = Math.min(10, 16 - playerCells.length + 1);
              const pieceMass = Math.max(12, Math.floor(c.mass / totalPieces));

              c.mass = pieceMass;
              c.targetRadius = getCellRadius(pieceMass);
              c.mergeCooldown = 18;

              for (let p = 1; p < totalPieces; p++) {
                const angle = (p / totalPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
                const launchSpeed = 22 + Math.random() * 8;
                playerCells.push({
                  id: `shatter_${Date.now()}_${p}`,
                  x: c.x,
                  y: c.y,
                  vx: 0,
                  vy: 0,
                  impulseX: Math.cos(angle) * launchSpeed,
                  impulseY: Math.sin(angle) * launchSpeed,
                  mass: pieceMass,
                  radius: getCellRadius(pieceMass),
                  targetRadius: getCellRadius(pieceMass),
                  wobblePhase: Math.random() * Math.PI * 2,
                  mergeCooldown: 18,
                });
              }

              for (let sp = 0; sp < 25; sp++) {
                particles.push({
                  x: v.x,
                  y: v.y,
                  vx: (Math.random() - 0.5) * 12,
                  vy: (Math.random() - 0.5) * 12,
                  radius: Math.random() * 4 + 2,
                  color: '#22c55e',
                  alpha: 1,
                  life: 0,
                  maxLife: 28,
                });
              }

              v.x = Math.random() * (WORLD_WIDTH - 800) + 400;
              v.y = Math.random() * (WORLD_HEIGHT - 800) + 400;
              v.mass = VIRUS_MASS;
              v.radius = VIRUS_RADIUS;
              break;
            }
          }
        });

        // Throttled HUD mass sync (150ms throttle prevents React render thrashing)
        if (currentTime - stateRef.current.lastHudSyncTime > 150) {
          stateRef.current.lastHudSyncTime = currentTime;
          let currentTotalMass = 0;
          playerCells.forEach((c) => (currentTotalMass += c.mass));
          massCallback(currentTotalMass, 0);
        }

        // Throttled ER move dispatch (80ms throttle)
        if (currentTime - stateRef.current.lastErDispatch > 80) {
          stateRef.current.lastErDispatch = currentTime;
          erMoveCallback(playerCenterX, playerCenterY, 0, 0);
        }

        // Throttled Supabase multiplayer broadcast (66ms throttle = 15 Hz)
        if (currentTime - stateRef.current.lastBroadcastTime > 66) {
          stateRef.current.lastBroadcastTime = currentTime;
          roomManagerRef.current?.broadcastState({
            playerId: localPlayerIdRef.current,
            name: activeName || 'You',
            skinId: activeSkinId,
            wallet: propsRef.current.walletAddress || null,
            cells: playerCells.map((c) => ({
              id: c.id,
              x: c.x,
              y: c.y,
              mass: c.mass,
              radius: c.radius,
            })),
            kills: stateRef.current.playerKills,
            lastUpdate: Date.now(),
          });
        }

        // Camera follow
        let totalRad = 0;
        playerCells.forEach((c) => (totalRad += c.radius));
        const avgRad = totalRad / playerCells.length;
        const targetScale = Math.max(0.35, Math.min(1.15, 68 / (avgRad + Math.sqrt(playerCells.length) * 16)));

        camera.scale += (targetScale - camera.scale) * (1 - Math.exp(-8 * dt));
        camera.x += (playerCenterX - camera.x) * (1 - Math.exp(-10 * dt));
        camera.y += (playerCenterY - camera.y) * (1 - Math.exp(-10 * dt));
      } else {
        if (activeSpectating && bots.length > 0) {
          const leader = bots[0].cells[0];
          if (leader) {
            camera.x += (leader.x - camera.x) * (1 - Math.exp(-6 * dt));
            camera.y += (leader.y - camera.y) * (1 - Math.exp(-6 * dt));
            camera.scale += (0.85 - camera.scale) * (1 - Math.exp(-6 * dt));
          }
        } else {
          stateRef.current.ambientAngle += dt * 0.12;
          const ambRadius = 750;
          const targetAmbX = 2250 + Math.cos(stateRef.current.ambientAngle) * ambRadius;
          const targetAmbY = 2250 + Math.sin(stateRef.current.ambientAngle) * ambRadius;
          camera.x += (targetAmbX - camera.x) * (1 - Math.exp(-4 * dt));
          camera.y += (targetAmbY - camera.y) * (1 - Math.exp(-4 * dt));
          camera.scale += (0.85 - camera.scale) * (1 - Math.exp(-4 * dt));
        }
      }

      // --- 3. Autonomous Bot AI ---
      bots.forEach((b) => {
        if (b.cells.length === 0) {
          b.respawnTimer -= dt;
          if (b.respawnTimer <= 0) {
            const bMass = Math.floor(Math.random() * 40) + 25;
            const bRad = getCellRadius(bMass);
            b.cells = [
              {
                id: `bcell_${b.id}_${Date.now()}`,
                x: Math.random() * (WORLD_WIDTH - 600) + 300,
                y: Math.random() * (WORLD_HEIGHT - 600) + 300,
                vx: 0,
                vy: 0,
                impulseX: 0,
                impulseY: 0,
                mass: bMass,
                radius: bRad,
                targetRadius: bRad,
                wobblePhase: Math.random() * Math.PI * 2,
                mergeCooldown: 0,
              },
            ];
          }
          return;
        }

        b.cells.forEach((bCell) => {
          bCell.radius += (bCell.targetRadius - bCell.radius) * Math.min(1, dt * 10);
          if (bCell.mergeCooldown > 0) bCell.mergeCooldown -= dt;

          if (bCell.mass > 120) {
            bCell.mass -= bCell.mass * 0.0015 * dt;
            bCell.targetRadius = getCellRadius(bCell.mass);
          }

          b.aiTimer -= dt;
          if (b.aiTimer <= 0) {
            b.aiTimer = 0.25 + Math.random() * 0.35;

            let threatX = 0;
            let threatY = 0;
            let threatCount = 0;

            if (activePlaying) {
              playerCells.forEach((pc) => {
                if (pc.mass > bCell.mass * 1.15) {
                  const d = Math.hypot(pc.x - bCell.x, pc.y - bCell.y);
                  if (d < 380) {
                    threatX += (bCell.x - pc.x) / (d || 1);
                    threatY += (bCell.y - pc.y) / (d || 1);
                    threatCount++;
                  }
                }
              });
            }

            bots.forEach((otherB) => {
              if (otherB.id === b.id) return;
              otherB.cells.forEach((obc) => {
                if (obc.mass > bCell.mass * 1.15) {
                  const d = Math.hypot(obc.x - bCell.x, obc.y - bCell.y);
                  if (d < 350) {
                    threatX += (bCell.x - obc.x) / (d || 1);
                    threatY += (bCell.y - obc.y) / (d || 1);
                    threatCount++;
                  }
                }
              });
            });

            if (threatCount > 0) {
              b.targetX = bCell.x + threatX * 400;
              b.targetY = bCell.y + threatY * 400;
            } else {
              let preyTarget: { x: number; y: number; mass: number } | null = null;
              let minPreyDist = 420;

              if (activePlaying && !isPlayerShielded) {
                playerCells.forEach((pc) => {
                  if (pc.mass * 1.15 < bCell.mass) {
                    const d = Math.hypot(pc.x - bCell.x, pc.y - bCell.y);
                    if (d < minPreyDist) {
                      minPreyDist = d;
                      preyTarget = { x: pc.x, y: pc.y, mass: pc.mass };
                    }
                  }
                });
              }

              bots.forEach((otherB) => {
                if (otherB.id === b.id) return;
                otherB.cells.forEach((obc) => {
                  if (obc.mass * 1.15 < bCell.mass) {
                    const d = Math.hypot(obc.x - bCell.x, obc.y - bCell.y);
                    if (d < minPreyDist) {
                      minPreyDist = d;
                      preyTarget = { x: obc.x, y: obc.y, mass: obc.mass };
                    }
                  }
                });
              });

              if (preyTarget) {
                b.targetX = (preyTarget as { x: number; y: number; mass: number }).x;
                b.targetY = (preyTarget as { x: number; y: number; mass: number }).y;
              } else {
                b.targetX = Math.max(200, Math.min(WORLD_WIDTH - 200, b.targetX + (Math.random() - 0.5) * 350));
                b.targetY = Math.max(200, Math.min(WORLD_HEIGHT - 200, b.targetY + (Math.random() - 0.5) * 350));
              }
            }
          }

          const bdx = b.targetX - bCell.x;
          const bdy = b.targetY - bCell.y;
          const bdist = Math.hypot(bdx, bdy) || 1;
          const bSpeed = getCellSpeed(bCell.mass);

          bCell.vx += ((bdx / bdist) * bSpeed - bCell.vx) * Math.min(1, dt * 8);
          bCell.vy += ((bdy / bdist) * bSpeed - bCell.vy) * Math.min(1, dt * 8);

          bCell.x += (bCell.vx + bCell.impulseX) * dt60;
          bCell.y += (bCell.vy + bCell.impulseY) * dt60;

          bCell.impulseX *= Math.pow(0.88, dt60);
          bCell.impulseY *= Math.pow(0.88, dt60);

          if (bCell.x < bCell.radius || bCell.x > WORLD_WIDTH - bCell.radius) bCell.vx *= -1;
          if (bCell.y < bCell.radius || bCell.y > WORLD_HEIGHT - bCell.radius) bCell.vy *= -1;

          // Bot eats pellets
          const minBX = Math.max(0, Math.floor((bCell.x - bCell.radius) / CELL_BUCKET_SIZE));
          const maxBX = Math.min(BUCKETS_X - 1, Math.floor((bCell.x + bCell.radius) / CELL_BUCKET_SIZE));
          const minBY = Math.max(0, Math.floor((bCell.y - bCell.radius) / CELL_BUCKET_SIZE));
          const maxBY = Math.min(BUCKETS_Y - 1, Math.floor((bCell.y + bCell.radius) / CELL_BUCKET_SIZE));

          for (let by = minBY; by <= maxBY; by++) {
            for (let bx = minBX; bx <= maxBX; bx++) {
              const bucket = spatialGrid[by * BUCKETS_X + bx];
              for (let bIdx = 0; bIdx < bucket.length; bIdx++) {
                const pIdx = bucket[bIdx];
                const p = pellets[pIdx];
                if (Math.hypot(bCell.x - p.x, bCell.y - p.y) < bCell.radius) {
                  bCell.mass += p.value;
                  bCell.targetRadius = getCellRadius(bCell.mass);
                  p.x = Math.random() * (WORLD_WIDTH - 80) + 40;
                  p.y = Math.random() * (WORLD_HEIGHT - 80) + 40;
                }
              }
            }
          }

          viruses.forEach((v) => {
            if (bCell.mass > VIRUS_MASS * 1.15 && Math.hypot(bCell.x - v.x, bCell.y - v.y) < bCell.radius) {
              sounds.playVirusExplode();
              bCell.mass = Math.floor(bCell.mass / 2);
              bCell.targetRadius = getCellRadius(bCell.mass);
              v.x = Math.random() * (WORLD_WIDTH - 800) + 400;
              v.y = Math.random() * (WORLD_HEIGHT - 800) + 400;
            }
          });
        });

        // Bot vs Player Combat
        if (activePlaying) {
          for (let bIdx = b.cells.length - 1; bIdx >= 0; bIdx--) {
            const bc = b.cells[bIdx];
            for (let pIdx = playerCells.length - 1; pIdx >= 0; pIdx--) {
              const pc = playerCells[pIdx];
              const dist = Math.hypot(pc.x - bc.x, pc.y - bc.y);

              // Spawn shield protection: neither can eat the other, gentle bounce
              if (isPlayerShielded) {
                if (dist < pc.radius + bc.radius) {
                  const angle = Math.atan2(pc.y - bc.y, pc.x - bc.x);
                  const overlap = pc.radius + bc.radius - dist;
                  pc.x += Math.cos(angle) * overlap * 0.15;
                  pc.y += Math.sin(angle) * overlap * 0.15;
                }
                continue;
              }

              if (dist < pc.radius && pc.mass > bc.mass * 1.15) {
                sounds.playKillSound();
                confetti({ particleCount: 60, spread: 80, origin: { x: 0.5, y: 0.5 } });
                stateRef.current.screenShake = 14;
                stateRef.current.playerKills += 1;

                floatingTexts.push({
                  id: Date.now() + Math.random(),
                  text: `+${Math.floor(bc.mass)} MASS`,
                  x: bc.x,
                  y: bc.y,
                  color: '#FFD700',
                  alpha: 1,
                  life: 0,
                });

                for (let d = 0; d < 20; d++) {
                  particles.push({
                    x: bc.x,
                    y: bc.y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    radius: Math.random() * 5 + 3,
                    color: b.skin.fill,
                    alpha: 1,
                    life: 0,
                    maxLife: 26,
                  });
                }

                pc.mass += bc.mass;
                pc.targetRadius = getCellRadius(pc.mass);
                b.cells.splice(bIdx, 1);
                if (b.cells.length === 0) b.respawnTimer = 3;

                let newTotal = 0;
                playerCells.forEach((c) => (newTotal += c.mass));
                massCallback(newTotal, 1);
                break;
              } else if (dist < bc.radius && bc.mass > pc.mass * 1.15) {
                sounds.playKillSound();
                stateRef.current.screenShake = 16;

                for (let d = 0; d < 22; d++) {
                  particles.push({
                    x: pc.x,
                    y: pc.y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    radius: Math.random() * 5 + 3,
                    color: activeSkin.fill,
                    alpha: 1,
                    life: 0,
                    maxLife: 26,
                  });
                }

                bc.mass += pc.mass;
                bc.targetRadius = getCellRadius(bc.mass);
                b.kills += 1;
                playerCells.splice(pIdx, 1);

                if (playerCells.length === 0) {
                  const survivalSec = Math.floor((Date.now() - stateRef.current.gameStartTime) / 1000);
                  eliminatedCallback(b.name, stateRef.current.peakMass, stateRef.current.playerKills, survivalSec);
                } else {
                  let remTotal = 0;
                  playerCells.forEach((c) => (remTotal += c.mass));
                  massCallback(remTotal, 0);
                }
                break;
              }
            }
          }
        }

        // Bot vs Bot Combat
        bots.forEach((otherB) => {
          if (otherB.id === b.id) return;
          for (let b1Idx = b.cells.length - 1; b1Idx >= 0; b1Idx--) {
            const bc1 = b.cells[b1Idx];
            for (let b2Idx = otherB.cells.length - 1; b2Idx >= 0; b2Idx--) {
              const bc2 = otherB.cells[b2Idx];
              const dist = Math.hypot(bc1.x - bc2.x, bc1.y - bc2.y);

              if (dist < bc1.radius && bc1.mass > bc2.mass * 1.15) {
                bc1.mass += bc2.mass;
                bc1.targetRadius = getCellRadius(bc1.mass);
                b.kills += 1;
                otherB.cells.splice(b2Idx, 1);
                if (otherB.cells.length === 0) otherB.respawnTimer = 3;
                break;
              }
            }
          }
        });
      });

      // --- 4. Extraction Zone Checking ---
      if (activePlaying && playerCells.length > 0) {
        let inside = false;
        const mainCell = playerCells[0];
        EXTRACTION_ZONES.forEach((z) => {
          if (Math.hypot(mainCell.x - z.x, mainCell.y - z.y) < z.radius) {
            inside = true;
          }
        });
        if (inside !== stateRef.current.inExtractionZone) {
          stateRef.current.inExtractionZone = inside;
          setInZone(inside);
          propsRef.current.onZoneChange?.(inside);
          if (inside) sounds.playCashOutSound();
        }
      }

      // --- 4b. Remote Real Players Combat & Eating ---
      if (activePlaying && playerCells.length > 0) {
        stateRef.current.remotePlayers.forEach((rp) => {
          rp.cells.forEach((rc) => {
            const rRadius = rc.radius || getCellRadius(rc.mass);
            for (let pIdx = playerCells.length - 1; pIdx >= 0; pIdx--) {
              const pc = playerCells[pIdx];
              const dist = Math.hypot(pc.x - rc.x, pc.y - rc.y);

              // Spawn shield protection: neither can eat the other, gentle bounce
              if (isPlayerShielded) {
                if (dist < pc.radius + rRadius) {
                  const angle = Math.atan2(pc.y - rc.y, pc.x - rc.x);
                  const overlap = pc.radius + rRadius - dist;
                  pc.x += Math.cos(angle) * overlap * 0.15;
                  pc.y += Math.sin(angle) * overlap * 0.15;
                }
                continue;
              }

              // Local player cell eats remote player cell
              if (dist < pc.radius && pc.mass > rc.mass * 1.15) {
                sounds.playKillSound();
                confetti({ particleCount: 50, spread: 70, origin: { x: 0.5, y: 0.5 } });
                stateRef.current.screenShake = 12;
                stateRef.current.playerKills += 1;
                pc.mass += Math.round(rc.mass * 0.95);
                pc.targetRadius = getCellRadius(pc.mass);

                floatingTexts.push({
                  id: Date.now() + Math.random(),
                  text: `+${Math.floor(rc.mass)} MASS (${rp.name})`,
                  x: rc.x,
                  y: rc.y,
                  color: '#00E676',
                  alpha: 1,
                  life: 0,
                });

                roomManagerRef.current?.broadcastElimination(rp.playerId);
                let newTotal = 0;
                playerCells.forEach((c) => (newTotal += c.mass));
                massCallback(newTotal, 1);
                break;
              }
              // Remote player cell eats local player cell
              else if (dist < rRadius && rc.mass > pc.mass * 1.15) {
                sounds.playKillSound();
                stateRef.current.screenShake = 16;
                playerCells.splice(pIdx, 1);

                if (playerCells.length === 0) {
                  const survivalSec = Math.floor((Date.now() - stateRef.current.gameStartTime) / 1000);
                  eliminatedCallback(rp.name, stateRef.current.peakMass, stateRef.current.playerKills, survivalSec);
                } else {
                  let remTotal = 0;
                  playerCells.forEach((c) => (remTotal += c.mass));
                  massCallback(remTotal, 0);
                }
                break;
              }
            }
          });
        });
      }

      // --- 5. RENDER SCENE ---
      const shakeX = (Math.random() - 0.5) * stateRef.current.screenShake;
      const shakeY = (Math.random() - 0.5) * stateRef.current.screenShake;

      ctx.fillStyle = activeDarkMode ? '#0f172a' : '#F2FBFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
      ctx.scale(camera.scale, camera.scale);
      ctx.translate(-camera.x, -camera.y);

      // Graph Grid
      const gridSize = 50;
      const viewLeft = camera.x - canvas.width / (2 * camera.scale);
      const viewRight = camera.x + canvas.width / (2 * camera.scale);
      const viewTop = camera.y - canvas.height / (2 * camera.scale);
      const viewBottom = camera.y + canvas.height / (2 * camera.scale);

      const startX = Math.floor(viewLeft / gridSize) * gridSize;
      const startY = Math.floor(viewTop / gridSize) * gridSize;

      ctx.strokeStyle = activeDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#C9D7DF';
      ctx.lineWidth = 1;

      for (let x = startX; x <= viewRight; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, viewTop);
        ctx.lineTo(x, viewBottom);
        ctx.stroke();
      }
      for (let y = startY; y <= viewBottom; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(viewLeft, y);
        ctx.lineTo(viewRight, y);
        ctx.stroke();
      }

      // World Boundary
      ctx.strokeStyle = activeDarkMode ? 'rgba(239, 68, 68, 0.7)' : '#3B82F6';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Extraction Zones
      EXTRACTION_ZONES.forEach((z) => {
        const pulse = Math.sin(currentTime * 0.003) * 10;
        const grad = ctx.createRadialGradient(z.x, z.y, 20, z.x, z.y, z.radius + pulse);
        grad.addColorStop(0, 'rgba(153, 69, 255, 0.45)');
        grad.addColorStop(0.7, 'rgba(0, 230, 118, 0.25)');
        grad.addColorStop(1, 'rgba(0, 230, 118, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius + pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#00E676';
        ctx.font = '700 16px Ubuntu, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(z.name.toUpperCase(), z.x, z.y - 12);
        ctx.font = '700 12px JetBrains Mono, monospace';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('⚡ EXTRACTION PORTAL [E]', z.x, z.y + 12);
      });

      // Food Pellets
      pellets.forEach((p) => {
        if (p.x < viewLeft - 10 || p.x > viewRight + 10 || p.y < viewTop - 10 || p.y > viewBottom + 10) return;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.value === 2 ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ejected Mass Pellets
      ejectedPellets.forEach((ep) => {
        ctx.fillStyle = ep.color;
        ctx.strokeStyle = ep.stroke;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Render Organic Cell Helper
      const renderOrganicCell = (
        c: Cell,
        cellSkin: SkinDefinition,
        label: string,
        isPlayer: boolean
      ) => {
        if (
          c.x + c.radius < viewLeft ||
          c.x - c.radius > viewRight ||
          c.y + c.radius < viewTop ||
          c.y - c.radius > viewBottom
        ) {
          return;
        }

        ctx.save();
        const numPoints = 28;
        const pts: { x: number; y: number }[] = [];
        const time = currentTime * 0.003 + c.wobblePhase;

        const moveSpeed = Math.hypot(c.vx, c.vy);
        const stretchAngle = Math.atan2(c.vy, c.vx);
        const stretchAmount = Math.min(0.12, moveSpeed * 0.015);

        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const wobble = Math.sin(time * 3 + i * 2) * (c.radius * 0.032);
          const r = c.radius + wobble;

          const dAngle = angle - stretchAngle;
          const stretch = Math.cos(dAngle) * stretchAmount * c.radius;

          pts.push({
            x: c.x + Math.cos(angle) * (r + stretch),
            y: c.y + Math.sin(angle) * (r - stretch * 0.5),
          });
        }

        ctx.beginPath();
        ctx.moveTo((pts[0].x + pts[numPoints - 1].x) / 2, (pts[0].y + pts[numPoints - 1].y) / 2);
        for (let i = 0; i < numPoints; i++) {
          const next = pts[(i + 1) % numPoints];
          const midX = (pts[i].x + next.x) / 2;
          const midY = (pts[i].y + next.y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(
          c.x - c.radius * 0.3,
          c.y - c.radius * 0.35,
          c.radius * 0.1,
          c.x,
          c.y,
          c.radius
        );
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.25, cellSkin.fill);
        grad.addColorStop(1, cellSkin.stroke);

        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = cellSkin.stroke;
        ctx.lineWidth = Math.max(3, c.radius * 0.07);
        ctx.stroke();

        if (c.radius > 20) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.beginPath();
          ctx.ellipse(
            c.x - c.radius * 0.2,
            c.y - c.radius * 0.3,
            c.radius * 0.35,
            c.radius * 0.18,
            -Math.PI / 6,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        if (c.radius > 24) {
          ctx.font = `${Math.floor(c.radius * 0.38)}px Ubuntu, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillText(cellSkin.emblem, c.x, c.y - c.radius * 0.14);
        }

        const fontSize = Math.max(12, Math.floor(c.radius * 0.26));
        ctx.font = `700 ${fontSize}px Ubuntu, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(label, c.x, c.y + (c.radius > 24 ? c.radius * 0.18 : 0));

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, c.x, c.y + (c.radius > 24 ? c.radius * 0.18 : 0));

        if (activeShowMass && c.radius > 26) {
          const massText = `${Math.floor(c.mass)}`;
          ctx.font = `700 ${Math.max(10, Math.floor(fontSize * 0.72))}px JetBrains Mono, monospace`;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeText(massText, c.x, c.y + c.radius * 0.44);

          ctx.fillStyle = isPlayer ? '#FFD700' : 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(massText, c.x, c.y + c.radius * 0.44);
        }

        // Spawn Shield Visual Forcefield & Countdown Timer
        if (isPlayer && isPlayerShielded) {
          const pulse = Math.sin(currentTime * 0.008) * 0.06 + 1.0;
          const shieldRadius = c.radius * 1.25 * pulse;

          // Outer energy field glow
          ctx.beginPath();
          ctx.arc(c.x, c.y, shieldRadius, 0, Math.PI * 2);
          ctx.strokeStyle = '#00F5FF';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#00F5FF';
          ctx.shadowBlur = 18;
          ctx.stroke();

          // Translucent protective field fill
          ctx.fillStyle = 'rgba(0, 245, 255, 0.08)';
          ctx.fill();

          // Rotating dashed energy ring
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius * 1.15, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 8;
          ctx.setLineDash([8, 6]);
          ctx.lineDashOffset = -currentTime * 0.06;
          ctx.stroke();
          ctx.setLineDash([]);

          // Floating badge indicator above cell
          const shieldBadgeY = c.y - shieldRadius - 16;
          const badgeText = `🛡️ SHIELD ${shieldRemaining.toFixed(1)}s`;
          ctx.font = '700 12px Ubuntu, sans-serif';
          const textMetrics = ctx.measureText(badgeText);
          const badgeWidth = textMetrics.width + 16;

          ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
          ctx.strokeStyle = '#00F5FF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(c.x - badgeWidth / 2, shieldBadgeY - 10, badgeWidth, 20, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#00F5FF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, c.x, shieldBadgeY);
        }

        ctx.restore();
      };

      // 1. Small cells under viruses
      bots.forEach((b) => {
        b.cells.forEach((c) => {
          if (c.mass <= VIRUS_MASS) renderOrganicCell(c, b.skin, b.name, false);
        });
      });
      if (activePlaying) {
        playerCells.forEach((c) => {
          if (c.mass <= VIRUS_MASS) renderOrganicCell(c, activeSkin, activeName || 'You', true);
        });
      }
      // Remote Real Players (under viruses)
      stateRef.current.remotePlayers.forEach((rp) => {
        const rpSkin = SKINS.find((s) => s.id === rp.skinId) || SKINS[1];
        rp.cells.forEach((rc) => {
          if (rc.mass <= VIRUS_MASS) {
            renderOrganicCell(
              {
                id: rc.id,
                x: rc.x,
                y: rc.y,
                vx: 0,
                vy: 0,
                impulseX: 0,
                impulseY: 0,
                mass: rc.mass,
                radius: rc.radius || getCellRadius(rc.mass),
                targetRadius: rc.radius || getCellRadius(rc.mass),
                wobblePhase: 0,
                mergeCooldown: 0,
              },
              rpSkin,
              rp.name,
              false
            );
          }
        });
      });

      // 2. Viruses
      viruses.forEach((v) => {
        if (v.x < viewLeft - 150 || v.x > viewRight + 150 || v.y < viewTop - 150 || v.y > viewBottom + 150) return;
        ctx.save();
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 6;

        ctx.beginPath();
        const spikes = 24;
        const outerRad = v.radius + (v.wobble || 0);
        const innerRad = v.radius - 10 + (v.wobble || 0);

        for (let s = 0; s < spikes * 2; s++) {
          const rad = s % 2 === 0 ? outerRad : innerRad;
          const a = (s / (spikes * 2)) * Math.PI * 2;
          const sx = v.x + Math.cos(a) * rad;
          const sy = v.y + Math.sin(a) * rad;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // 3. Large cells above viruses
      bots.forEach((b) => {
        b.cells.forEach((c) => {
          if (c.mass > VIRUS_MASS) renderOrganicCell(c, b.skin, b.name, false);
        });
      });
      if (activePlaying) {
        playerCells.forEach((c) => {
          if (c.mass > VIRUS_MASS) renderOrganicCell(c, activeSkin, activeName || 'You', true);
        });
      }
      // Remote Real Players (above viruses)
      stateRef.current.remotePlayers.forEach((rp) => {
        const rpSkin = SKINS.find((s) => s.id === rp.skinId) || SKINS[1];
        rp.cells.forEach((rc) => {
          if (rc.mass > VIRUS_MASS) {
            renderOrganicCell(
              {
                id: rc.id,
                x: rc.x,
                y: rc.y,
                vx: 0,
                vy: 0,
                impulseX: 0,
                impulseY: 0,
                mass: rc.mass,
                radius: rc.radius || getCellRadius(rc.mass),
                targetRadius: rc.radius || getCellRadius(rc.mass),
                wobblePhase: 0,
                mergeCooldown: 0,
              },
              rpSkin,
              rp.name,
              false
            );
          }
        });
      });

      // 4. Particles
      for (let pIdx = particles.length - 1; pIdx >= 0; pIdx--) {
        const p = particles[pIdx];
        p.life += dt60;
        p.x += p.vx * dt60;
        p.y += p.vy * dt60;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife) {
          particles.splice(pIdx, 1);
        }
      }

      // 5. Floating Score Texts
      for (let tIdx = floatingTexts.length - 1; tIdx >= 0; tIdx--) {
        const ft = floatingTexts[tIdx];
        ft.life += dt60;
        ft.y -= 1.2 * dt60;
        ft.alpha = Math.max(0, 1 - ft.life / 35);

        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = '700 16px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();

        if (ft.life >= 35) {
          floatingTexts.splice(tIdx, 1);
        }
      }

      // Visual Touch Steering Indicator (drawn under thumb during mobile play)
      if (activePlaying && stateRef.current.touchSteerPoint) {
        const tp = stateRef.current.touchSteerPoint;
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
        ctx.fillStyle = 'rgba(0, 230, 118, 0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00E676';
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      // --- 6. Flat Square Minimap (Adaptive: Top-Right in Tilt/Landscape Mode, Bottom-Right on Desktop) ---
      const isLandscapeMobile = canvas.height < 520 || (canvas.width > canvas.height * 1.3 && canvas.height < 600);
      const isPortraitMobile = !isLandscapeMobile && canvas.width < 640;

      let mapSize = 136;
      let mapX = canvas.width - mapSize - 20;
      let mapY = canvas.height - mapSize - 20;

      if (isLandscapeMobile) {
        // Landscape Tilt Mode: compact 84px minimap in Top-Right
        mapSize = 84;
        mapX = canvas.width - mapSize - 12;
        mapY = 12;
      } else if (isPortraitMobile) {
        mapSize = 94;
        mapX = canvas.width - mapSize - 12;
        mapY = canvas.height - mapSize - 12;
      }

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(mapX, mapY, mapSize, mapSize);
      ctx.fillRect(mapX, mapY, mapSize, mapSize);

      // Portals
      EXTRACTION_ZONES.forEach((z) => {
        const mx = mapX + (z.x / WORLD_WIDTH) * mapSize;
        const my = mapY + (z.y / WORLD_HEIGHT) * mapSize;
        ctx.fillStyle = 'rgba(153, 69, 255, 0.9)';
        ctx.fillRect(mx - 3, my - 3, 6, 6);
      });

      // Viruses
      viruses.forEach((v) => {
        const vx = mapX + (v.x / WORLD_WIDTH) * mapSize;
        const vy = mapY + (v.y / WORLD_HEIGHT) * mapSize;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(vx - 1.5, vy - 1.5, 3, 3);
      });

      // Bots
      bots.forEach((b) => {
        const bc = b.cells[0];
        if (bc) {
          const bx = mapX + (bc.x / WORLD_WIDTH) * mapSize;
          const by = mapY + (bc.y / WORLD_HEIGHT) * mapSize;
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
        }
      });

      // Player
      if (activePlaying && playerCells.length > 0) {
        const px = mapX + (playerCenterX / WORLD_WIDTH) * mapSize;
        const py = mapY + (playerCenterY / WORLD_HEIGHT) * mapSize;
        ctx.fillStyle = '#00E676';
        ctx.fillRect(px - 3, py - 3, 6, 6);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 3, py - 3, 6, 6);
      }
      ctx.restore();

      // --- Top Screen Spawn Shield HUD Banner ---
      if (isPlayerShielded && playerCells.length > 0) {
        ctx.save();
        const bannerW = 290;
        const bannerH = 40;
        const bannerX = (canvas.width - bannerW) / 2;
        const bannerY = 24;

        // Banner backdrop with neon cyan border
        ctx.fillStyle = 'rgba(5, 10, 25, 0.90)';
        ctx.strokeStyle = '#00F5FF';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00F5FF';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 10);
        ctx.fill();
        ctx.stroke();

        // Progress bar inside banner
        const progress = Math.min(1, Math.max(0, shieldRemaining / 3.0));
        ctx.fillStyle = 'rgba(0, 245, 255, 0.45)';
        ctx.beginPath();
        ctx.roundRect(bannerX + 6, bannerY + bannerH - 6, (bannerW - 12) * progress, 3, 2);
        ctx.fill();

        // Banner text
        ctx.font = '700 13px Ubuntu, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🛡️ SPAWN SHIELD: ${shieldRemaining.toFixed(1)}s (IMMUNE)`, canvas.width / 2, bannerY + 17);
        ctx.restore();
      }

      // --- 7. Throttled Leaderboard Sync (1000ms throttle completely eliminates re-render flickering) ---
      if (currentTime - stateRef.current.lastLeaderboardSync > 1000) {
        stateRef.current.lastLeaderboardSync = currentTime;
        const leaderboardItems: { name: string; mass: number; kills: number; isCurrent: boolean }[] = [];

        if (activePlaying && playerCells.length > 0) {
          let pMass = 0;
          playerCells.forEach((c) => (pMass += c.mass));
          leaderboardItems.push({
            name: activeName || 'You',
            mass: pMass,
            kills: stateRef.current.playerKills,
            isCurrent: true,
          });
        }

        bots.forEach((b) => {
          let bMass = 0;
          b.cells.forEach((c) => (bMass += c.mass));
          if (bMass > 0) {
            leaderboardItems.push({
              name: b.name,
              mass: bMass,
              kills: b.kills,
              isCurrent: false,
            });
          }
        });

        // Remote Real Players in Leaderboard
        stateRef.current.remotePlayers.forEach((rp) => {
          let rpMass = 0;
          rp.cells.forEach((c) => (rpMass += c.mass));
          if (rpMass > 0) {
            leaderboardItems.push({
              name: `👤 ${rp.name}`,
              mass: rpMass,
              kills: rp.kills || 0,
              isCurrent: false,
            });
          }
        });

        leaderboardItems.sort((a, b) => b.mass - a.mass);

        const topLeaderboard: LeaderboardEntry[] = leaderboardItems.slice(0, 10).map((item, idx) => ({
          rank: idx + 1,
          name: item.name,
          mass: Math.floor(item.mass),
          solValue:
            ((item.mass - BASE_MASS) * 50_000) / 1_000_000_000 + (item.isCurrent ? activeStake : 0.01),
          kills: item.kills,
          isCurrentPlayer: item.isCurrent,
        }));

        leaderboardCallback(topLeaderboard);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', checkCanvasSize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animationId);
    };
  }, [handleMouseMove, handleTouch, handleTouchEnd]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />

      {/* Mobile & Tablet On-Screen Flat-Square Action Controls */}
      <TouchControls
        isPlaying={isPlaying}
        onSplit={triggerSplit}
        onEject={triggerEject}
        onCashOut={triggerCashOut}
        inExtractionZone={inZone}
      />

      {/* Extraction Zone Floating Alert Banner */}
      {inZone && isPlaying && (
        <div className="agar-side-card animate-float agar-extraction-banner">
          <div className="agar-extraction-content">
            <span
              style={{
                fontSize: 11,
                color: '#00E676',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: 1,
                display: 'block',
              }}
            >
              ⚡ EXTRACTION VORTEX ACTIVE
            </span>
            <p className="agar-extraction-text" style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#f8fafc' : '#1e293b', margin: '2px 0 0 0' }}>
              Press <strong>[E]</strong> or tap to undelegate & settle SOL!
            </p>
          </div>
          <button
            className="btn-agar-play agar-extraction-btn"
            onClick={onExtractTriggered}
          >
            CASH OUT NOW [E]
          </button>
        </div>
      )}
    </div>
  );
};
