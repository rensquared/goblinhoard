import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function sim() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.chain.robinhood.com/");
  const curveAddr = "0x8bf021c97f5958b746E9895E306AE3C697271EF0";
  const tokenAddr = "0xD41d83f9b1dF9D15766f353B709ca0a96fb8d6c9";
  const wallets = JSON.parse(fs.readFileSync("./wallets_hoard.json", "utf8"));
  const sw1 = wallets.subWallets[0];
  const wallet1 = new ethers.Wallet(sw1.privateKey, provider);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const curve = new ethers.Contract(curveAddr, [
    "function sell(uint256 amountIn, uint256 minEthOut, address recipient) external returns (uint256 ethOut)"
  ], wallet1);
  const token = new ethers.Contract(tokenAddr, [
    "function balanceOf(address) view returns (uint256)"
  ], provider);

  const bal = await token.balanceOf(sw1.address);
  console.log("Wallet 1 Balance:", ethers.formatUnits(bal, 18));
  try {
    const ethOut = await curve.sell.staticCall(bal, 0n, deployer.address);
    console.log("Static call sell with recipient = deployer succeeded! Estimated ETH out:", ethers.formatEther(ethOut), "ETH");
  } catch (e: any) {
    console.error("Static call error:", e.message);
  }
}
sim().catch(console.error);
