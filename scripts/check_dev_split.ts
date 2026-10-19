import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

async function check() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.chain.robinhood.com/");
  const curveAddr = "0x8bf021c97f5958b746E9895E306AE3C697271EF0";
  const tokenAddr = "0xD41d83f9b1dF9D15766f353B709ca0a96fb8d6c9";
  const curve = new ethers.Contract(curveAddr, [
    "function quoteReserve() view returns (uint256)",
    "function tokenReserve() view returns (uint256)"
  ], provider);
  const token = new ethers.Contract(tokenAddr, [
    "function balanceOf(address) view returns (uint256)"
  ], provider);

  const qr = await curve.quoteReserve();
  const tr = await curve.tokenReserve();
  const priceEth = Number(qr) / Number(tr);
  const priceUsd = priceEth * 2500;
  const mcapUsd = priceEth * 1e9 * 2500;

  console.log("Quote Reserve ETH:", ethers.formatEther(qr));
  console.log("Token Reserve:", ethers.formatUnits(tr, 18));
  console.log("Price ETH per token:", priceEth.toExponential(4));
  console.log("Price USD per token:", priceUsd.toExponential(4));
  console.log("Mcap USD:", mcapUsd.toFixed(2));

  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const depBal = await token.balanceOf(deployer.address);
  const depBalTokens = Number(ethers.formatUnits(depBal, 18));
  const depBalValueUsd = depBalTokens * priceUsd;
  console.log("Deployer HOARD bal:", ethers.formatUnits(depBal, 18));
  console.log("Deployer HOARD Value USD: $" + depBalValueUsd.toFixed(2));

  // 50 USD worth of tokens:
  const tokensFor50Usd = 50 / priceUsd;
  const tokensToKeep = BigInt(Math.floor(tokensFor50Usd)) * 10n**18n;
  const tokensToSell = depBal > tokensToKeep ? depBal - tokensToKeep : 0n;

  console.log("Tokens to KEEP (~$50 worth):", ethers.formatUnits(tokensToKeep, 18), "HOARD");
  console.log("Tokens to SELL:", ethers.formatUnits(tokensToSell, 18), "HOARD");
}

check().catch(console.error);
