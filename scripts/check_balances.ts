import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found!");
  }
  
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;

  console.log("Checking ETH gas balances on Robinhood Chain...\n");

  for (let i = 0; i < founderWallets.length; i++) {
    const f = founderWallets[i];
    const balance = await ethers.provider.getBalance(f.address);
    const balanceEth = ethers.formatEther(balance);
    console.log(`Wallet ${i + 1} (${f.address}): ${balanceEth} ETH`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
