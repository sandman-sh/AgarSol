import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// MagicBlock NomNom Program on Devnet
const PROGRAM_ID = new PublicKey('7VDmuJyPxyKA9rzqoupukyLZJXGgbvzZpZPTb3AGFTNi');
const ARENA_SEED = Buffer.from('arena');
const VAULT_SEED = Buffer.from('vault');

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load deployer keypair
  let keypairPath = process.env.KEYPAIR;
  if (!keypairPath) {
    const candidates = [
      path.resolve(process.cwd(), 'deployer-keypair.json'),
      path.resolve(process.cwd(), '../deployer-keypair.json'),
      path.resolve(process.env.HOME || process.env.USERPROFILE || '', '.config/solana/id.json'),
    ];
    keypairPath = candidates.find((p) => p && fs.existsSync(p));
  }
  if (!keypairPath || !fs.existsSync(keypairPath)) {
    throw new Error('Admin keypair not found! Set KEYPAIR env var or place key in ~/.config/solana/id.json');
  }
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`Admin Wallet: ${admin.publicKey.toBase58()}`);

  const [arenaPda, arenaBump] = PublicKey.findProgramAddressSync([ARENA_SEED], PROGRAM_ID);
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync([VAULT_SEED, arenaPda.toBuffer()], PROGRAM_ID);

  console.log(`Arena PDA: ${arenaPda.toBase58()} (bump: ${arenaBump})`);
  console.log(`Vault PDA: ${vaultPda.toBase58()} (bump: ${vaultBump})`);

  // Check if arena already exists
  const existing = await connection.getAccountInfo(arenaPda);
  if (existing) {
    console.log('✅ Arena account already initialized on Devnet!');
    return;
  }

  // Discriminator for initialize_arena: [11, 37, 221, 1, 205, 120, 25, 230]
  const discriminator = Buffer.from([11, 37, 221, 1, 205, 120, 25, 230]);
  const minDeposit = Buffer.alloc(8);
  minDeposit.writeBigUInt64LE(5_000_000n, 0); // 0.005 SOL min deposit

  const data = Buffer.concat([discriminator, minDeposit]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: arenaPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  console.log('Sending initialize_arena transaction to Solana Devnet...');
  const sig = await sendAndConfirmTransaction(connection, tx, [admin], { commitment: 'confirmed' });
  console.log(`🎉 Arena Initialized Successfully!`);
  console.log(`Transaction Signature: ${sig}`);
  console.log(`Solana Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch(console.error);
