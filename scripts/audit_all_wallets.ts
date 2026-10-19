import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const ETH_USD_PRICE = 2500;

const CURVE_ABI = [
  "function quoteReserve() external view returns (uint256)",
  "function tokenReserve() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

const ESCROW_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

const FEE_ESCROW_ADDR = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const receiptPath = path.resolve("./scratch/launch_receipt.json");
  const rc = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  const tokenAddress = rc.tokenAddress;
  const curveAddress = rc.curveAddress;
  const taxAddress = rc.taxRecipient;

  const walletsPath = path.resolve("./wallets_hoard.json");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY missing");
  const deployer = new ethers.Wallet(privKey, provider);

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const curve = new ethers.Contract(curveAddress, CURVE_ABI, provider);
  const escrow = new ethers.Contract(FEE_ESCROW_ADDR, ESCROW_ABI, provider);

  // Curve Stats
  const qr = await curve.quoteReserve();
  const tr = await curve.tokenReserve();
  const curveContractEth = await provider.getBalance(curveAddress);
  const priceEth = Number(qr) / Number(tr);
  const priceUsd = priceEth * ETH_USD_PRICE;
  const mcapEth = priceEth * 1e9;
  const mcapUsd = mcapEth * ETH_USD_PRICE;

  console.log("==================================================================");
  console.log("            HOARDED ($HOARD) - FULL ONCHAIN PORTFOLIO AUDIT       ");
  console.log("==================================================================\n");

  console.log("--- BONDING CURVE & MARKET STATUS ---");
  console.log(`Token Address:     ${tokenAddress}`);
  console.log(`Curve Address:     ${curveAddress}`);
  console.log(`Quote Reserve:     ${ethers.formatEther(qr)} ETH`);
  console.log(`Token Reserve:     ${ethers.formatUnits(tr, 18)} HOARD`);
  console.log(`Contract ETH Bal:  ${ethers.formatEther(curveContractEth)} ETH`);
  console.log(`Token Price:       $${priceUsd.toExponential(4)} (${priceEth.toExponential(4)} ETH)`);
  console.log(`Market Cap:        $${mcapUsd.toFixed(2)} (${mcapEth.toFixed(4)} ETH)\n`);

  // Deployer
  const depEth = await provider.getBalance(deployer.address);
  const depTok = await token.balanceOf(deployer.address);
  const depTokUsd = Number(ethers.formatUnits(depTok, 18)) * priceUsd;

  console.log("--- 1. MAIN DEPLOYER WALLET ---");
  console.log(`Address:           ${deployer.address}`);
  console.log(`ETH Balance:       ${ethers.formatEther(depEth)} ETH ($${(Number(ethers.formatEther(depEth)) * ETH_USD_PRICE).toFixed(2)})`);
  console.log(`HOARD Balance:     ${ethers.formatUnits(depTok, 18)} HOARD ($${depTokUsd.toFixed(2)})`);
  console.log(`Total Deployer:    $${(Number(ethers.formatEther(depEth)) * ETH_USD_PRICE + depTokUsd).toFixed(2)}\n`);

  // Sub-Wallets
  console.log("--- 2. ALL 10 SUB-WALLETS ---");
  let subWalletsTotalEth = 0n;
  let subWalletsTotalTok = 0n;

  for (const sw of hoardData.subWallets) {
    const swEth = await provider.getBalance(sw.address);
    const swTok = await token.balanceOf(sw.address);
    subWalletsTotalEth += swEth;
    subWalletsTotalTok += swTok;
    const swTokNum = Number(ethers.formatUnits(swTok, 18));
    console.log(`SW ${sw.id.toString().padStart(2, " ")} (${sw.role.padEnd(16, " ")} | ${sw.address.slice(0, 8)}...${sw.address.slice(-6)}): ${ethers.formatEther(swEth).padStart(10, " ")} ETH | ${swTokNum.toLocaleString().padStart(12, " ")} HOARD`);
  }
  console.log(`------------------------------------------------------------------`);
  console.log(`Sub-Wallets Total ETH:   ${ethers.formatEther(subWalletsTotalEth)} ETH`);
  console.log(`Sub-Wallets Total HOARD: ${ethers.formatUnits(subWalletsTotalTok, 18)} HOARD\n`);

  // Tax Wallet
  const taxEth = await provider.getBalance(taxAddress);
  const taxTok = await token.balanceOf(taxAddress);
  const unclaimedEscrow = await escrow.balanceOf(taxAddress);

  console.log("--- 3. TAX RECIPIENT & FEE ESCROW ---");
  console.log(`Tax Wallet:        ${taxAddress}`);
  console.log(`Tax Wallet ETH:    ${ethers.formatEther(taxEth)} ETH`);
  console.log(`Tax Wallet HOARD:  ${ethers.formatUnits(taxTok, 18)} HOARD`);
  console.log(`Fee Escrow Unclaimed: ${ethers.formatEther(unclaimedEscrow)} ETH ($${(Number(ethers.formatEther(unclaimedEscrow)) * ETH_USD_PRICE).toFixed(2)})\n`);

  // Grand Totals
  const totalEthAll = depEth + subWalletsTotalEth + taxEth + unclaimedEscrow;
  const totalTokAll = depTok + subWalletsTotalTok + taxTok;
  const totalEthValUsd = Number(ethers.formatEther(totalEthAll)) * ETH_USD_PRICE;
  const totalTokValUsd = Number(ethers.formatUnits(totalTokAll, 18)) * priceUsd;
  const grandTotalUsd = totalEthValUsd + totalTokValUsd;

  console.log("==================================================================");
  console.log("                   GRAND TOTAL ACROSS ALL WALLETS                 ");
  console.log("==================================================================");
  console.log(`Initial Capital Funded:      0.3600 ETH ($900.00)`);
  console.log(`Total Liquid ETH Held:       ${ethers.formatEther(totalEthAll)} ETH ($${totalEthValUsd.toFixed(2)})`);
  console.log(`Total HOARD Tokens Held:     ${ethers.formatUnits(totalTokAll, 18)} HOARD ($${totalTokValUsd.toFixed(2)})`);
  console.log(`Grand Total Portfolio Value: $${grandTotalUsd.toFixed(2)}`);
  console.log(`NET REALIZED PROFIT:         +${(Number(ethers.formatEther(totalEthAll)) - 0.3600).toFixed(4)} ETH (+$$${(totalEthValUsd - 900).toFixed(2)})`);
  console.log(`NET CASH RETURN ON CAPITAL:  +${(((Number(ethers.formatEther(totalEthAll)) - 0.3600) / 0.3600) * 100).toFixed(1)}%`);
  console.log("==================================================================");
}

main().catch(console.error);
