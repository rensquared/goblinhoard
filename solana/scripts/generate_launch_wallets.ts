import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import bs58 from "bs58";
import { SOLANA_CONFIG } from "../config";
import { VanityGrinder } from "../utils/vanity";

export interface SubWalletConfig {
  index: number;
  role: "alpha_sniper" | "beta_swarm" | "gamma_citadel" | "moonbag";
  label: string;
  address: string;
  secretKey: string;
  buySol: number;
}

export interface LaunchWalletsData {
  network: string;
  createdAt: string;
  totalBudgetSol: number;
  devBuySol: number;
  jitoTipSol: number;
  gasBufferSol: number;
  deployerAddress: string;
  subWallets: SubWalletConfig[];
}

async function main() {
  const grindVanity = process.argv.includes("--vanity");
  const vanityPrefix = "food"; // Goblin lore vanity

  console.log("==================================================================");
  console.log("   HOARDED ($HOARD) - SOLANA SUB-WALLET GENERATION & SETUP        ");
  console.log("==================================================================");
  console.log(`Mode: ${grindVanity ? `Vanity Prefix grinding ("${vanityPrefix}...")` : "Fast Random Keypairs"}\n`);

  // 1. Deployer Keypair
  let deployerKp: Keypair;
  const envPrivKey = process.env.SOLANA_PRIVATE_KEY;

  if (envPrivKey) {
    try {
      const decoded = bs58.decode(envPrivKey);
      deployerKp = Keypair.fromSecretKey(decoded);
      console.log(`Using existing Deployer from .env: ${deployerKp.publicKey.toBase58()}`);
    } catch {
      console.warn("Failed to parse SOLANA_PRIVATE_KEY in .env, generating fresh deployer...");
      deployerKp = Keypair.generate();
    }
  } else {
    deployerKp = Keypair.generate();
    console.log(`Generated new Deployer: ${deployerKp.publicKey.toBase58()}`);
  }

  // Budget Breakdown (Example 2.0 SOL total launch budget, scalable)
  const totalBudgetSol = 2.0;
  const devBuySol = 0.40;
  const jitoTipSol = 0.01;
  const gasBufferSol = 0.09;
  const subWalletsPoolSol = totalBudgetSol - devBuySol - jitoTipSol - gasBufferSol; // 1.50 SOL

  // 10 Sub-Wallets distribution matching the multi-tier profit taking strategy
  const allocations = [
    { index: 1, role: "alpha_sniper", label: "Alpha Sniper 1", pct: 0.12 },
    { index: 2, role: "alpha_sniper", label: "Alpha Sniper 2", pct: 0.12 },
    { index: 3, role: "alpha_sniper", label: "Alpha Sniper 3", pct: 0.12 },
    { index: 4, role: "beta_swarm", label: "Beta Swarm 1", pct: 0.10 },
    { index: 5, role: "beta_swarm", label: "Beta Swarm 2", pct: 0.10 },
    { index: 6, role: "beta_swarm", label: "Beta Swarm 3", pct: 0.10 },
    { index: 7, role: "gamma_citadel", label: "Gamma Citadel 1", pct: 0.10 },
    { index: 8, role: "gamma_citadel", label: "Gamma Citadel 2", pct: 0.10 },
    { index: 9, role: "gamma_citadel", label: "Gamma Citadel 3", pct: 0.10 },
    { index: 10, role: "moonbag", label: "Moonbag Goblin 10", pct: 0.14 }
  ];

  const subWallets: SubWalletConfig[] = [];

  for (const alloc of allocations) {
    let kp: Keypair;
    if (grindVanity) {
      process.stdout.write(`Grinding vanity goblin for ${alloc.label}... `);
      const res = VanityGrinder.grindKeypair({ prefix: vanityPrefix, caseSensitive: false, maxAttempts: 500_000 });
      kp = Keypair.fromSecretKey(bs58.decode(res.secretKey));
      console.log(`Found: ${res.address} (${res.attempts} attempts)`);
    } else {
      kp = Keypair.generate();
    }

    const buySol = Number((subWalletsPoolSol * alloc.pct).toFixed(4));

    subWallets.push({
      index: alloc.index,
      role: alloc.role as any,
      label: alloc.label,
      address: kp.publicKey.toBase58(),
      secretKey: bs58.encode(kp.secretKey),
      buySol
    });
  }

  const outputData: LaunchWalletsData = {
    network: "solana-mainnet",
    createdAt: new Date().toISOString(),
    totalBudgetSol,
    devBuySol,
    jitoTipSol,
    gasBufferSol,
    deployerAddress: deployerKp.publicKey.toBase58(),
    subWallets
  };

  fs.writeFileSync(SOLANA_CONFIG.walletsPath, JSON.stringify(outputData, null, 2), "utf8");

  console.log("\n==================================================================");
  console.log("   WALLET GENERATION COMPLETE");
  console.log("==================================================================");
  console.log(`File saved: ${SOLANA_CONFIG.walletsPath}`);
  console.log(`Deployer Address:    ${outputData.deployerAddress}`);
  console.log(`Total Sub-Wallets:   ${subWallets.length}`);
  console.log(`Dev Buy Allocation:  ${devBuySol} SOL`);
  console.log(`Sub-Wallets Total:   ${(totalBudgetSol - devBuySol - jitoTipSol - gasBufferSol).toFixed(2)} SOL`);
  console.log(`Jito Tip Allocation: ${jitoTipSol} SOL`);
  console.log(`Gas Buffer:          ${gasBufferSol} SOL`);
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("Error generating wallets:", err);
  process.exit(1);
});
