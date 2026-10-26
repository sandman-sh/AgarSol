import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import {
  BASE_RPC_URL,
  MAGICBLOCK_ER_RPC_URL,
  MAGICBLOCK_ER_WS_URL,
  PROGRAM_ID,
  ARENA_SEED,
  PLAYER_SEED,
  VAULT_SEED,
  MAGICBLOCK_VALIDATOR_PUBKEY,
} from '../constants';
import nomnomIdl from '../idl/nomnom.json';
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
} from '@magicblock-labs/ephemeral-rollups-sdk';
import type { SolanaProvider } from './wallet';

// Global singleton connections
export const baseConnection = new Connection(BASE_RPC_URL, 'confirmed');
export const erConnection = new Connection(MAGICBLOCK_ER_RPC_URL, {
  wsEndpoint: MAGICBLOCK_ER_WS_URL,
  commitment: 'confirmed',
});

// Ping latency tracker
export async function measureErLatency(): Promise<number> {
  const start = performance.now();
  try {
    await erConnection.getSlot('processed');
    return Math.round(performance.now() - start);
  } catch {
    return Math.round(performance.now() - start);
  }
}

// PDAs
export function getArenaPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ARENA_SEED], PROGRAM_ID);
}

export function getVaultPda(arena: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SEED, arena.toBuffer()], PROGRAM_ID);
}

export function getPlayerPda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PLAYER_SEED, authority.toBuffer()], PROGRAM_ID);
}

// Burner Wallet management for guest play
const BURNER_KEY = 'nomnom_burner_keypair';

export function getBurnerKeypair(): Keypair {
  const existing = localStorage.getItem(BURNER_KEY);
  if (existing) {
    try {
      const secret = Uint8Array.from(JSON.parse(existing));
      return Keypair.fromSecretKey(secret);
    } catch {
      // Fall through to generate new
    }
  }
  const fresh = Keypair.generate();
  localStorage.setItem(BURNER_KEY, JSON.stringify(Array.from(fresh.secretKey)));
  return fresh;
}

export function resetBurnerKeypair(): Keypair {
  const fresh = Keypair.generate();
  localStorage.setItem(BURNER_KEY, JSON.stringify(Array.from(fresh.secretKey)));
  return fresh;
}

// Discriminators from IDL
function getDiscriminator(ixName: string): Buffer {
  const ix = nomnomIdl.instructions.find((i) => i.name === ixName);
  if (!ix || !ix.discriminator) {
    throw new Error(`Discriminator for ${ixName} not found`);
  }
  return Buffer.from(ix.discriminator);
}

// On-Chain Player Struct
export interface OnChainPlayer {
  authority: PublicKey;
  arena: PublicKey;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  score: number;
  kills: number;
  color: number;
  isAlive: boolean;
  depositLamports: bigint;
  bump: number;
}

export async function fetchPlayerAccount(
  connection: Connection,
  playerPda: PublicKey
): Promise<OnChainPlayer | null> {
  try {
    const info = await connection.getAccountInfo(playerPda, 'confirmed');
    if (!info || info.data.length < 130) return null;

    const d = info.data;
    // Skip 8-byte discriminator
    let offset = 8;
    const authority = new PublicKey(d.subarray(offset, offset + 32));
    offset += 32;
    const arena = new PublicKey(d.subarray(offset, offset + 32));
    offset += 32;

    const rawName = d.subarray(offset, offset + 16);
    const zeroIdx = rawName.indexOf(0);
    const name = new TextDecoder().decode(rawName.subarray(0, zeroIdx === -1 ? 16 : zeroIdx));
    offset += 16;

    const x = d.readInt32LE(offset);
    offset += 4;
    const y = d.readInt32LE(offset);
    offset += 4;
    const vx = d.readInt16LE(offset);
    offset += 2;
    const vy = d.readInt16LE(offset);
    offset += 2;

    const mass = Number(d.readBigUInt64LE(offset));
    offset += 8;
    const score = Number(d.readBigUInt64LE(offset));
    offset += 8;
    const kills = d.readUInt32LE(offset);
    offset += 4;
    const color = d.readUInt8(offset);
    offset += 1;
    const isAlive = d.readUInt8(offset) === 1;
    offset += 1;
    const lowLamports = BigInt(d.readUInt32LE(offset));
    const highLamports = BigInt(d.readUInt32LE(offset + 4));
    const depositLamports = (highLamports << 32n) | lowLamports;
    offset += 8;
    const bump = d.readUInt8(offset);

    return {
      authority,
      arena,
      name,
      x,
      y,
      vx,
      vy,
      mass,
      score,
      kills,
      color,
      isAlive,
      depositLamports,
      bump,
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Instruction Builders
// -------------------------------------------------------------

export function createSpawnPlayerInstruction(
  playerSigner: PublicKey,
  name: string,
  depositLamports: bigint,
  color: number,
  startX: number,
  startY: number
): TransactionInstruction {
  const [arenaPda] = getArenaPda();
  const [vaultPda] = getVaultPda(arenaPda);
  const [playerPda] = getPlayerPda(playerSigner);

  const discriminator = getDiscriminator('spawn_player');
  const nameBuffer = Buffer.from(name.slice(0, 16), 'utf8');

  const data = Buffer.alloc(8 + 4 + nameBuffer.length + 8 + 1 + 4 + 4);
  let offset = 0;
  discriminator.copy(data, offset);
  offset += 8;

  data.writeUInt32LE(nameBuffer.length, offset);
  offset += 4;
  nameBuffer.copy(data, offset);
  offset += nameBuffer.length;

  const low = Number(BigInt(depositLamports) & 0xffffffffn);
  const high = Number((BigInt(depositLamports) >> 32n) & 0xffffffffn);
  data.writeUInt32LE(low, offset);
  data.writeUInt32LE(high, offset + 4);
  offset += 8;

  data.writeUInt8(color & 0xff, offset);
  offset += 1;

  data.writeInt32LE(Math.round(startX), offset);
  offset += 4;

  data.writeInt32LE(Math.round(startY), offset);
  offset += 4;

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: arenaPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: playerSigner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createDelegatePlayerInstruction(
  payer: PublicKey,
  playerPda: PublicKey,
  validator: PublicKey = MAGICBLOCK_VALIDATOR_PUBKEY
): TransactionInstruction {
  const discriminator = getDiscriminator('delegate_player');
  const bufferPda = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(playerPda, PROGRAM_ID);
  const recordPda = delegationRecordPdaFromDelegatedAccount(playerPda);
  const metadataPda = delegationMetadataPdaFromDelegatedAccount(playerPda);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: playerPda, isSigner: false, isWritable: true },
      // Remaining accounts required by MagicBlock CPI
      { pubkey: validator, isSigner: false, isWritable: false },
      { pubkey: bufferPda, isSigner: false, isWritable: true },
      { pubkey: recordPda, isSigner: false, isWritable: true },
      { pubkey: metadataPda, isSigner: false, isWritable: true },
      { pubkey: DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: discriminator,
  });
}

export function createMovePlayerInstruction(
  playerPda: PublicKey,
  authority: PublicKey,
  newX: number,
  newY: number,
  vx: number,
  vy: number
): TransactionInstruction {
  const discriminator = getDiscriminator('move_player');

  const data = Buffer.alloc(8 + 4 + 4 + 2 + 2);
  discriminator.copy(data, 0);
  data.writeInt32LE(Math.round(newX), 8);
  data.writeInt32LE(Math.round(newY), 12);
  data.writeInt16LE(Math.round(vx), 16);
  data.writeInt16LE(Math.round(vy), 18);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

export function createEatPelletInstruction(
  playerPda: PublicKey,
  authority: PublicKey,
  massGain: number
): TransactionInstruction {
  const discriminator = getDiscriminator('eat_pellet');

  const data = Buffer.alloc(8 + 4);
  discriminator.copy(data, 0);
  data.writeUInt32LE(massGain, 8);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

export function createEatPlayerInstruction(
  predatorPda: PublicKey,
  victimPda: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  const discriminator = getDiscriminator('eat_player');

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: predatorPda, isSigner: false, isWritable: true },
      { pubkey: victimPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: discriminator,
  });
}

export function createCashOutInstruction(
  payer: PublicKey,
  playerPda: PublicKey
): TransactionInstruction {
  const discriminator = getDiscriminator('cash_out_and_undelegate');

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: MAGIC_CONTEXT_ID, isSigner: false, isWritable: true },
      { pubkey: MAGIC_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: discriminator,
  });
}

export function createClaimPayoutInstruction(
  playerSigner: PublicKey
): TransactionInstruction {
  const [arenaPda] = getArenaPda();
  const [vaultPda] = getVaultPda(arenaPda);
  const [playerPda] = getPlayerPda(playerSigner);
  const discriminator = getDiscriminator('claim_payout');

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: arenaPda, isSigner: false, isWritable: false },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: playerPda, isSigner: false, isWritable: true },
      { pubkey: playerSigner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: discriminator,
  });
}

// -------------------------------------------------------------
// Transaction Dispatchers
// -------------------------------------------------------------

export async function sendAndConfirmWalletTx(
  connection: Connection,
  provider: SolanaProvider,
  instructions: TransactionInstruction[]
): Promise<string> {
  const payerPubkey = new PublicKey(provider.publicKey!.toBase58());
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction();
  instructions.forEach((ix) => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = payerPubkey;

  let signature: string;
  if (provider.signTransaction) {
    const signedTx = (await provider.signTransaction(tx)) as Transaction;
    signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
  } else if (provider.signAndSendTransaction) {
    const res = await provider.signAndSendTransaction(tx);
    signature = res.signature;
  } else {
    throw new Error('Connected wallet does not support transaction signing');
  }

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  return signature;
}

export async function sendAndConfirmKeypairTx(
  connection: Connection,
  keypair: Keypair,
  instructions: TransactionInstruction[]
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction();
  instructions.forEach((ix) => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = keypair.publicKey;
  tx.sign(keypair);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  return signature;
}

// High-Speed Sub-20ms ER Transaction Runner
export async function sendErTx(
  keypair: Keypair,
  instructions: TransactionInstruction[]
): Promise<string> {
  const { blockhash } = await erConnection.getLatestBlockhash('processed');
  const tx = new Transaction();
  instructions.forEach((ix) => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = keypair.publicKey;
  tx.sign(keypair);

  return await erConnection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
  });
}

// -------------------------------------------------------------
// High-Level Gameplay Workflows
// -------------------------------------------------------------

export async function executeSpawnAndDelegate(params: {
  playerPubkey: PublicKey;
  provider?: SolanaProvider | null;
  keypair?: Keypair | null;
  name: string;
  depositSol: number;
  color: number;
  startX: number;
  startY: number;
}): Promise<{ spawnTx: string; delegateTx?: string; sessionKeypair: Keypair }> {
  const { provider, keypair, name, depositSol, color, startX, startY } = params;
  const depositLamports = BigInt(Math.max(5_000_000, Math.round(depositSol * LAMPORTS_PER_SOL)));

  // Always use a fresh session keypair for each round to prevent on-chain PDA collision
  // ("Allocate: account Address ... already in use") caused by Anchor's `init` on [PLAYER_SEED, player_signer].
  // This also enables sub-20ms ER zero-gas transactions to sign directly in browser.
  let sessionKey: Keypair;
  let isWalletFunding = false;

  if (provider && provider.publicKey) {
    sessionKey = Keypair.generate();
    isWalletFunding = true;
  } else if (keypair) {
    const [existingPda] = getPlayerPda(keypair.publicKey);
    const existing = await baseConnection.getAccountInfo(existingPda, 'confirmed');
    if (existing) {
      sessionKey = resetBurnerKeypair();
      try {
        const oldBal = await baseConnection.getBalance(keypair.publicKey);
        if (oldBal > 10_000) {
          await sendAndConfirmKeypairTx(baseConnection, keypair, [
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey: sessionKey.publicKey,
              lamports: oldBal - 5_000,
            }),
          ]);
        }
      } catch (err) {
        console.warn('Sweeping old burner balance warning:', err);
      }
    } else {
      sessionKey = keypair;
    }
  } else {
    throw new Error('No signer available for spawning player');
  }

  const [playerPda] = getPlayerPda(sessionKey.publicKey);

  const spawnIx = createSpawnPlayerInstruction(
    sessionKey.publicKey,
    name,
    depositLamports,
    color,
    startX,
    startY
  );

  let spawnTx: string;

  if (isWalletFunding && provider && provider.publicKey) {
    const walletPubkey = new PublicKey(provider.publicKey.toBase58());
    const rentExemptBuffer = 2_000_000n; // Rent for player PDA + gas
    const totalFundingLamports = depositLamports + rentExemptBuffer;

    const transferIx = SystemProgram.transfer({
      fromPubkey: walletPubkey,
      toPubkey: sessionKey.publicKey,
      lamports: Number(totalFundingLamports),
    });

    const computeLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 });
    const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 });

    const tx = new Transaction().add(computeLimitIx, computePriceIx, transferIx, spawnIx);
    const { blockhash, lastValidBlockHeight } = await baseConnection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = walletPubkey;

    // Partial sign with sessionKey (covers player_signer in spawnIx)
    tx.partialSign(sessionKey);

    let signedTx: Transaction;
    if (provider.signTransaction) {
      signedTx = (await provider.signTransaction(tx)) as Transaction;
    } else {
      throw new Error('Connected wallet does not support signTransaction');
    }

    spawnTx = await baseConnection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await baseConnection.confirmTransaction(
      { signature: spawnTx, blockhash, lastValidBlockHeight },
      'confirmed'
    );
  } else {
    spawnTx = await sendAndConfirmKeypairTx(baseConnection, sessionKey, [spawnIx]);
  }

  // Attempt delegation to MagicBlock Ephemeral Rollup validator
  let delegateTx: string | undefined;
  try {
    const delegateIx = createDelegatePlayerInstruction(sessionKey.publicKey, playerPda);
    delegateTx = await sendAndConfirmKeypairTx(baseConnection, sessionKey, [delegateIx]);
  } catch (err) {
    console.warn('Ephemeral rollup delegation note:', err);
  }

  return { spawnTx, delegateTx, sessionKeypair: sessionKey };
}

export async function executeCashOutAndSettlement(params: {
  playerPubkey: PublicKey;
  provider?: SolanaProvider | null;
  keypair?: Keypair | null;
  recipientWallet?: PublicKey | null;
}): Promise<string> {
  const { playerPubkey, provider, keypair, recipientWallet } = params;
  const activeSigner = keypair || null;
  const targetSignerPubkey = activeSigner ? activeSigner.publicKey : playerPubkey;
  const [playerPda] = getPlayerPda(targetSignerPubkey);

  // 1. Commit and undelegate on MagicBlock ER if delegated
  if (activeSigner) {
    try {
      const cashOutIx = createCashOutInstruction(targetSignerPubkey, playerPda);
      await sendErTx(activeSigner, [cashOutIx]);
    } catch {
      // Best-effort rollup commit
    }
  }

  // 2. Claim SOL Payout from Arena Vault on Solana Devnet L1
  const claimIx = createClaimPayoutInstruction(targetSignerPubkey);
  let payoutTx: string;
  if (activeSigner) {
    payoutTx = await sendAndConfirmKeypairTx(baseConnection, activeSigner, [claimIx]);
  } else if (provider && provider.publicKey) {
    payoutTx = await sendAndConfirmWalletTx(baseConnection, provider, [claimIx]);
  } else {
    throw new Error('No signer available for cash out');
  }

  // 3. Return funds to user's main wallet (if playing with connected Phantom wallet)
  if (activeSigner && recipientWallet) {
    try {
      const bal = await baseConnection.getBalance(activeSigner.publicKey, 'confirmed');
      const fee = 5000;
      if (bal > fee) {
        const sweepIx = SystemProgram.transfer({
          fromPubkey: activeSigner.publicKey,
          toPubkey: recipientWallet,
          lamports: bal - fee,
        });
        await sendAndConfirmKeypairTx(baseConnection, activeSigner, [sweepIx]);
      }
    } catch (err) {
      console.warn('Sweeping session payout to wallet note:', err);
    }
  }

  return payoutTx;
}

export async function requestDevnetAirdrop(pubkey: PublicKey): Promise<string> {
  try {
    const sig = await baseConnection.requestAirdrop(pubkey, 0.5 * LAMPORTS_PER_SOL);
    const { blockhash, lastValidBlockHeight } = await baseConnection.getLatestBlockhash('confirmed');
    await baseConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  } catch (err) {
    throw new Error(`Airdrop request failed (rate limit may apply): ${(err as Error).message}`);
  }
}
