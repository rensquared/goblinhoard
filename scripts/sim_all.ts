import { ethers } from "ethers";
import * as fs from "fs";

async function simAll() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.chain.robinhood.com/");
  const curveAddr = "0x8bf021c97f5958b746E9895E306AE3C697271EF0";
  const tokenAddr = "0xD41d83f9b1dF9D15766f353B709ca0a96fb8d6c9";
  const wallets = JSON.parse(fs.readFileSync("./wallets_hoard.json", "utf8"));
  const curve = new ethers.Contract(curveAddr, [
    "function quoteReserve() view returns (uint256)",
    "function tokenReserve() view returns (uint256)"
  ], provider);
  const token = new ethers.Contract(tokenAddr, [
    "function balanceOf(address) view returns (uint256)"
  ], provider);

  const qr = await curve.quoteReserve();
  const tr = await curve.tokenReserve();
  console.log(`Current Quote Reserve: ${ethers.formatEther(qr)} ETH`);
  console.log(`Current Token Reserve: ${ethers.formatUnits(tr, 18)} HOARD`);

  // Pons Curve xy=k constant product:
  // (quoteReserve - ethOut) * (tokenReserve + amountIn) = quoteReserve * tokenReserve
  // ethOut = quoteReserve * amountIn / (tokenReserve + amountIn)
  // Minus fee (typically 1% protocol fee + 2.5% tax = 3.5% or similar)
  
  // Let's calculate for each wallet if selling 70% or 100%:
  let currentQr = qr;
  let currentTr = tr;
  let totalEthOut70 = 0n;

  console.log("\nSimulating selling 70% of each sub-wallet (sequential on-chain impact):");
  for (const sw of wallets.subWallets) {
    const bal = await token.balanceOf(sw.address);
    const toSell = (bal * 70n) / 100n;
    // sell formula with 3.5% total fee:
    // net tokens in or fee taken from ethOut
    const ethOutRaw = (currentQr * toSell) / (currentTr + toSell);
    const ethOutNet = (ethOutRaw * 965n) / 1000n; // rough fee estimate
    currentQr -= ethOutRaw;
    currentTr += toSell;
    totalEthOut70 += ethOutNet;
    console.log(`SW ${sw.id} (${sw.role}): sells ${ethers.formatUnits(toSell, 18)} -> est ~${ethers.formatEther(ethOutNet)} ETH`);
  }
  console.log(`\nTotal estimated ETH extracted from 70% sell: ~${ethers.formatEther(totalEthOut70)} ETH (Initials was 0.286 ETH)`);
}

simAll().catch(console.error);
