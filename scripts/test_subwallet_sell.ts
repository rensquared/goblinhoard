import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const CURVE_ADDRESS = "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a";
const TOKEN_ADDRESS = "0xc9564cc1818b69E09789B1D67da684692A6daAA6";

const CURVE_ABI = [
  "function sell(uint256 amountIn, uint256 minEthOut, address recipient) external returns (uint256 ethOut)",
  "function creatorTaxBalance() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

async function main() {
  console.log("==================================================================");
  console.log("     SUB-WALLET SELL / PROFIT-TAKING TEST ON ROBINHOOD MAINNET   ");
  console.log("==================================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const walletsPath = path.resolve("./wallets_hoard.json");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const sw1 = hoardData.subWallets[0];
  const wallet = new ethers.Wallet(sw1.privateKey, provider);

  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);
  const curve = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, wallet);

  const tokenBal = await token.balanceOf(wallet.address);
  const ethBalBefore = await provider.getBalance(wallet.address);

  console.log(`Sub-Wallet 1: ${wallet.address}`);
  console.log(`Token Balance: ${ethers.formatUnits(tokenBal, 18)} GTEST`);
  console.log(`ETH Balance:   ${ethers.formatEther(ethBalBefore)} ETH\n`);

  // Sell 50,000 tokens
  const sellAmount = ethers.parseUnits("50000", 18);
  console.log(`Approving curve to spend 50,000 GTEST...`);
  const approveTx = await token.approve(CURVE_ADDRESS, ethers.MaxUint256);
  await approveTx.wait();
  console.log(`✓ Approved!`);

  console.log(`Executing sell of 50,000 GTEST...`);
  const sellTx = await curve.sell(sellAmount, 0n, wallet.address, { gasLimit: 250000 });
  const receipt = await sellTx.wait();
  console.log(`✓ Sell confirmed in block ${receipt.blockNumber}! Tx: ${sellTx.hash}`);

  const ethBalAfter = await provider.getBalance(wallet.address);
  const tokenBalAfter = await token.balanceOf(wallet.address);
  console.log(`\nNew Token Balance: ${ethers.formatUnits(tokenBalAfter, 18)} GTEST`);
  console.log(`New ETH Balance:   ${ethers.formatEther(ethBalAfter)} ETH`);
  console.log(`ETH Recovered:     +${ethers.formatEther(ethBalAfter - ethBalBefore)} ETH`);

  const taxBal = await curve.creatorTaxBalance();
  console.log(`Updated Curve Creator Tax: ${ethers.formatEther(taxBal)} ETH`);
  console.log("==================================================================");
}

main().catch(console.error);
