import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import * as fs from "fs";
import bs58 from "bs58";
import { SOLANA_CONFIG } from "../config";
import { PumpFunService } from "../utils/pump";
import { JitoService } from "../utils/jito";
import { LaunchWalletsData } from "./generate_launch_wallets";

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("==================================================================");
  console.log("   HOARDED ($HOARD) - JITO ATOMIC BLOCK-0 BUNDLE LAUNCHER         ");
  console.log("   Target: Solana Mainnet / Pump.fun Bonding Curve                ");
  console.log(`   Mode:   ${isLive ? "🚨 LIVE EXECUTION 🚨" : "🛡️ DRY-RUN SIMULATION (Pass --live to execute)"}`);
  console.log("==================================================================\n");

  if (!fs.existsSync(SOLANA_CONFIG.walletsPath)) {
    throw new Error("wallets_hoard_sol.json not found! Run generate_launch_wallets.ts first.");
  }

  const walletsData: LaunchWalletsData = JSON.parse(fs.readFileSync(SOLANA_CONFIG.walletsPath, "utf8"));
  const connection = new Connection(SOLANA_CONFIG.mainnetRpc, "confirmed");

  // 1. Load Deployer
  const envPrivKey = process.env.SOLANA_PRIVATE_KEY;
  let deployerKp: Keypair;
  if (!envPrivKey) {
    if (isLive) {
      throw new Error("SOLANA_PRIVATE_KEY not found in .env! Required for --live execution.");
    } else {
      deployerKp = Keypair.generate();
      console.log(`ℹ️ No SOLANA_PRIVATE_KEY in .env, using generated mock deployer for dry-run: ${deployerKp.publicKey.toBase58()}`);
    }
  } else {
    deployerKp = Keypair.fromSecretKey(bs58.decode(envPrivKey));
  }

  // 2. Load or Generate Mint Keypair
  let mintKp: Keypair;
  if (fs.existsSync(SOLANA_CONFIG.vanityMintPath)) {
    const raw = JSON.parse(fs.readFileSync(SOLANA_CONFIG.vanityMintPath, "utf8"));
    mintKp = Keypair.fromSecretKey(bs58.decode(raw.secretKey));
    console.log(`Using Saved Vanity Mint: ${mintKp.publicKey.toBase58()}`);
  } else {
    mintKp = Keypair.generate();
    console.log(`Generated Fresh Mint: ${mintKp.publicKey.toBase58()}`);
  }

  const [bondingCurvePDA] = PumpFunService.getBondingCurvePDA(mintKp.publicKey);
  const associatedBondingCurve = PumpFunService.getAssociatedBondingCurve(mintKp.publicKey, bondingCurvePDA);

  console.log(`Bonding Curve PDA:        ${bondingCurvePDA.toBase58()}`);
  console.log(`Assoc Bonding Curve (ATA): ${associatedBondingCurve.toBase58()}`);
  console.log(`Deployer Wallet:          ${deployerKp.publicKey.toBase58()}`);
  console.log(`Token Name:               ${SOLANA_CONFIG.token.name} ($${SOLANA_CONFIG.token.symbol})`);
  console.log(`Metadata URI:             ${SOLANA_CONFIG.token.uri}\n`);

  // Check Deployer Balance
  const deployerBal = await connection.getBalance(deployerKp.publicKey).catch(() => 0);
  const deployerBalSol = deployerBal / LAMPORTS_PER_SOL;
  console.log(`Deployer Balance: ${deployerBalSol.toFixed(4)} SOL`);

  // Initial Virtual Curve Constants
  let virtualToken = 1073000000000000n;
  let virtualSol = 30000000000n; // 30 SOL

  console.log("\nSimulating Bonding Curve Buys across Bundle...");

  // Dev Buy Calculation
  const devBuyLamports = BigInt(Math.round(walletsData.devBuySol * LAMPORTS_PER_SOL));
  const devTokensOut = PumpFunService.calculateTokensOut(devBuyLamports, virtualSol, virtualToken);
  console.log(` - Dev Buy: ${walletsData.devBuySol} SOL -> ~${(Number(devTokensOut) / 1e6).toLocaleString()} HOARD`);

  // Update virtual reserves
  const devSolFee = (devBuyLamports * 99n) / 100n;
  virtualSol += devSolFee;
  virtualToken -= devTokensOut;

  // Sub-wallets Buy Calculations
  const subWalletBuys: { kp: Keypair; lamports: bigint; tokensOut: bigint; label: string }[] = [];
  for (const sw of walletsData.subWallets) {
    const swKp = Keypair.fromSecretKey(bs58.decode(sw.secretKey));
    const lamports = BigInt(Math.round(sw.buySol * LAMPORTS_PER_SOL));
    const tokens = PumpFunService.calculateTokensOut(lamports, virtualSol, virtualToken);
    console.log(` - ${sw.label}: ${sw.buySol} SOL -> ~${(Number(tokens) / 1e6).toLocaleString()} HOARD`);

    const fee = (lamports * 99n) / 100n;
    virtualSol += fee;
    virtualToken -= tokens;

    subWalletBuys.push({
      kp: swKp,
      lamports,
      tokensOut: tokens,
      label: sw.label
    });
  }

  // Fetch recent blockhash
  console.log("\nFetching recent blockhash from Solana RPC...");
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  // -------------------------------------------------------------
  // BUILD JITO BUNDLE (UP TO 5 VERSIONED TRANSACTIONS)
  // -------------------------------------------------------------
  const bundleTransactions: VersionedTransaction[] = [];

  // TX 1: Create Token + Deployer Dev Buy
  const devAta = getAssociatedTokenAddressSync(mintKp.publicKey, deployerKp.publicKey, true);
  const tx1Instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 450_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    PumpFunService.createTokenInstruction({
      mint: mintKp.publicKey,
      creator: deployerKp.publicKey,
      name: SOLANA_CONFIG.token.name,
      symbol: SOLANA_CONFIG.token.symbol,
      uri: SOLANA_CONFIG.token.uri
    }),
    createAssociatedTokenAccountIdempotentInstruction(
      deployerKp.publicKey,
      devAta,
      deployerKp.publicKey,
      mintKp.publicKey
    ),
    PumpFunService.createBuyInstruction({
      mint: mintKp.publicKey,
      buyer: deployerKp.publicKey,
      tokenAmount: devTokensOut,
      maxSolLamports: (devBuyLamports * 105n) / 100n // 5% slippage headroom for atomic inclusion
    })
  ];

  const msg1 = new TransactionMessage({
    payerKey: deployerKp.publicKey,
    recentBlockhash: blockhash,
    instructions: tx1Instructions
  }).compileToV0Message();

  const vtx1 = new VersionedTransaction(msg1);
  vtx1.sign([deployerKp, mintKp]);
  bundleTransactions.push(vtx1);

  // Helper to build a sub-wallets buy transaction
  const buildSubWalletTx = (swSlice: typeof subWalletBuys) => {
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 * swSlice.length }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    ];
    const signers = [deployerKp];

    for (const item of swSlice) {
      const ata = getAssociatedTokenAddressSync(mintKp.publicKey, item.kp.publicKey, true);
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          deployerKp.publicKey, // Deployer pays rent for ATA
          ata,
          item.kp.publicKey,
          mintKp.publicKey
        ),
        PumpFunService.createBuyInstruction({
          mint: mintKp.publicKey,
          buyer: item.kp.publicKey,
          tokenAmount: item.tokensOut,
          maxSolLamports: (item.lamports * 110n) / 100n
        })
      );
      signers.push(item.kp);
    }

    const msg = new TransactionMessage({
      payerKey: deployerKp.publicKey,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message();

    const vtx = new VersionedTransaction(msg);
    vtx.sign(signers);
    return vtx;
  };

  // TX 2: Sub-wallets 1-3 (Alpha Snipers)
  bundleTransactions.push(buildSubWalletTx(subWalletBuys.slice(0, 3)));

  // TX 3: Sub-wallets 4-6 (Beta Swarm)
  bundleTransactions.push(buildSubWalletTx(subWalletBuys.slice(3, 6)));

  // TX 4: Sub-wallets 7-10 (Gamma Citadel + Moonbag)
  bundleTransactions.push(buildSubWalletTx(subWalletBuys.slice(6, 10)));

  // TX 5: Jito Validator Tip
  const tipAccount = JitoService.getRandomTipAccount();
  const tipLamports = BigInt(Math.round(walletsData.jitoTipSol * LAMPORTS_PER_SOL));
  const tx5Instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
    JitoService.createTipInstruction(deployerKp.publicKey, tipLamports, tipAccount)
  ];

  const msg5 = new TransactionMessage({
    payerKey: deployerKp.publicKey,
    recentBlockhash: blockhash,
    instructions: tx5Instructions
  }).compileToV0Message();

  const vtx5 = new VersionedTransaction(msg5);
  vtx5.sign([deployerKp]);
  bundleTransactions.push(vtx5);

  console.log(`\nConstructed ${bundleTransactions.length} Versioned Transactions for Atomic Jito Bundle:`);
  console.log(` - Tx 1: Token Creation + Dev Initial Snipe (${walletsData.devBuySol} SOL)`);
  console.log(` - Tx 2: Alpha Snipers (Wallets 1-3)`);
  console.log(` - Tx 3: Beta Swarm (Wallets 4-6)`);
  console.log(` - Tx 4: Gamma Citadel & Moonbag (Wallets 7-10)`);
  console.log(` - Tx 5: Jito Tip (${walletsData.jitoTipSol} SOL to ${tipAccount.toBase58().slice(0, 8)}...)`);

  if (!isLive) {
    console.log("\n==================================================================");
    console.log("🛡️ DRY-RUN COMPLETED SUCCESSFULLY!");
    console.log("To broadcast to Jito Block Engine on Mainnet, run with --live:");
    console.log("  npx ts-node solana/scripts/launch_jito_bundle.ts --live");
    console.log("==================================================================\n");
    return;
  }

  // LIVE EXECUTION
  console.log("\n🚨 SENDING ATOMIC BUNDLE TO JITO BLOCK ENGINE...");
  const bundleResult = await JitoService.sendBundle(bundleTransactions);

  if (!bundleResult.success || !bundleResult.bundleId) {
    throw new Error(`Jito Bundle submission failed: ${bundleResult.error}`);
  }

  console.log(`✓ Jito Bundle Accepted! Bundle UUID: ${bundleResult.bundleId}`);
  console.log("Waiting for slot confirmation...");

  // Save Launch Receipt
  const receipt = {
    network: "solana-mainnet",
    launchedAt: new Date().toISOString(),
    bundleId: bundleResult.bundleId,
    mintAddress: mintKp.publicKey.toBase58(),
    bondingCurveAddress: bondingCurvePDA.toBase58(),
    associatedBondingCurve: associatedBondingCurve.toBase58(),
    deployerAddress: deployerKp.publicKey.toBase58(),
    devBuySol: walletsData.devBuySol,
    subWalletsCount: walletsData.subWallets.length,
    dexScreenerUrl: `https://dexscreener.com/solana/${mintKp.publicKey.toBase58()}`,
    photonUrl: `https://photon-sol.tinyastro.io/en/lp/${bondingCurvePDA.toBase58()}`,
    solscanUrl: `https://solscan.io/token/${mintKp.publicKey.toBase58()}`
  };

  fs.writeFileSync(SOLANA_CONFIG.receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  console.log("\n==================================================================");
  console.log("🎉 ATOMIC LAUNCH EXECUTED IN SLOT 0!");
  console.log("==================================================================");
  console.log(`Mint Address:   ${receipt.mintAddress}`);
  console.log(`Bonding Curve:  ${receipt.bondingCurveAddress}`);
  console.log(`DexScreener:    ${receipt.dexScreenerUrl}`);
  console.log(`Photon:         ${receipt.photonUrl}`);
  console.log(`Receipt saved:  ${SOLANA_CONFIG.receiptPath}`);
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("Launch error:", err);
  process.exit(1);
});
