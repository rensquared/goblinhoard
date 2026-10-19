import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function testSim() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.chain.robinhood.com/");
  const curveAddr = "0x8bf021c97f5958b746E9895E306AE3C697271EF0";
  const wallets = JSON.parse(fs.readFileSync("./wallets_hoard.json", "utf8"));
  const sw1 = wallets.subWallets[0];
  const wallet1 = new ethers.Wallet(sw1.privateKey, provider);

  const curve = new ethers.Contract(curveAddr, [
    "function sell(uint256 amountIn, uint256 minEthOut, address recipient) external returns (uint256 ethOut)"
  ], wallet1);

  const testAmt = ethers.parseUnits("6850000", 18);
  const ethOut = await curve.sell.staticCall(testAmt, 0n, wallet1.address);
  console.log("Estimated ETH out for 6,850,000 HOARD (wallet recipient):", ethers.formatEther(ethOut), "ETH");
}

testSim().catch(console.error);
