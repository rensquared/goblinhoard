import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Preparing to unwrap all WETH in the deployer wallet to native ETH...");

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const WETH_ADDRESS = deployed.weth;

  const [deployerSigner] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployerSigner.address}`);

  // Gas Fee Resilient Helper
  async function getGasFees() {
    const feeData = await hre.ethers.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 25n / 10n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 20n / 10n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  const weth = await hre.ethers.getContractAt(
    [
      "function balanceOf(address account) external view returns (uint256)",
      "function withdraw(uint256 wad) external"
    ],
    WETH_ADDRESS,
    deployerSigner
  );

  const wethBal = await weth.balanceOf(deployerSigner.address);
  console.log(`Current Deployer WETH balance: ${hre.ethers.formatEther(wethBal)} WETH`);

  if (wethBal === 0n) {
    console.log("No WETH to unwrap.");
    return;
  }

  console.log("Unwrapping WETH to native ETH...");
  const fees = await getGasFees();
  const tx = await weth.withdraw(wethBal, {
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas
  });
  console.log(`  Transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log("  Unwrap complete!");

  const finalEthBal = await hre.ethers.provider.getBalance(deployerSigner.address);
  console.log(`\nFinal Deployer ETH Balance: ${hre.ethers.formatEther(finalEthBal)} ETH`);
}

main().catch(console.error);
