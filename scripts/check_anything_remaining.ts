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

async function checkRemaining() {
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

  console.log("==================================================================");
  console.log("             COMPREHENSIVE SWEEP & REMNANT AUDIT                  ");
  console.log("==================================================================\n");

  // 1. Fee Escrow
  const pendingFees = await escrow.balanceOf(taxAddress);
  console.log("1. CREATOR FEE ESCROW:");
  console.log(`   Pending in Escrow: ${ethers.formatEther(pendingFees)} ETH ($${(Number(ethers.formatEther(pendingFees)) * ETH_USD_PRICE).toFixed(2)})\n`);

  // 2. Tax Wallet
  const taxEth = await provider.getBalance(taxAddress);
  const taxTok = await token.balanceOf(taxAddress);
  console.log("2. TAX RECIPIENT WALLET:");
  console.log(`   Address: ${taxAddress}`);
  console.log(`   ETH:     ${ethers.formatEther(taxEth)} ETH`);
  console.log(`   HOARD:   ${ethers.formatUnits(taxTok, 18)} HOARD\n`);

  // 3. Sub-Wallets (1 to 10)
  console.log("3. SUB-WALLETS (1 - 10):");
  let anyTokensInSubwallets = false;
  let sweepableEthInSubwallets = 0n;

  for (const sw of hoardData.subWallets) {
    const eth = await provider.getBalance(sw.address);
    const tok = await token.balanceOf(sw.address);
    if (tok > 0n) anyTokensInSubwallets = true;
    if (eth > ethers.parseEther("0.00005")) {
      sweepableEthInSubwallets += eth - ethers.parseEther("0.00001");
    }
    console.log(`   SW ${sw.id.toString().padStart(2, " ")} (${sw.role.padEnd(16, " ")} | ${sw.address.slice(0, 8)}...${sw.address.slice(-6)}): ${ethers.formatEther(eth)} ETH | ${ethers.formatUnits(tok, 18)} HOARD`);
  }
  console.log(`   -> Any tokens left in sub-wallets: ${anyTokensInSubwallets ? "YES" : "NONE (0.00 HOARD)"}`);
  console.log(`   -> Total sweepable gas dust in sub-wallets: ${ethers.formatEther(sweepableEthInSubwallets)} ETH\n`);

  // 4. Main Deployer
  const depEth = await provider.getBalance(deployer.address);
  const depTok = await token.balanceOf(deployer.address);
  const qr = await curve.quoteReserve();
  const tr = await curve.tokenReserve();
  const priceEth = Number(qr) / Number(tr);
  const priceUsd = priceEth * ETH_USD_PRICE;
  const depTokUsd = Number(ethers.formatUnits(depTok, 18)) * priceUsd;

  console.log("4. MAIN DEPLOYER WALLET:");
  console.log(`   Address: ${deployer.address}`);
  console.log(`   ETH:     ${ethers.formatEther(depEth)} ETH ($${(Number(ethers.formatEther(depEth)) * ETH_USD_PRICE).toFixed(2)})`);
  console.log(`   HOARD:   ${ethers.formatUnits(depTok, 18)} HOARD ($${depTokUsd.toFixed(2)}) [Retained bag]\n`);

  // 5. Curve status
  console.log("5. CURRENT BONDING CURVE STATUS:");
  console.log(`   Quote Reserve: ${ethers.formatEther(qr)} ETH`);
  console.log(`   Token Reserve: ${ethers.formatUnits(tr, 18)} HOARD`);
  console.log(`   Market Cap:    $${(priceEth * 1e9 * ETH_USD_PRICE).toFixed(2)}\n`);

  console.log("==================================================================");
  console.log("                      ACTIONABLE SUMMARY                          ");
  console.log("==================================================================");
  if (pendingFees > ethers.parseEther("0.001")) {
    console.log(`• Fee Escrow has ${ethers.formatEther(pendingFees)} ETH ready to claim.`);
  } else {
    console.log(`• Fee Escrow: negligible / 0 pending fees (${ethers.formatEther(pendingFees)} ETH).`);
  }
  if (anyTokensInSubwallets) {
    console.log(`• Sub-wallets still hold unsold tokens.`);
  } else {
    console.log(`• Sub-wallets: 100% clean, ZERO HOARD tokens remaining.`);
  }
  if (sweepableEthInSubwallets > ethers.parseEther("0.0005")) {
    console.log(`• Sub-wallets hold ~${ethers.formatEther(sweepableEthInSubwallets)} ETH in leftover gas that could be swept.`);
  } else {
    console.log(`• Sub-wallets: Only gas dust left (~${ethers.formatEther(sweepableEthInSubwallets)} ETH).`);
  }
  console.log("==================================================================");
}

checkRemaining().catch(console.error);
