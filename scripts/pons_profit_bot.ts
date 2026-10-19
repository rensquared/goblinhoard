import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const ETH_USD_PRICE = 2500; // Reference price for Mcap calculations

const CURVE_ABI = [
  "function quoteReserve() external view returns (uint256)",
  "function tokenReserve() external view returns (uint256)",
  "function sell(uint256 amountIn, uint256 minEthOut, address recipient) external returns (uint256 ethOut)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

async function main() {
  console.log("==================================================================");
  console.log("   HOARDED ($HOARD) - AGGRESSIVE SUB-25K PROFIT-TAKING BOT        ");
  console.log("   Prioritizing Rapid Extraction Under $15K - $25K                ");
  console.log("==================================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Load deployed token and curve addresses
  let curveAddress = process.env.CURVE_ADDRESS || "";
  let tokenAddress = process.env.TOKEN_ADDRESS || "";

  const receiptPath = path.resolve("./scratch/launch_receipt.json");
  if (!curveAddress && fs.existsSync(receiptPath)) {
    const rc = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    tokenAddress = rc.tokenAddress;
    curveAddress = rc.curveAddress;
  }

  // Fallback to test curve if not yet launched
  if (!curveAddress) {
    curveAddress = "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a";
    tokenAddress = "0xc9564cc1818b69E09789B1D67da684692A6daAA6";
  }

  console.log(`Monitoring Token: ${tokenAddress}`);
  console.log(`Monitoring Curve: ${curveAddress}\n`);

  const walletsPath = path.resolve("./wallets_hoard.json");
  if (!fs.existsSync(walletsPath)) throw new Error("wallets_hoard.json not found!");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  const curve = new ethers.Contract(curveAddress, CURVE_ABI, provider);
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  let t1Executed = false; // $9.5K Mcap
  let t2Executed = false; // $14.0K Mcap
  let t3Executed = false; // $18.5K Mcap
  let t4Executed = false; // $22.5K Mcap

  console.log("--- Profit Extraction Triggers (Front-Loaded Under $25K) ---");
  console.log(" Tier 1: $9,500 Mcap  -> Sell 60% Alpha Snipers (Wallets 1-3) [De-risks Principal]");
  console.log(" Tier 2: $14,000 Mcap -> Sell 70% Beta Swarm (Wallets 4-6) + 100% Alpha Snipers [Core Harvest]");
  console.log(" Tier 3: $18,500 Mcap -> Sell 80% Gamma Citadel (Wallets 7-9) + 100% Beta Swarm [High Profit]");
  console.log(" Tier 4: $22,500 Mcap -> Sell 100% Gamma Citadel + 50% Moonbag (Wallet 10) [Max Liquidation]");
  console.log("------------------------------------------------------------\n");

  const checkMcapAndSell = async () => {
    try {
      const quoteRes = await curve.quoteReserve();
      const tokenRes = await curve.tokenReserve();

      const priceEth = Number(quoteRes) / Number(tokenRes);
      const mcapEth = priceEth * 1_000_000_000;
      const mcapUsd = mcapEth * ETH_USD_PRICE;

      const timeStr = new Date().toLocaleTimeString();
      process.stdout.write(`\r[${timeStr}] Mcap: $${mcapUsd.toFixed(0)} (${mcapEth.toFixed(3)} ETH) | Quote Reserve: ${ethers.formatEther(quoteRes)} ETH `);

      // TIER 1: $9,500 Mcap
      if (mcapUsd >= 9500 && !t1Executed) {
        console.log("\n\n🚨 [TIER 1 TRIGGER ($9,500)] Securing principal! Selling 60% Alpha Snipers (Wallets 1-3)...");
        t1Executed = true;
        for (const sw of hoardData.subWallets.slice(0, 3)) {
          await executeSell(sw, 0.60, curveAddress, token, provider);
        }
      }

      // TIER 2: $14,000 Mcap (Right before the $15K barrier!)
      if (mcapUsd >= 14000 && !t2Executed) {
        console.log("\n\n🚨 [TIER 2 TRIGGER ($14,000)] Locking majority profits under $15K! Selling 70% Wallets 4-6 & closing Wallets 1-3...");
        t2Executed = true;
        for (const sw of hoardData.subWallets.slice(0, 3)) {
          await executeSell(sw, 1.0, curveAddress, token, provider); // Close remainder
        }
        for (const sw of hoardData.subWallets.slice(3, 6)) {
          await executeSell(sw, 0.70, curveAddress, token, provider);
        }
      }

      // TIER 3: $18,500 Mcap
      if (mcapUsd >= 18500 && !t3Executed) {
        console.log("\n\n🚨 [TIER 3 TRIGGER ($18,500)] Sweeping high-liquidity Tier 3! Selling 80% Wallets 7-9 & closing Wallets 4-6...");
        t3Executed = true;
        for (const sw of hoardData.subWallets.slice(3, 6)) {
          await executeSell(sw, 1.0, curveAddress, token, provider);
        }
        for (const sw of hoardData.subWallets.slice(6, 9)) {
          await executeSell(sw, 0.80, curveAddress, token, provider);
        }
      }

      // TIER 4: $22,500 Mcap (Hard ceiling exit!)
      if (mcapUsd >= 22500 && !t4Executed) {
        console.log("\n\n🚨 [TIER 4 CEILING TRIGGER ($22,500)] Cramp Exit! Liquidating remaining Citadel & 50% Moonbag...");
        t4Executed = true;
        for (const sw of hoardData.subWallets.slice(6, 9)) {
          await executeSell(sw, 1.0, curveAddress, token, provider);
        }
        // 50% Moonbag
        await executeSell(hoardData.subWallets[9], 0.50, curveAddress, token, provider);
      }
    } catch (err: any) {
      // quiet log on RPC hiccup
    }
  };

  await checkMcapAndSell();
  // Poll every 1.5 seconds for lightning reaction
  setInterval(checkMcapAndSell, 1500);
}

async function executeSell(sw: any, fraction: number, curveAddr: string, token: ethers.Contract, provider: ethers.Provider) {
  try {
    const wallet = new ethers.Wallet(sw.privateKey, provider);
    const curveWithSigner = new ethers.Contract(curveAddr, CURVE_ABI, wallet);
    const tokenWithSigner = new ethers.Contract(token.target, ERC20_ABI, wallet);

    const bal = await token.balanceOf(wallet.address);
    if (bal === 0n) return;

    const toSell = fraction >= 1.0 ? bal : (bal * BigInt(Math.floor(fraction * 100))) / 100n;
    console.log(`[SW ${sw.id} - ${sw.role}] Selling ${ethers.formatUnits(toSell, 18)} HOARD (${(fraction * 100).toFixed(0)}%)...`);

    // Ensure allowance (already pre-approved at launch, but safety check)
    const allowance = await token.allowance(wallet.address, curveAddr);
    if (allowance < toSell) {
      const appTx = await tokenWithSigner.approve(curveAddr, ethers.MaxUint256);
      await appTx.wait();
    }

    const tx = await curveWithSigner.sell(toSell, 0n, wallet.address, { gasLimit: 250000 });
    const receipt = await tx.wait();
    console.log(`[SW ${sw.id}] ✓ Sold in block ${receipt.blockNumber}! Tx: ${tx.hash}`);
  } catch (e: any) {
    console.error(`[SW ${sw.id}] Sell error:`, e.message);
  }
}

main().catch(console.error);
