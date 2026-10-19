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
import { PumpFunService } from "../utils/pump";

/**
 * 👑 UNIFIED PRODUCTION DAEMON (24/7 BACKGROUND RUNNER)
 * ----------------------------------------------------
 * Runs both the Fee Splitter and Goblin Auto-Buyer in a single resilient process:
 *  - Worker 1: 0.2% / 0.8% Creator Fee Splitter
 *  - Worker 2: Goblin Vanity Auto-Buyer (until 85 SOL Raydium Migration)
 *  - Self-healing: auto-reconnects on RPC / WebSocket disconnects
 * ----------------------------------------------------
 */

interface ProductionConfig {
  creatorPrivateKey?: string;
  goblinPrivateKey?: string;
  treasuryWallet: string;
  tokenMint: string;
  minSplitThresholdSol: number;
  goblinBuyThresholdSol: number;
  gasReserveSol: number;
}

const CONFIG: ProductionConfig = {
  creatorPrivateKey: process.env.CREATOR_PRIVATE_KEY,
  goblinPrivateKey: process.env.GOB_PRIVATE_KEY,
  treasuryWallet: process.env.TREASURY_WALLET || "HoardAltarTreasury111111111111111111111111",
  tokenMint: process.env.TOKEN_MINT || "9JeFE6apEvFotefu1ocjWgSceEc3LG1LhgMxQNB4pump",
  minSplitThresholdSol: 0.005,
  goblinBuyThresholdSol: 0.005,
  gasReserveSol: 0.001
};

async function main() {
  console.log("==================================================================");
  console.log("⚔️ THE HOARD: 24/7 PRODUCTION SOLANA WORKER DAEMON ⚔️");
  console.log("==================================================================\n");

  const rpcUrl = SOLANA_CONFIG.mainnetRpc || "https://api.mainnet-beta.solana.com";
  const wsUrl = SOLANA_CONFIG.wsEndpoint || "wss://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, { wsEndpoint: wsUrl, commitment: "confirmed" });

  // 1. Load Creator Keypair
  let creatorKeypair: Keypair;
  const creatorWalletPath = path.join(__dirname, "../wallets/creator_wallet.json");
  const devWalletPath = path.join(__dirname, "../wallets/dev_wallet.json");
  if (CONFIG.creatorPrivateKey) {
    try {
      creatorKeypair = Keypair.fromSecretKey(bs58.decode(CONFIG.creatorPrivateKey.trim()));
    } catch {
      creatorKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(CONFIG.creatorPrivateKey)));
    }
  } else if (fs.existsSync(creatorWalletPath)) {
    const data = JSON.parse(fs.readFileSync(creatorWalletPath, "utf-8"));
    creatorKeypair = Keypair.fromSecretKey(bs58.decode(data.privateKey));
  } else if (fs.existsSync(devWalletPath)) {
    const data = JSON.parse(fs.readFileSync(devWalletPath, "utf-8"));
    creatorKeypair = Keypair.fromSecretKey(bs58.decode(data.privateKey));
  } else {
    creatorKeypair = Keypair.generate();
    console.log("⚠️ No CREATOR_PRIVATE_KEY configured. Running with demo keypair for monitoring.");
  }

  // 2. Load Vanity Goblin Keypair (...gob)
  let goblinKeypair: Keypair;
  const goblinWalletPath = path.join(__dirname, "../wallets/goblin_wallet.json");
  if (CONFIG.goblinPrivateKey) {
    try {
      goblinKeypair = Keypair.fromSecretKey(bs58.decode(CONFIG.goblinPrivateKey.trim()));
    } catch {
      goblinKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(CONFIG.goblinPrivateKey)));
    }
  } else if (fs.existsSync(goblinWalletPath)) {
    const data = JSON.parse(fs.readFileSync(goblinWalletPath, "utf-8"));
    goblinKeypair = Keypair.fromSecretKey(bs58.decode(data.privateKey));
  } else {
    goblinKeypair = Keypair.generate();
    console.log("⚠️ No GOB_PRIVATE_KEY configured. Running with demo goblin keypair.");
  }

  const mintPubkey = new PublicKey(CONFIG.tokenMint);
  const [curvePDA] = PumpFunService.getBondingCurvePDA(mintPubkey);

  console.log(`🏦 Creator Keypair:       ${creatorKeypair.publicKey.toBase58()}`);
  console.log(`👺 Vanity Goblin Wallet:  ${goblinKeypair.publicKey.toBase58()} (...gob)`);
  console.log(`🏛️ Treasury Wallet:       ${CONFIG.treasuryWallet}`);
  console.log(`🪙 Target Token Mint:     ${mintPubkey.toBase58()}`);
  console.log(`📈 Bonding Curve PDA:     ${curvePDA.toBase58()}`);
  console.log(`⚡ Split Threshold:       ${CONFIG.minSplitThresholdSol} SOL`);
  console.log(`⚡ Goblin Buy Threshold:  ${CONFIG.goblinBuyThresholdSol} SOL`);
  console.log("------------------------------------------------------------------\n");

  let isSplitRunning = false;
  let isBuyerRunning = false;

  // WORKER 1: Creator Fee Splitter
  const checkAndSplitFees = async () => {
    if (isSplitRunning) return;
    isSplitRunning = true;
    try {
      const balanceLamports = await connection.getBalance(creatorKeypair.publicKey);
      const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

      if (balanceSol >= CONFIG.minSplitThresholdSol + CONFIG.gasReserveSol) {
        const distributableSol = balanceSol - CONFIG.gasReserveSol;
        const goblinShareSol = Number((distributableSol * 0.20).toFixed(6));
        const treasuryShareSol = Number((distributableSol * 0.80).toFixed(6));

        console.log(`\n💰 [Fee Splitter] New Creator Fees Detected: ${balanceSol.toFixed(4)} SOL`);
        console.log(`   ➡️ 20% (0.2% net) to Goblin Wallet: ${goblinShareSol} SOL`);
        console.log(`   ➡️ 80% (0.8% net) to Treasury:      ${treasuryShareSol} SOL`);

        const goblinLamports = Math.floor(goblinShareSol * LAMPORTS_PER_SOL);
        const treasuryLamports = Math.floor(treasuryShareSol * LAMPORTS_PER_SOL);

        const tx = new Transaction().add(
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
          SystemProgram.transfer({
            fromPubkey: creatorKeypair.publicKey,
            toPubkey: goblinKeypair.publicKey,
            lamports: goblinLamports
          }),
          SystemProgram.transfer({
            fromPubkey: creatorKeypair.publicKey,
            toPubkey: new PublicKey(CONFIG.treasuryWallet),
            lamports: treasuryLamports
          })
        );

        const sig = await sendAndConfirmTransaction(connection, tx, [creatorKeypair], {
          commitment: "confirmed"
        });
        console.log(`   ✅ Atomic Split Confirmed on Solana! Tx: ${sig}`);
      }
    } catch (e: any) {
      console.warn(`   ⚠️ [Fee Splitter Check] ${e.message || e}`);
    } finally {
      isSplitRunning = false;
    }
  };

  // WORKER 2: Goblin Warband Auto-Buyer
  const checkAndExecuteGoblinBuys = async () => {
    if (isBuyerRunning) return;
    isBuyerRunning = true;
    try {
      // Check curve migration state first
      const curveInfo = await connection.getAccountInfo(curvePDA);
      let realSolInCurve = 0;
      let isComplete = false;

      if (curveInfo && curveInfo.data.length >= 41) {
        const decoded = PumpFunService.decodeBondingCurve(curveInfo.data);
        realSolInCurve = Number(decoded.realSolReserves) / LAMPORTS_PER_SOL;
        isComplete = decoded.complete;
      }

      if (isComplete || realSolInCurve >= 85.0) {
        console.log(`\n🚀 [Goblin Auto-Buyer] Token has graduated to Raydium (${realSolInCurve.toFixed(2)} SOL)!`);
        console.log(`   🛑 Curve buying paused. Warband switched to Multi-Pair Raiding.`);
        return;
      }

      const goblinBalanceLamports = await connection.getBalance(goblinKeypair.publicKey);
      const goblinBalanceSol = goblinBalanceLamports / LAMPORTS_PER_SOL;

      if (goblinBalanceSol >= CONFIG.goblinBuyThresholdSol + CONFIG.gasReserveSol) {
        const buyAmountSol = CONFIG.goblinBuyThresholdSol;
        console.log(`\n👺 [Goblin Auto-Buyer] Balance reached threshold: ${goblinBalanceSol.toFixed(4)} SOL`);
        console.log(`   ⚔️ Executing Pump.fun Buy Swap for ${buyAmountSol} SOL on curve...`);

        // Pump.fun buy swap instruction
        const buyTx = new Transaction().add(
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
          PumpFunService.createBuyInstruction({
            buyer: goblinKeypair.publicKey,
            mint: mintPubkey,
            solAmountLamports: BigInt(Math.floor(buyAmountSol * LAMPORTS_PER_SOL)),
            maxSolCostLamports: BigInt(Math.floor(buyAmountSol * 1.05 * LAMPORTS_PER_SOL)), // 5% slippage
            curvePDA
          })
        );

        const sig = await sendAndConfirmTransaction(connection, buyTx, [goblinKeypair], {
          commitment: "confirmed"
        });
        console.log(`   ✅ Goblin Buy Executed & Confirmed! Tx: ${sig}`);
      }
    } catch (e: any) {
      console.warn(`   ⚠️ [Goblin Buyer Check] ${e.message || e}`);
    } finally {
      isBuyerRunning = false;
    }
  };

  // Start Real-Time WebSocket Listeners
  console.log("👂 Listening for Creator Deposits & Curve Changes via WebSocket...");
  try {
    connection.onAccountChange(creatorKeypair.publicKey, () => checkAndSplitFees(), "processed");
    connection.onAccountChange(goblinKeypair.publicKey, () => checkAndExecuteGoblinBuys(), "processed");
  } catch (e) {
    console.warn("WebSocket listener initialization warning:", e);
  }

  // Polling fallback every 3 seconds
  setInterval(() => {
    checkAndSplitFees();
    checkAndExecuteGoblinBuys();
  }, 3000);

  console.log("✅ Production Daemon is running 24/7. Press Ctrl+C to stop.\n");
}

main().catch(console.error);
