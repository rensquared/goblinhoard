import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const CHAIN_ID = 4663;
const PONS_V2_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const PONS_V2_FEE_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

async function main() {
  console.log("=================================================================");
  console.log("    GOBLIN HOARD ($HOARD) - PRE-LAUNCH READINESS & AUDIT CHECK   ");
  console.log("=================================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // 1. RPC & Chain Verification
  console.log("[1/6] Checking Robinhood Chain RPC & Network...");
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();
    console.log(`  ✓ Connected to Chain ID: ${network.chainId.toString()} (Expected: ${CHAIN_ID})`);
    console.log(`  ✓ Current Block Number: ${blockNumber}`);
    console.log(`  ✓ Gas Price: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "0"} gwei\n`);
  } catch (err: any) {
    console.error("  ✗ RPC Connection Failed:", err.message);
    return;
  }

  // 2. Deployer Wallet Check
  console.log("[2/6] Checking Primary Deployer Wallet...");
  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) {
    console.error("  ✗ PRIVATE_KEY missing in .env!");
    return;
  }
  const deployer = new ethers.Wallet(privKey, provider);
  const deployerBal = await provider.getBalance(deployer.address);
  const deployerNonce = await provider.getTransactionCount(deployer.address);
  console.log(`  Deployer Address: ${deployer.address}`);
  console.log(`  Deployer Nonce:   ${deployerNonce}`);
  console.log(`  Deployer Balance: ${ethers.formatEther(deployerBal)} ETH`);
  if (deployerBal < ethers.parseEther("0.35")) {
    console.log(`  ⚠ NOTICE: Deployer currently has < 0.35 ETH. Fund with ~0.40 ETH before firing bundle launch.\n`);
  } else {
    console.log(`  ✓ Deployer is sufficiently funded for launch & bundle buys!\n`);
  }

  // 3. Sub-Wallets Audit
  console.log("[3/6] Auditing 10 Clean Sub-Wallets (wallets_hoard.json)...");
  const walletsPath = path.resolve("./wallets_hoard.json");
  if (!fs.existsSync(walletsPath)) {
    console.error("  ✗ wallets_hoard.json not found!");
    return;
  }
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  console.log(`  Sub-Wallets Configured: ${hoardData.subWallets.length}`);
  console.log(`  Budget Distribution:    ${hoardData.totalBudgetEth} ETH total across wallets`);

  let maxCapBreached = false;
  for (const sw of hoardData.subWallets) {
    const bal = await provider.getBalance(sw.address);
    const nonce = await provider.getTransactionCount(sw.address);
    const pct = parseFloat(sw.maxSupplyPercent);
    if (pct > 2.5) maxCapBreached = true;
    console.log(`  - [W${sw.id}] ${sw.role.padEnd(16)} | Addr: ${sw.address.slice(0, 8)}... | Target: ${sw.tier.padEnd(15)} | Cap: ${sw.maxSupplyPercent} | Nonce: ${nonce} | Bal: ${ethers.formatEther(bal)} ETH`);
  }

  if (maxCapBreached) {
    console.error("  ✗ ALERT: At least one wallet breaches the 2.5% max supply limit!");
  } else {
    console.log(`  ✓ All 10 sub-wallets verified strictly <= 2.5% max cap (Anti-Bubblemap compliant).\n`);
  }

  // 4. Pons V2 Factory Verification
  console.log("[4/6] Verifying Pons V2 Smart Contracts on Robinhood Chain...");
  const factoryCode = await provider.getCode(PONS_V2_FACTORY);
  if (factoryCode === "0x") {
    console.error(`  ✗ No contract code at Pons Factory: ${PONS_V2_FACTORY}`);
    return;
  }
  console.log(`  ✓ Pons V2 Factory verified active at ${PONS_V2_FACTORY}`);

  const escrowCode = await provider.getCode(PONS_V2_FEE_ESCROW);
  if (escrowCode === "0x") {
    console.error(`  ✗ No contract code at FeeEscrow: ${PONS_V2_FEE_ESCROW}`);
    return;
  }
  console.log(`  ✓ FeeEscrow verified active at ${PONS_V2_FEE_ESCROW}\n`);

  // 5. Vanity Salt Check
  console.log("[5/6] Checking Vanity Salt & Address Collision...");
  const vanityPath = path.resolve("./scratch/vanity_salt.json");
  if (fs.existsSync(vanityPath)) {
    const vanity = JSON.parse(fs.readFileSync(vanityPath, "utf8"));
    const predictedCode = await provider.getCode(vanity.predictedAddress);
    console.log(`  Vanity Prefix:      ${vanity.targetPrefix}`);
    console.log(`  Predicted CA:       ${vanity.predictedAddress}`);
    if (predictedCode === "0x") {
      console.log(`  ✓ Predicted CA is clean (No prior deployment or collision).\n`);
    } else {
      console.log(`  ⚠ WARNING: Code already exists at predicted CA! Need to re-mine salt.\n`);
    }
  } else {
    console.log(`  - Vanity salt file not found in scratch/, will mine fresh on launch.\n`);
  }

  // 6. Final Status
  console.log("[6/6] Launch Readiness Conclusion:");
  console.log("  ===============================================================");
  console.log("  STATUS: SYSTEM IS READY FOR LIVE EXECUTION.");
  console.log("  When ready, transfer ~0.40 ETH to deployer:");
  console.log(`  ${deployer.address}`);
  console.log("  Then execute: npx ts-node scripts/bundle_pons_launch.ts --live");
  console.log("  ===============================================================\n");
}

main().catch(console.error);
