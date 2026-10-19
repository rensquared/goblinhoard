import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as fs from "fs";
import bs58 from "bs58";
import fetch from "node-fetch";
import { SOLANA_CONFIG } from "../config";
import { PumpFunService, BondingCurveState } from "../utils/pump";
import { LaunchWalletsData, SubWalletConfig } from "./generate_launch_wallets";

// Default reference SOL price in USD (updated dynamically via CoinGecko/Pyth/Binance if online)
let SOL_USD_PRICE = 160.0;

async function updateSolPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const json = (await res.json()) as any;
    if (json?.solana?.usd) {
      SOL_USD_PRICE = json.solana.usd;
    }
  } catch {
    // Keep fallback price
  }
  return SOL_USD_PRICE;
}

async function executeSubWalletSell(params: {
  connection: Connection;
  subWallet: SubWalletConfig;
  percentage: number; // 0.10 to 1.0 (10% to 100%)
  mint: PublicKey;
  bondingCurvePDA: PublicKey;
  curveState: BondingCurveState;
  isLive: boolean;
}): Promise<boolean> {
  const { connection, subWallet, percentage, mint, bondingCurvePDA, curveState, isLive } = params;
  const swKp = Keypair.fromSecretKey(bs58.decode(subWallet.secretKey));
  const ata = getAssociatedTokenAddressSync(mint, swKp.publicKey, true);

  // Check token balance
  let tokenBal = 0n;
  try {
    const acc = await connection.getTokenAccountBalance(ata);
    tokenBal = BigInt(acc.value.amount);
  } catch {
    console.log(`[${subWallet.label}] No token balance or ATA found.`);
    return false;
  }

  if (tokenBal <= 0n) {
    console.log(`[${subWallet.label}] Token balance is 0.`);
    return false;
  }

  const sellAmount = (tokenBal * BigInt(Math.round(percentage * 100))) / 100n;
  if (sellAmount <= 0n) return false;

  const minSolOut = PumpFunService.calculateSolOut(
    sellAmount,
    curveState.virtualSolReserves,
    curveState.virtualTokenReserves
  );
  // Allow 15% slippage for fast profit extraction
  const minSolWithSlippage = (minSolOut * 85n) / 100n;

  console.log(
    ` ⚡ Selling ${(Number(sellAmount) / 1e6).toLocaleString()} HOARD (${(percentage * 100).toFixed(0)}%) from ${subWallet.label}... Min SOL: ${(Number(minSolWithSlippage) / LAMPORTS_PER_SOL).toFixed(4)}`
  );

  if (!isLive) {
    console.log(`    [DRY-RUN] Sell simulated successfully.`);
    return true;
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250_000 }), // Fast inclusion priority fee
    PumpFunService.createSellInstruction({
      mint,
      seller: swKp.publicKey,
      tokenAmount: sellAmount,
      minSolLamports: minSolWithSlippage
    })
  ];

  const msg = new TransactionMessage({
    payerKey: swKp.publicKey,
    recentBlockhash: blockhash,
    instructions
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([swKp]);

  try {
    const sig = await connection.sendTransaction(tx, { skipPreflight: true, maxRetries: 3 });
    console.log(`    ✓ Sell Broadcast! Tx: https://solscan.io/tx/${sig}`);
    return true;
  } catch (err: any) {
    console.error(`    ✗ Sell failed for ${subWallet.label}: ${err.message}`);
    return false;
  }
}

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("==================================================================");
  console.log("   HOARDED ($HOARD) - AGGRESSIVE SOLANA SUB-25K PROFIT BOT        ");
  console.log("   High-Speed On-Chain Monitoring with Tiered Extraction          ");
  console.log(`   Mode: ${isLive ? "🚨 LIVE EXECUTION 🚨" : "🛡️ DRY-RUN SIMULATION (Pass --live to execute)"}`);
  console.log("==================================================================\n");

  if (!fs.existsSync(SOLANA_CONFIG.walletsPath)) {
    throw new Error("wallets_hoard_sol.json not found!");
  }
  const walletsData: LaunchWalletsData = JSON.parse(fs.readFileSync(SOLANA_CONFIG.walletsPath, "utf8"));

  // Load Mint & Bonding Curve from Receipt or .env
  let mintStr = process.env.SOLANA_MINT_ADDRESS || "";
  let curveStr = process.env.SOLANA_BONDING_CURVE || "";

  if (fs.existsSync(SOLANA_CONFIG.receiptPath)) {
    const rc = JSON.parse(fs.readFileSync(SOLANA_CONFIG.receiptPath, "utf8"));
    if (rc.mintAddress) mintStr = rc.mintAddress;
    if (rc.bondingCurveAddress) curveStr = rc.bondingCurveAddress;
  }

  if (!mintStr) {
    // If no mint yet, use mock/fallback for testing
    mintStr = "5HB7GiHQDSGzfFej2VPodW5F1zHvr6AxikFDarhVoGTf";
    console.warn(`No SOLANA_MINT_ADDRESS found, using placeholder mint: ${mintStr}`);
  }

  const mint = new PublicKey(mintStr);
  const [bondingCurvePDA] = curveStr ? [new PublicKey(curveStr)] : PumpFunService.getBondingCurvePDA(mint);

  console.log(`Monitoring Mint:          ${mint.toBase58()}`);
  console.log(`Bonding Curve PDA:        ${bondingCurvePDA.toBase58()}`);
  await updateSolPrice();
  console.log(`Current SOL Reference:    $${SOL_USD_PRICE.toFixed(2)} USD\n`);

  console.log("--- Profit Extraction Triggers (Front-Loaded Under $25K) ---");
  console.log(" Tier 1: $9,500 Mcap  -> Sell 60% Alpha Snipers (Wallets 1-3) [De-risks Principal]");
  console.log(" Tier 2: $14,000 Mcap -> Sell 70% Beta Swarm (Wallets 4-6) + 100% Alpha Snipers [Core Harvest]");
  console.log(" Tier 3: $18,500 Mcap -> Sell 80% Gamma Citadel (Wallets 7-9) + 100% Beta Swarm [High Profit]");
  console.log(" Tier 4: $22,500 Mcap -> Sell 100% Gamma Citadel + 50% Moonbag (Wallet 10) [Max Liquidation]");
  console.log("------------------------------------------------------------\n");

  const connection = new Connection(SOLANA_CONFIG.mainnetRpc, "confirmed");

  let t1Done = false;
  let t2Done = false;
  let t3Done = false;
  let t4Done = false;

  const pollIntervalMs = 1500; // Sub-2 second polling

  const checkAndExecute = async () => {
    try {
      const accInfo = await connection.getAccountInfo(bondingCurvePDA);
      if (!accInfo || !accInfo.data) {
        process.stdout.write(`\r[${new Date().toLocaleTimeString()}] Waiting for Bonding Curve initialization on-chain...`);
        return;
      }

      const curveState = PumpFunService.parseBondingCurveState(accInfo.data as Buffer);

      // Price = virtualSolReserves / virtualTokenReserves
      const vSol = Number(curveState.virtualSolReserves) / LAMPORTS_PER_SOL;
      const vTok = Number(curveState.virtualTokenReserves) / 1e6;
      const priceSol = vTok > 0 ? vSol / vTok : 0;
      const priceUsd = priceSol * SOL_USD_PRICE;
      const mcapUsd = priceUsd * 1_000_000_000;
      const realSol = Number(curveState.realSolReserves) / LAMPORTS_PER_SOL;

      process.stdout.write(
        `\r[${new Date().toLocaleTimeString()}] Mcap: $${mcapUsd.toFixed(0)} | Price: $${priceUsd.toFixed(6)} | Real SOL: ${realSol.toFixed(2)} SOL `
      );

      // TIER 1: $9,500 Mcap
      if (mcapUsd >= 9500 && !t1Done) {
        console.log("\n\n🚨 [TIER 1 TRIGGER ($9,500)] Securing principal! Selling 60% Alpha Snipers (Wallets 1-3)...");
        t1Done = true;
        for (const sw of walletsData.subWallets.slice(0, 3)) {
          await executeSubWalletSell({
            connection,
            subWallet: sw,
            percentage: 0.6,
            mint,
            bondingCurvePDA,
            curveState,
            isLive
          });
        }
      }

      // TIER 2: $14,000 Mcap
      if (mcapUsd >= 14000 && !t2Done) {
        console.log("\n\n🚨 [TIER 2 TRIGGER ($14,000)] Locking majority profits! Selling 70% Wallets 4-6 & closing Wallets 1-3...");
        t2Done = true;
        for (const sw of walletsData.subWallets.slice(0, 3)) {
          await executeSubWalletSell({
            connection,
            subWallet: sw,
            percentage: 1.0,
            mint,
            bondingCurvePDA,
            curveState,
            isLive
          });
        }
        for (const sw of walletsData.subWallets.slice(3, 6)) {
          await executeSubWalletSell({
            connection,
            subWallet: sw,
            percentage: 0.7,
            mint,
            bondingCurvePDA,
            curveState,
            isLive
          });
        }
      }

      // TIER 3: $18,500 Mcap
      if (mcapUsd >= 18500 && !t3Done) {
        console.log("\n\n🚨 [TIER 3 TRIGGER ($18,500)] Locking high tier profits! Selling 80% Wallets 7-9 & closing Wallets 4-6...");
        t3Done = true;
        for (const sw of walletsData.subWallets.slice(3, 6)) {
          await executeSubWalletSell({
            connection,
            subWallet: sw,
            percentage: 1.0,
            mint,
            bondingCurvePDA,
            curveState,
            isLive
          });
        }
        for (const sw of walletsData.subWallets.slice(6, 9)) {
          await executeSubWalletSell({
            connection,
            subWallet: sw,
            percentage: 0.8,
            mint,
            bondingCurvePDA,
            curveState,
            isLive
          });
        }
      }

      // TIER 4: $22,500 Mcap
      if (mcapUsd >= 22500 && !t4Done) {
        console.log("\n\n🚨 [TIER 4 TRIGGER ($22,500)] Final pre-migration profit sweep! Closing Wallets 7-9 + 50% Moonbag...");
        t4Done = true;
        for (const sw of walletsData.subWallets.slice(6, 9)) {
          await executeSubWalletSell({
            connection,
            subWallet: sw,
            percentage: 1.0,
            mint,
            bondingCurvePDA,
            curveState,
            isLive
          });
        }
        const moonbag = walletsData.subWallets[9];
        if (moonbag) {
          await executeSubWalletSell({
            connection,
            subWallet: moonbag,
            percentage: 0.5,
            mint,
            bondingCurvePDA,
            curveState,
            isLive
          });
        }
      }
    } catch (err: any) {
      // Ignore transient network errors
    }
  };

  // Run initial check and set interval
  await checkAndExecute();
  setInterval(checkAndExecute, pollIntervalMs);
}

main().catch((err) => {
  console.error("Bot encountered fatal error:", err);
  process.exit(1);
});
