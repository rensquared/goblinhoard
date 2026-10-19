import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";
import { SOLANA_CONFIG } from "../config";

/**
 * PUMP.FUN CREATOR FEE SPLITTER DAEMON
 * ----------------------------------------------------
 * On Pump.fun, the creator / developer wallet receives creator rewards/fees.
 * This daemon monitors the creator wallet in real-time via Solana WebSocket.
 * The instant fees arrive, it executes an atomic, single-block transaction:
 *   - 20% (0.2% fee share) -> WALLET_A
 *   - 80% (0.8% fee share) -> WALLET_B
 * ----------------------------------------------------
 */

interface SplitterConfig {
  walletA: string; // 20% recipient (e.g. Community / Goblin Warband Reserve)
  walletB: string; // 80% recipient (e.g. Team / Altar of Sacrifice Treasury)
  minThresholdSol: number; // Minimum SOL balance before triggering split (e.g. 0.005 SOL)
  keepSolForGas: number; // Gas buffer retained in creator wallet (e.g. 0.002 SOL)
}

const DEFAULT_CONFIG: SplitterConfig = {
  walletA: process.env.FEE_WALLET_A || "9umf2n1DPJb9ZE4zvrqE6xGZwszHhMHxg4k4RHUkCgob", // Vanity Goblin Warband Wallet (...gob)
  walletB: process.env.FEE_WALLET_B || process.env.TREASURY_WALLET || "", // Team / Payout Wallet (Optional - defaults to creator wallet)
  minThresholdSol: 0.005,
  keepSolForGas: 0.001
};

async function runFeeSplitter() {
  console.log("=================================================");
  console.log("⚔️ PUMP.FUN CREATOR FEE SPLITTER DAEMON (20/80) ⚔️");
  console.log("=================================================");

  const rpcUrl = SOLANA_CONFIG.mainnetRpc || "https://solana-rpc.publicnode.com";
  const wsUrl = SOLANA_CONFIG.wsEndpoint || "wss://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, { wsEndpoint: wsUrl, commitment: "confirmed" });

  // Load creator wallet keypair
  let creatorKeypair: Keypair;
  const envKey = process.env.CREATOR_PRIVATE_KEY;

  if (envKey) {
    try {
      creatorKeypair = Keypair.fromSecretKey(bs58.decode(envKey.trim()));
    } catch {
      creatorKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(envKey)));
    }
  } else {
    // Check local wallets file
    const creatorWalletPath = path.join(__dirname, "../wallets/creator_wallet.json");
    const devWalletPath = path.join(__dirname, "../wallets/dev_wallet.json");
    if (fs.existsSync(creatorWalletPath)) {
      const data = JSON.parse(fs.readFileSync(creatorWalletPath, "utf-8"));
      creatorKeypair = Keypair.fromSecretKey(bs58.decode(data.privateKey));
    } else if (fs.existsSync(devWalletPath)) {
      const data = JSON.parse(fs.readFileSync(devWalletPath, "utf-8"));
      creatorKeypair = Keypair.fromSecretKey(bs58.decode(data.privateKey));
    } else {
      console.log("⚠️ No CREATOR_PRIVATE_KEY provided. Generating a demo creator keypair for testing...");
      creatorKeypair = Keypair.generate();
    }
  }

  const creatorPubkey = creatorKeypair.publicKey;
  console.log(`📡 Monitoring Creator Wallet: ${creatorPubkey.toBase58()}`);
  console.log(`🏦 Target Wallet A (0.2% share / 20%): ${DEFAULT_CONFIG.walletA}`);
  console.log(`🏦 Target Wallet B (0.8% share / 80%): ${DEFAULT_CONFIG.walletB}`);
  console.log(`⚡ Min Threshold: ${DEFAULT_CONFIG.minThresholdSol} SOL | Gas Buffer: ${DEFAULT_CONFIG.keepSolForGas} SOL`);

  let isSplitting = false;

  const checkAndSplitBalance = async () => {
    if (isSplitting) return;
    try {
      const balanceLamports = await connection.getBalance(creatorPubkey, "confirmed");
      const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

      if (balanceSol < DEFAULT_CONFIG.minThresholdSol) {
        return;
      }

      isSplitting = true;
      console.log(`\n💰 New Creator Fee detected! Current Balance: ${balanceSol.toFixed(4)} SOL`);

      // Deduct gas buffer
      const gasBufferLamports = Math.floor(DEFAULT_CONFIG.keepSolForGas * LAMPORTS_PER_SOL);
      const distributableLamports = balanceLamports - gasBufferLamports - 10000; // 10000 lamports tx fee

      if (distributableLamports <= 0) {
        isSplitting = false;
        return;
      }

      // 20% to Wallet A (0.2% fee ratio), 80% to Wallet B (0.8% fee ratio)
      const lamportsA = Math.floor(distributableLamports * 0.20);
      const lamportsB = distributableLamports - lamportsA;

      console.log(`📊 Splitting ${distributableLamports / LAMPORTS_PER_SOL} SOL:`);
      console.log(`   ➡️ Wallet A (20% · 0.2% fee share): ${(lamportsA / LAMPORTS_PER_SOL).toFixed(5)} SOL`);
      console.log(`   ➡️ Wallet B (80% · 0.8% fee share): ${(lamportsB / LAMPORTS_PER_SOL).toFixed(5)} SOL`);

      // Verify recipient addresses
      let pubkeyA: PublicKey;
      try {
        pubkeyA = new PublicKey(DEFAULT_CONFIG.walletA);
      } catch (err: any) {
        console.error("❌ Invalid target wallet A public key:", err.message);
        isSplitting = false;
        return;
      }

      // Build atomic transaction with compute priority
      const tx = new Transaction();
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }));
      tx.add(
        SystemProgram.transfer({
          fromPubkey: creatorPubkey,
          toPubkey: pubkeyA,
          lamports: lamportsA
        })
      );

      const hasExternalWalletB = Boolean(
        DEFAULT_CONFIG.walletB &&
        DEFAULT_CONFIG.walletB !== creatorPubkey.toBase58() &&
        !DEFAULT_CONFIG.walletB.includes("FEEb111") &&
        !DEFAULT_CONFIG.walletB.includes("Treasury111")
      );

      if (hasExternalWalletB) {
        try {
          const pubkeyB = new PublicKey(DEFAULT_CONFIG.walletB);
          tx.add(
            SystemProgram.transfer({
              fromPubkey: creatorPubkey,
              toPubkey: pubkeyB,
              lamports: lamportsB
            })
          );
          console.log(`   ➡️ 80% forwarded to: ${DEFAULT_CONFIG.walletB}`);
        } catch (err: any) {
          console.warn(`   ⚠️ Invalid wallet B address (${DEFAULT_CONFIG.walletB}), retaining 80% in creator wallet.`);
        }
      } else {
        console.log(`   💎 80% retained in Creator Wallet: ${(lamportsB / LAMPORTS_PER_SOL).toFixed(5)} SOL (Your Cut)`);
      }

      const sig = await sendAndConfirmTransaction(connection, tx, [creatorKeypair], {
        commitment: "confirmed"
      });

      console.log(`✅ ATOMIC SPLIT COMPLETE! Tx: https://solscan.io/tx/${sig}`);
    } catch (err: any) {
      console.error("❌ Split execution error:", err.message || err);
    } finally {
      isSplitting = false;
    }
  };

  // 1. Initial check
  await checkAndSplitBalance();

  // 2. Real-time WebSocket listener on creator account balance
  console.log("👂 Listening for incoming creator fees on WebSocket...");
  connection.onAccountChange(
    creatorPubkey,
    (accInfo) => {
      const sol = accInfo.lamports / LAMPORTS_PER_SOL;
      console.log(`⚡ Creator Account Balance changed: ${sol.toFixed(4)} SOL`);
      checkAndSplitBalance();
    },
    "processed"
  );

  // 3. Fallback polling every 5 seconds
  setInterval(checkAndSplitBalance, 5000);
}

if (require.main === module) {
  runFeeSplitter().catch(console.error);
}

export { runFeeSplitter };
