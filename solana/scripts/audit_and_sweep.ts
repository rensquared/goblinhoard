import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createCloseAccountInstruction
} from "@solana/spl-token";
import * as fs from "fs";
import bs58 from "bs58";
import { SOLANA_CONFIG } from "../config";
import { LaunchWalletsData } from "./generate_launch_wallets";

async function main() {
  const isSweep = process.argv.includes("--sweep");
  const isClose = process.argv.includes("--close-accounts");

  console.log("==================================================================");
  console.log("   HOARDED ($HOARD) - WALLET AUDIT & PROFIT SWEEPER               ");
  console.log(`   Actions: Audit ${isClose ? "+ Close Token Accounts (Rent Reclaim) " : ""}${isSweep ? "+ Sweep All SOL to Deployer" : ""}`);
  console.log("==================================================================\n");

  if (!fs.existsSync(SOLANA_CONFIG.walletsPath)) {
    throw new Error("wallets_hoard_sol.json not found!");
  }
  const walletsData: LaunchWalletsData = JSON.parse(fs.readFileSync(SOLANA_CONFIG.walletsPath, "utf8"));
  const connection = new Connection(SOLANA_CONFIG.mainnetRpc, "confirmed");

  // Load Deployer
  const envPrivKey = process.env.SOLANA_PRIVATE_KEY;
  let deployerPubkey: PublicKey;
  if (envPrivKey) {
    deployerPubkey = Keypair.fromSecretKey(bs58.decode(envPrivKey)).publicKey;
  } else {
    deployerPubkey = new PublicKey(walletsData.deployerAddress);
  }

  // Load Mint if available
  let mintPubkey: PublicKey | null = null;
  if (fs.existsSync(SOLANA_CONFIG.receiptPath)) {
    const rc = JSON.parse(fs.readFileSync(SOLANA_CONFIG.receiptPath, "utf8"));
    if (rc.mintAddress) mintPubkey = new PublicKey(rc.mintAddress);
  } else if (process.env.SOLANA_MINT_ADDRESS) {
    mintPubkey = new PublicKey(process.env.SOLANA_MINT_ADDRESS);
  }

  console.log(`Deployer Destination: ${deployerPubkey.toBase58()}`);
  if (mintPubkey) console.log(`Token Mint:           ${mintPubkey.toBase58()}`);
  console.log("------------------------------------------------------------------\n");

  let totalSolAcrossWallets = 0;
  let totalTokensAcrossWallets = 0n;

  const deployerBal = await connection.getBalance(deployerPubkey).catch(() => 0);
  const deployerSol = deployerBal / LAMPORTS_PER_SOL;
  console.log(`[Deployer] ${deployerPubkey.toBase58()}: ${deployerSol.toFixed(4)} SOL`);

  console.log("\nAuditing Sub-Wallets:");

  for (const sw of walletsData.subWallets) {
    const swPubkey = new PublicKey(sw.address);
    const swKp = Keypair.fromSecretKey(bs58.decode(sw.secretKey));
    const balLamports = await connection.getBalance(swPubkey).catch(() => 0);
    const balSol = balLamports / LAMPORTS_PER_SOL;
    totalSolAcrossWallets += balSol;

    let tokenBal = 0n;
    let ataPubkey: PublicKey | null = null;
    if (mintPubkey) {
      ataPubkey = getAssociatedTokenAddressSync(mintPubkey, swPubkey, true);
      try {
        const acc = await connection.getTokenAccountBalance(ataPubkey);
        tokenBal = BigInt(acc.value.amount);
        totalTokensAcrossWallets += tokenBal;
      } catch {
        // No token account
      }
    }

    const tokenDisplay = tokenBal > 0n ? `${(Number(tokenBal) / 1e6).toLocaleString()} HOARD` : "0 HOARD";
    console.log(` [${sw.index}] ${sw.label.padEnd(18)} | ${sw.address.slice(0, 10)}... | ${balSol.toFixed(4).padStart(8)} SOL | ${tokenDisplay}`);

    // Reclaim rent from empty token accounts if requested
    if (isClose && ataPubkey && tokenBal === 0n) {
      try {
        const tx = new Transaction().add(
          createCloseAccountInstruction(ataPubkey, swPubkey, swPubkey)
        );
        await sendAndConfirmTransaction(connection, tx, [swKp]);
        console.log(`     ✓ Closed empty token account for ${sw.label} (reclaimed ~0.00204 SOL rent)`);
      } catch (err: any) {
        // Account may not exist
      }
    }

    // Sweep SOL to Deployer if requested
    if (isSweep && balLamports > 5000) {
      const sweepLamports = balLamports - 5000; // Leave 5000 lamports for tx fee
      try {
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: swPubkey,
            toPubkey: deployerPubkey,
            lamports: BigInt(sweepLamports)
          })
        );
        const sig = await sendAndConfirmTransaction(connection, tx, [swKp]);
        console.log(`     ✓ Swept ${(sweepLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL to Deployer! Tx: ${sig.slice(0, 12)}...`);
      } catch (err: any) {
        console.error(`     ✗ Failed to sweep ${sw.label}: ${err.message}`);
      }
    }
  }

  console.log("\n==================================================================");
  console.log(`Total Sub-Wallets SOL:   ${totalSolAcrossWallets.toFixed(4)} SOL`);
  console.log(`Total Sub-Wallets HOARD: ${(Number(totalTokensAcrossWallets) / 1e6).toLocaleString()} HOARD`);
  console.log(`Deployer Balance:        ${deployerSol.toFixed(4)} SOL`);
  console.log("==================================================================");
  if (!isSweep && !isClose) {
    console.log("Tip: Run with --close-accounts to reclaim rent from empty token accounts.");
    console.log("Tip: Run with --sweep to sweep all SOL from sub-wallets to deployer.\n");
  }
}

main().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
