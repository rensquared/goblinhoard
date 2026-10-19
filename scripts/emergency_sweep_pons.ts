import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";

const CURVE_ABI = [
  "function sell(uint256 amountIn, uint256 minEthOut, address recipient) external returns (uint256 ethOut)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

async function main() {
  console.log("==========================================================");
  console.log("   GOBLIN HOARD - MASTER EMERGENCY SWEEP & CONSOLIDATION  ");
  console.log("==========================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY not found in .env");
  const deployer = new ethers.Wallet(privKey, provider);

  console.log(`Consolidation Target (Deployer): ${deployer.address}`);

  const walletsPath = path.resolve("./wallets_hoard.json");
  if (!fs.existsSync(walletsPath)) throw new Error("wallets_hoard.json not found!");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  // Check receipt for curve and token
  let curveAddress = "";
  let tokenAddress = "";
  const receiptPath = path.resolve("./scratch/launch_receipt.json");
  if (fs.existsSync(receiptPath)) {
    const rc = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    tokenAddress = rc.tokenAddress;
    curveAddress = rc.curveAddress;
  }
  if (!curveAddress) {
    curveAddress = "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a";
    tokenAddress = "0xc9564cc1818b69E09789B1D67da684692A6daAA6";
  }

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  console.log(`\n[STEP 1] Liquidating any remaining tokens across sub-wallets...`);
  for (const sw of hoardData.subWallets) {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const bal = await token.balanceOf(swWallet.address);

    if (bal > 0n) {
      console.log(`[SW ${sw.id}] Selling all ${ethers.formatUnits(bal, 18)} tokens...`);
      const curve = new ethers.Contract(curveAddress, CURVE_ABI, swWallet);
      const tokenWithSigner = new ethers.Contract(tokenAddress, ERC20_ABI, swWallet);

      const allowance = await token.allowance(swWallet.address, curveAddress);
      if (allowance < bal) {
        const appTx = await tokenWithSigner.approve(curveAddress, ethers.MaxUint256);
        await appTx.wait();
      }

      const sellTx = await curve.sell(bal, 0n, swWallet.address, { gasLimit: 250000 });
      await sellTx.wait();
      console.log(`[SW ${sw.id}] ✓ Liquidated!`);
    }
  }

  console.log(`\n[STEP 2] Sweeping all native ETH back to Deployer (${deployer.address})...`);
  for (const sw of hoardData.subWallets) {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const ethBal = await provider.getBalance(swWallet.address);

    // Keep minimal gas for transfer (~21,000 gas * 0.03 gwei = 0.00000063 ETH)
    const gasReserve = ethers.parseEther("0.000001");
    if (ethBal > gasReserve) {
      const sweepAmount = ethBal - gasReserve;
      console.log(`[SW ${sw.id}] Sweeping ${ethers.formatEther(sweepAmount)} ETH...`);
      const sweepTx = await swWallet.sendTransaction({
        to: deployer.address,
        value: sweepAmount,
        gasLimit: 21000
      });
      await sweepTx.wait();
      console.log(`[SW ${sw.id}] ✓ Swept! Tx: ${sweepTx.hash}`);
    }
  }

  const finalBal = await provider.getBalance(deployer.address);
  console.log("\n==========================================================");
  console.log(`✓ ALL ETH CONSOLIDATED! Deployer Balance: ${ethers.formatEther(finalBal)} ETH`);
  console.log("==========================================================");
}

main().catch(console.error);
