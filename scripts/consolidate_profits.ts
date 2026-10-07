import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const mainWallet = "0x9325bcA0D53f5BeB1DeD01d5Cbb58025dc5fe63f";
  console.log(`Consolidating all WETH profits to main wallet: ${mainWallet}...`);

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const WETH_ADDRESS = deployed.weth;

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;

  // Gas Fee Resilient Helper
  async function getGasFees() {
    const feeData = await hre.ethers.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 25n / 10n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 20n / 10n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  let consolidatedTotal = 0n;

  for (let i = 0; i < founderWallets.length; i++) {
    const founderData = founderWallets[i];
    const founderSigner = new hre.ethers.Wallet(founderData.privateKey, hre.ethers.provider);
    
    const weth = await hre.ethers.getContractAt(
      [
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint256 value) external returns (bool)"
      ],
      WETH_ADDRESS,
      founderSigner
    );

    const balance = await weth.balanceOf(founderSigner.address);
    if (balance > 0n) {
      console.log(`\nFounder Wallet ${i + 1} (${founderSigner.address}):`);
      console.log(`  Transferring ${hre.ethers.formatEther(balance)} WETH to main wallet...`);

      try {
        const fees = await getGasFees();
        const tx = await weth.transfer(mainWallet, balance, {
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas
        });
        console.log(`  Transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log("  Transfer complete!");
        consolidatedTotal += balance;
      } catch (err: any) {
        console.error(`  Transfer failed: ${err.message}`);
      }
    }
  }

  console.log("\n------------------------------------------------");
  console.log(`CONSOLIDATION COMPLETE! Total: ${hre.ethers.formatEther(consolidatedTotal)} WETH`);
  console.log("------------------------------------------------");
}

main().catch(console.error);
