import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = deployed.token;

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;
  const rewardWallets = wallets.reward;

  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    tokenAddress
  );

  console.log("-----------------------------------------");
  console.log("🔥 OUTLAW RESERVES - LIVE SUPPLY REPORT 🔥");
  console.log("-----------------------------------------");

  let totalFounder = 0n;
  for (let i = 0; i < founderWallets.length; i++) {
    const addr = founderWallets[i].address;
    const bal = await token.balanceOf(addr);
    console.log(`Founder Wallet ${i + 1}: ${hre.ethers.formatUnits(bal, 18)} OUTLAW`);
    totalFounder += bal;
  }

  let totalReward = 0n;
  for (let i = 0; i < rewardWallets.length; i++) {
    const addr = rewardWallets[i].address;
    const bal = await token.balanceOf(addr);
    totalReward += bal;
  }

  console.log("-----------------------------------------");
  console.log(`Founder Wallets Reserve: ${hre.ethers.formatUnits(totalFounder, 18)} OUTLAW`);
  console.log(`Reward Wallets Reserve:  ${hre.ethers.formatUnits(totalReward, 18)} OUTLAW`);
  console.log(`Total Held by Dev/Team:   ${hre.ethers.formatUnits(totalFounder + totalReward, 18)} OUTLAW`);
  console.log("-----------------------------------------");
}

main().catch(console.error);
