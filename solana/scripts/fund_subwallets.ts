import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import * as fs from "fs";
import bs58 from "bs58";
import { SOLANA_CONFIG } from "../config";
import { LaunchWalletsData } from "./generate_launch_wallets";

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("==================================================================");
  console.log("    HOARDED ($HOARD) - SOLANA SUB-WALLET BATCH FUNDER             ");
  console.log(`    Mode: ${isLive ? "🚨 LIVE EXECUTION 🚨" : "🛡️ DRY-RUN SIMULATION (Pass --live to execute)"}`);
  console.log("==================================================================\n");

  if (!fs.existsSync(SOLANA_CONFIG.walletsPath)) {
    throw new Error(`wallets_hoard_sol.json not found! Run generate_launch_wallets.ts first.`);
  }

  const walletsData: LaunchWalletsData = JSON.parse(fs.readFileSync(SOLANA_CONFIG.walletsPath, "utf8"));
  const connection = new Connection(SOLANA_CONFIG.mainnetRpc, "confirmed");

  // Load Deployer Keypair
  const envPrivKey = process.env.SOLANA_PRIVATE_KEY;
  if (!envPrivKey) {
    throw new Error("SOLANA_PRIVATE_KEY not found in .env! Please set your funder private key.");
  }

  const deployerKp = Keypair.fromSecretKey(bs58.decode(envPrivKey));
  const deployerBal = await connection.getBalance(deployerKp.publicKey);
  const deployerBalSol = deployerBal / LAMPORTS_PER_SOL;

  console.log(`Deployer Address: ${deployerKp.publicKey.toBase58()}`);
  console.log(`Deployer Balance: ${deployerBalSol.toFixed(4)} SOL\n`);

  // Calculate required funding: buySol + 0.0035 SOL (for ATA rent ~0.00204 SOL + tx fee)
  const GAS_RENT_PER_WALLET = 0.0035;
  let totalRequiredSol = 0;

  const transfers = walletsData.subWallets.map((sw) => {
    const amountSol = sw.buySol + GAS_RENT_PER_WALLET;
    totalRequiredSol += amountSol;
    return {
      to: new PublicKey(sw.address),
      label: sw.label,
      buySol: sw.buySol,
      totalSol: amountSol,
      lamports: BigInt(Math.round(amountSol * LAMPORTS_PER_SOL))
    };
  });

  console.log(`Total Funding Required for 10 Sub-Wallets: ${totalRequiredSol.toFixed(4)} SOL`);
  console.log(`Deployer Available: ${deployerBalSol.toFixed(4)} SOL\n`);

  if (deployerBalSol < totalRequiredSol) {
    console.error(`✗ ALERT: Deployer balance (${deployerBalSol.toFixed(4)} SOL) is insufficient.`);
    console.error(`Please fund ${deployerKp.publicKey.toBase58()} with at least ${totalRequiredSol.toFixed(4)} SOL.`);
    if (isLive) process.exit(1);
  }

  console.log("Planned Transfers:");
  transfers.forEach((t, i) => {
    console.log(` [${i + 1}] ${t.label} (${t.to.toBase58().slice(0, 8)}...): ${t.buySol} SOL buy + ${GAS_RENT_PER_WALLET} SOL rent/gas = ${t.totalSol.toFixed(4)} SOL`);
  });

  if (!isLive) {
    console.log("\n🛡️ Dry-run completed successfully! Run with --live to broadcast transactions on-chain.");
    return;
  }

  console.log("\n🚨 Executing Batch Transfers on-chain...");

  // Send in 2 batch transactions of 5 transfers each to stay well within Solana transaction size limits
  const batch1 = transfers.slice(0, 5);
  const batch2 = transfers.slice(5, 10);

  for (const [batchIndex, batch] of [batch1, batch2].entries()) {
    const tx = new Transaction();
    for (const t of batch) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: deployerKp.publicKey,
          toPubkey: t.to,
          lamports: t.lamports
        })
      );
    }

    console.log(`Sending Batch ${batchIndex + 1}/2 (${batch.length} transfers)...`);
    const sig = await sendAndConfirmTransaction(connection, tx, [deployerKp]);
    console.log(`✓ Batch ${batchIndex + 1} Confirmed! Tx: https://solscan.io/tx/${sig}`);
  }

  console.log("\n🎉 All 10 sub-wallets funded successfully!");
}

main().catch((err) => {
  console.error("Error funding sub-wallets:", err);
  process.exit(1);
});
