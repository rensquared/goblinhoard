import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const WETH_ADDRESS = deployed.weth;

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;

  const weth = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    WETH_ADDRESS
  );

  console.log("-----------------------------------------");
  console.log("🔥 OUTLAW CAPITAL - LIVE PROFIT REPORT 🔥");
  console.log("-----------------------------------------");

  let totalWeth = 0n;

  for (let i = 0; i < founderWallets.length; i++) {
    const addr = founderWallets[i].address;
    const wethBal = await weth.balanceOf(addr);
    const ethBal = await hre.ethers.provider.getBalance(addr);
    
    if (wethBal > 0n) {
      console.log(`Founder Wallet ${i + 1} (${addr}):`);
      console.log(`  WETH Balance: ${hre.ethers.formatEther(wethBal)} WETH`);
      console.log(`  ETH Balance:  ${hre.ethers.formatEther(ethBal)} ETH`);
      totalWeth += wethBal;
    }
  }

  const wethPriceUsd = 1742.05;
  const totalUsd = Number(hre.ethers.formatEther(totalWeth)) * wethPriceUsd;

  console.log("-----------------------------------------");
  console.log(`TOTAL PROFIT SECURED: ${hre.ethers.formatEther(totalWeth)} WETH (~$${totalUsd.toFixed(2)} USD)`);
  console.log("-----------------------------------------");
}

main().catch(console.error);
