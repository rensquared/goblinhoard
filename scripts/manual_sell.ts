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
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY missing in .env");
  const deployer = new ethers.Wallet(privKey, provider);

  // Parse CLI args
  const args = process.argv.slice(2);
  let pct = 100; // default 100%
  let targetWalletId: number | null = null;
  let isSweep = args.includes("--sweep");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pct" && args[i + 1]) pct = parseInt(args[i + 1]);
    if (args[i] === "--wallet" && args[i + 1]) targetWalletId = parseInt(args[i + 1]);
  }

  // Load contract addresses
  let curveAddress = process.env.CURVE_ADDRESS || "";
  let tokenAddress = process.env.TOKEN_ADDRESS || "";
  const receiptPath = path.resolve("./scratch/launch_receipt.json");
  if (!curveAddress && fs.existsSync(receiptPath)) {
    const rc = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    tokenAddress = rc.tokenAddress;
    curveAddress = rc.curveAddress;
  }
  if (!curveAddress) {
    curveAddress = "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a";
    tokenAddress = "0xc9564cc1818b69E09789B1D67da684692A6daAA6";
  }

  const walletsPath = path.resolve("./wallets_hoard.json");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  console.log("==================================================================");
  console.log("       MANUAL ON-DEMAND EXECUTION ENGINE FOR HOARDED              ");
  console.log(`Action: ${isSweep ? "SWEEP ETH TO DEPLOYER" : `SELL ${pct}% OF TOKENS`}`);
  if (targetWalletId) console.log(`Target: Wallet ${targetWalletId} only`);
  console.log("==================================================================\n");

  const targetWallets = targetWalletId
    ? hoardData.subWallets.filter((w: any) => w.id === targetWalletId)
    : hoardData.subWallets;

  if (!isSweep) {
    for (const sw of targetWallets) {
      const wallet = new ethers.Wallet(sw.privateKey, provider);
      const bal = await token.balanceOf(wallet.address);
      if (bal === 0n) continue;

      const toSell = pct >= 100 ? bal : (bal * BigInt(pct)) / 100n;
      console.log(`[SW ${sw.id} - ${sw.role}] Selling ${ethers.formatUnits(toSell, 18)} tokens (${pct}%)...`);

      const curveWithSigner = new ethers.Contract(curveAddress, CURVE_ABI, wallet);
      const tokenWithSigner = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

      const allowance = await token.allowance(wallet.address, curveAddress);
      if (allowance < toSell) {
        const appTx = await tokenWithSigner.approve(curveAddress, ethers.MaxUint256);
        await appTx.wait();
      }

      const tx = await curveWithSigner.sell(toSell, 0n, wallet.address, { gasLimit: 250000 });
      const receipt = await tx.wait();
      console.log(`[SW ${sw.id}] ✓ Confirmed in block ${receipt.blockNumber}! Tx: ${tx.hash}`);
    }
  }

  if (isSweep) {
    console.log(`\nSweeping native ETH to Deployer (${deployer.address})...`);
    for (const sw of targetWallets) {
      const wallet = new ethers.Wallet(sw.privateKey, provider);
      const ethBal = await provider.getBalance(wallet.address);
      const gasBuffer = ethers.parseEther("0.000001");
      if (ethBal > gasBuffer) {
        const sendAmount = ethBal - gasBuffer;
        console.log(`[SW ${sw.id}] Sweeping ${ethers.formatEther(sendAmount)} ETH...`);
        const tx = await wallet.sendTransaction({
          to: deployer.address,
          value: sendAmount,
          gasLimit: 21000
        });
        await tx.wait();
        console.log(`[SW ${sw.id}] ✓ Swept! Tx: ${tx.hash}`);
      }
    }
  }

  const finalDeployerBal = await provider.getBalance(deployer.address);
  console.log(`\nDeployer Balance: ${ethers.formatEther(finalDeployerBal)} ETH`);
  console.log("==================================================================");
}

main().catch(console.error);
