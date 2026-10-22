import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { Connection, PublicKey, Transaction, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=== PUMP.FUN CREATOR REWARDS CLAIM ===");
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const conn = new Connection(rpcUrl, "confirmed");
  const onlineSdk = new OnlinePumpSdk(conn);

  const mint = new PublicKey("HEdn1fnjwtZXuUKJQrFn2ofHsWANofSnoUhFUTBkpump");
  const walletPath = path.resolve(__dirname, "../wallets/creator_wallet.json");

  const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(bs58.decode(raw.privateKey));

  console.log("Claiming for Creator Wallet:", payer.publicKey.toBase58());
  const initialBalance = await conn.getBalance(payer.publicKey);
  console.log("Current Balance:", (initialBalance / 1e9).toFixed(6), "SOL");

  console.log("Checking distributable fees on-chain...");
  const feeCheck = await onlineSdk.getMinimumDistributableFee(mint);
  console.log("Distributable pool:", (Number(feeCheck.distributableFees) / 1e9).toFixed(6), "SOL");
  console.log("Can distribute:", feeCheck.canDistribute);

  if (!feeCheck.canDistribute) {
    console.log("No fees ready to distribute right now.");
    return;
  }

  const { instructions } = await onlineSdk.buildDistributeCreatorFeesInstructions(mint);

  const tx = new Transaction();
  // Add priority fee for fast landing
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ...instructions
  );

  tx.feePayer = payer.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.sign(payer);

  console.log("Broadcasting distributeCreatorFees transaction...");
  const signature = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 5,
  });

  console.log("Tx signature submitted:", signature);
  console.log("Waiting for confirmation...");

  const confirmation = await conn.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    console.error("Transaction failed:", confirmation.value.err);
    process.exit(1);
  }

  console.log("Transaction successfully CONFIRMED on Solana!");
  const newBalance = await conn.getBalance(payer.publicKey);
  console.log("New Creator Wallet Balance:", (newBalance / 1e9).toFixed(6), "SOL");
  console.log("Net Claimed:", ((newBalance - initialBalance) / 1e9).toFixed(6), "SOL");
  console.log("Solscan URL: https://solscan.io/tx/" + signature);
}

main().catch((err) => {
  console.error("Claim error:", err);
  process.exit(1);
});
