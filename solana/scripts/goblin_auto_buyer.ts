import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";
import { SOLANA_CONFIG } from "../config";
import { PumpFunService } from "../utils/pump";

/**
 * GOBLIN WARBAND AUTO-BUYER BOT
 * ----------------------------------------------------
 * Runs on the Goblin Vanity Wallet (ending in ...gob).
 * When funded by the 0.2% fee split (threshold e.g. 0.005 SOL):
 *  1. Checks if the Pump.fun curve is complete (< 85 SOL).
 *  2. Executes a Pump.fun buy order directly on the curve.
 *  3. Continues buying until Raydium migration.
 * ----------------------------------------------------
 */

interface GoblinBuyerConfig {
  spawnThresholdSol: number; // e.g. 0.005 SOL (optimal value for steady goblin recruitment)
  gasReserveSol: number;     // e.g. 0.001 SOL
  tokenMint: string;
}

const DEFAULT_CONFIG: GoblinBuyerConfig = {
  spawnThresholdSol: 0.005,
  gasReserveSol: 0.001,
  tokenMint: process.env.TOKEN_MINT || "9JeFE6apEvFotefu1ocjWgSceEc3LG1LhgMxQNB4pump"
};

async function runGoblinAutoBuyer() {
  console.log("=================================================");
  console.log("👺 GOBLIN WARBAND AUTO-BUYER (UNTIL MIGRATION) 👺");
  console.log("=================================================");

  const rpcUrl = SOLANA_CONFIG.mainnetRpc || "https://solana-rpc.publicnode.com";
  const wsUrl = SOLANA_CONFIG.wsEndpoint || "wss://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, { wsEndpoint: wsUrl, commitment: "confirmed" });

  // Load Goblin wallet
  let goblinKeypair: Keypair;
  const walletFile = path.join(__dirname, "../wallets/goblin_wallet.json");

  if (process.env.GOB_PRIVATE_KEY) {
    const raw = process.env.GOB_PRIVATE_KEY.trim();
    try {
      goblinKeypair = Keypair.fromSecretKey(bs58.decode(raw));
    } catch {
      goblinKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    }
  } else if (fs.existsSync(walletFile)) {
    const data = JSON.parse(fs.readFileSync(walletFile, "utf-8"));
    goblinKeypair = Keypair.fromSecretKey(bs58.decode(data.privateKey));
  } else {
    console.log("⚠️ No goblin wallet found, generating demo...");
    goblinKeypair = Keypair.generate();
  }

  const goblinPubkey = goblinKeypair.publicKey;
  const mintPubkey = new PublicKey(DEFAULT_CONFIG.tokenMint);
  const [curvePDA] = PumpFunService.getBondingCurvePDA(mintPubkey);

  console.log(`🏦 Goblin Vanity Wallet: ${goblinPubkey.toBase58()}`);
  console.log(`🪙 Target Token Mint:    ${mintPubkey.toBase58()}`);
  console.log(`📈 Bonding Curve PDA:    ${curvePDA.toBase58()}`);
  console.log(`⚡ Spawn Threshold:      ${DEFAULT_CONFIG.spawnThresholdSol} SOL`);

  let isBuying = false;

  const checkAndBuy = async () => {
    if (isBuying) return;
    try {
      // 1. Check Bonding Curve Status
      const curveInfo = await connection.getAccountInfo(curvePDA, "confirmed");
      let virtualSol = 30_000_000_000n;
      let virtualToken = 1_073_000_000_000_000n;

      if (curveInfo?.data && curveInfo.data.length >= 49) {
        const state = PumpFunService.parseBondingCurve(curveInfo.data);
        virtualSol = state.virtualSolReserves;
        virtualToken = state.virtualTokenReserves;
        const realSolReserves = Number(state.realSolReserves) / 1e9;

        if (state.complete || realSolReserves >= 85.0) {
          console.log(`\n🎉 TOKEN HAS MIGRATED TO RAYDIUM! (Reserves: ${realSolReserves.toFixed(2)} SOL)`);
          console.log(`👺 Goblins have completed their crusade. Auto-buyer stopping.`);
          return;
        }

        console.log(`📊 Curve Progress: ${realSolReserves.toFixed(2)} / 85.0 SOL`);
      }

      // 2. Check Goblin Wallet Balance
      const balanceLamports = await connection.getBalance(goblinPubkey, "confirmed");
      const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

      if (balanceSol < DEFAULT_CONFIG.spawnThresholdSol + DEFAULT_CONFIG.gasReserveSol) {
        return;
      }

      isBuying = true;
      const buySol = balanceSol - DEFAULT_CONFIG.gasReserveSol;
      const buyLamports = BigInt(Math.floor(buySol * LAMPORTS_PER_SOL));

      console.log(`\n⚔️ GOBLIN BUY TRIGGERED! Accumulated: ${balanceSol.toFixed(4)} SOL`);
      console.log(`   ➡️ Buying with: ${buySol.toFixed(4)} SOL ($HOARD)`);

      // 3. Build & Execute Pump.fun Buy Transaction
      const expectedTokens = PumpFunService.calculateTokensOut(buyLamports, virtualSol, virtualToken);
      const minTokens = (expectedTokens * 85n) / 100n; // 15% slippage

      const buyIx = PumpFunService.createBuyInstruction({
        mint: mintPubkey,
        buyer: goblinPubkey,
        tokenAmount: minTokens,
        maxSolLamports: buyLamports
      });

      const tx = new Transaction();
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
      tx.add(buyIx);

      const sig = await sendAndConfirmTransaction(connection, tx, [goblinKeypair], {
        commitment: "confirmed"
      });

      console.log(`✅ GOBLIN BOUGHT TOKENS! Tx: https://solscan.io/tx/${sig}`);
    } catch (err: any) {
      console.error("❌ Goblin auto-buy error:", err.message || err);
    } finally {
      isBuying = false;
    }
  };

  // Run on startup
  await checkAndBuy();

  // Listen to balance changes on WebSocket
  console.log("👂 Listening for 0.2% fee deposits to goblin wallet...");
  connection.onAccountChange(
    goblinPubkey,
    (accInfo) => {
      const sol = accInfo.lamports / LAMPORTS_PER_SOL;
      console.log(`💰 Goblin Wallet received fee deposit! Balance: ${sol.toFixed(4)} SOL`);
      checkAndBuy();
    },
    "processed"
  );

  setInterval(checkAndBuy, 4000);
}

if (require.main === module) {
  runGoblinAutoBuyer().catch(console.error);
}

export { runGoblinAutoBuyer };
