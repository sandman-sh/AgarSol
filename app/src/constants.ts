import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

export const PROGRAM_ID = new PublicKey('7VDmuJyPxyKA9rzqoupukyLZJXGgbvzZpZPTb3AGFTNi');

// MagicBlock Devnet Validator
export const MAGICBLOCK_VALIDATOR_PUBKEY = new PublicKey(
  'MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57'
);

// RPC Endpoints
export const BASE_RPC_URL = 'https://api.devnet.solana.com';
export const MAGICBLOCK_ER_RPC_URL = 'https://devnet.magicblock.app/';
export const MAGICBLOCK_ER_WS_URL = 'wss://devnet.magicblock.app/';

// Seeds
export const ARENA_SEED = Buffer.from('arena');
export const PLAYER_SEED = Buffer.from('player');
export const VAULT_SEED = Buffer.from('vault');

// Game World Config (True Agar.io Dimension & Authentic Scaling)
export const WORLD_WIDTH = 4500;
export const WORLD_HEIGHT = 4500;
export const BASE_MASS = 20;
export const PELLET_COUNT = 1800;
export const VIRUS_COUNT = 18;
export const VIRUS_RADIUS = 72;
export const VIRUS_MASS = 100;
export const EJECTED_PELLET_MASS = 12;
export const MIN_SPLIT_MASS = 36;
export const MIN_EJECT_MASS = 30;

// Extraction Zones for Atomic Settlement back to Solana L1
export const EXTRACTION_ZONES = [
  { x: 500, y: 500, radius: 180, name: 'Northwest Extraction' },
  { x: 4000, y: 500, radius: 180, name: 'Northeast Extraction' },
  { x: 500, y: 4000, radius: 180, name: 'Southwest Extraction' },
  { x: 4000, y: 4000, radius: 180, name: 'Southeast Extraction' },
  { x: 2250, y: 2250, radius: 240, name: 'Central Rollup Rift' },
];

export interface SkinDefinition {
  id: string;
  name: string;
  fill: string;
  stroke: string;
  glow: string;
  emblem: string;
  type: 'solana' | 'bonk' | 'doge' | 'pepe' | 'wizardio' | 'phantom' | 'monke' | 'chad' | 'default';
  description: string;
}

export const SKINS: SkinDefinition[] = [
  {
    id: 'solana',
    name: 'Solana',
    fill: '#14F195',
    stroke: '#0EB872',
    glow: 'rgba(20, 241, 149, 0.6)',
    emblem: '◎',
    type: 'solana',
    description: 'Pure high-speed SVM flow',
  },
  {
    id: 'wizardio',
    name: 'Wizardio',
    fill: '#9945FF',
    stroke: '#6C2BD9',
    glow: 'rgba(153, 69, 255, 0.7)',
    emblem: '🧙',
    type: 'wizardio',
    description: 'MagicBlock Architect & Rollup Sorcerer',
  },
  {
    id: 'bonk',
    name: 'Bonk',
    fill: '#F89E2B',
    stroke: '#C27415',
    glow: 'rgba(248, 158, 43, 0.6)',
    emblem: '🐕',
    type: 'bonk',
    description: 'The community bat doge',
  },
  {
    id: 'pepe',
    name: 'Pepe',
    fill: '#589E39',
    stroke: '#3C7323',
    glow: 'rgba(88, 158, 57, 0.6)',
    emblem: '🐸',
    type: 'pepe',
    description: 'Feels good man',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    fill: '#7C67FE',
    stroke: '#5842D8',
    glow: 'rgba(124, 103, 254, 0.7)',
    emblem: '👻',
    type: 'phantom',
    description: 'The elusive stealth wallet',
  },
  {
    id: 'doge',
    name: 'Doge',
    fill: '#D8A72B',
    stroke: '#A67F1A',
    glow: 'rgba(216, 167, 43, 0.6)',
    emblem: '🐶',
    type: 'doge',
    description: 'Much split. Very eat. Wow.',
  },
  {
    id: 'monke',
    name: 'Monke',
    fill: '#FF5E7E',
    stroke: '#C83B56',
    glow: 'rgba(255, 94, 126, 0.6)',
    emblem: '👑',
    type: 'monke',
    description: 'Solana royalty with golden crown',
  },
  {
    id: 'chad',
    name: 'GigaChad',
    fill: '#22D3EE',
    stroke: '#0891B2',
    glow: 'rgba(34, 211, 238, 0.6)',
    emblem: '🗿',
    type: 'chad',
    description: 'Absolute peak rollup performance',
  },
];
