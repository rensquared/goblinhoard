import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting manual founder profit-taking sells...");

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = deployed.token;
  const WETH = deployed.weth;
  const ROUTER = deployed.router;

  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found!");
  }
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  // Gas Fee Resilient Helper
  async function getGasFees() {
    const feeData = await hre.ethers.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 25n / 10n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 20n / 10n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  // Swap 1M tokens from Founder 2, 3, and 4
  const indices = [1, 2, 3]; // Founder Wallet 2, 3, 4
  const sellAmount = 1_000_000n * 10n ** 18n;

  for (const idx of indices) {
    const founderData = wallets.founder[idx];
    const founderSigner = new hre.ethers.Wallet(founderData.privateKey, hre.ethers.provider);
    console.log(`\nFounder Wallet ${idx + 1}: ${founderSigner.address}`);

    const token = await hre.ethers.getContractAt("OutlawToken", tokenAddress, founderSigner);
    const balBefore = await token.balanceOf(founderSigner.address);
    console.log(`  Balance before: ${hre.ethers.formatUnits(balBefore, 18)} OUTLAW`);

    if (balBefore < sellAmount) {
      console.log(`  Insufficient token balance! Skipping.`);
      continue;
    }

    const routerContract = await hre.ethers.getContractAt(
      [
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
      ],
      ROUTER,
      founderSigner
    );

    const swapParams = {
      tokenIn: tokenAddress,
      tokenOut: WETH,
      fee: 10000,
      recipient: founderSigner.address,
      amountIn: sellAmount,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    };

    try {
      const fees = await getGasFees();
      const tx = await routerContract.exactInputSingle(swapParams, {
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas
      });
      console.log(`  Swap transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("  Swap complete.");

      const balAfter = await token.balanceOf(founderSigner.address);
      console.log(`  Balance after: ${hre.ethers.formatUnits(balAfter, 18)} OUTLAW`);
    } catch (err: any) {
      console.error(`  Swap failed: ${err.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
