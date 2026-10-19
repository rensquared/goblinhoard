import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function testTransfer() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.chain.robinhood.com/");
  const tokenAddr = "0xD41d83f9b1dF9D15766f353B709ca0a96fb8d6c9";
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const wallets = JSON.parse(fs.readFileSync("./wallets_hoard.json", "utf8"));
  const sw1 = wallets.subWallets[0];

  const token = new ethers.Contract(tokenAddr, [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], deployer);

  const testAmt = ethers.parseUnits("6850000", 18);
  const ok = await token.transfer.staticCall(sw1.address, testAmt);
  console.log("token.transfer.staticCall result:", ok);
}

testTransfer().catch(console.error);
