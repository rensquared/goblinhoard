import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting test sell from Founder Wallet 2...");

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
  
  // Connect to Founder Wallet 2
  const founder2Data = wallets.founder[1];
  const founder2 = new hre.ethers.Wallet(founder2Data.privateKey, hre.ethers.provider);
  console.log(`Founder Wallet 2: ${founder2.address}`);

  const token = await hre.ethers.getContractAt("OutlawToken", tokenAddress, founder2);
  const decimals = await token.decimals();
  
  // 100,000 BANDIT tokens = ~$1.00 USD
  const sellAmount = 100_000n * 10n ** BigInt(decimals);

  // Gas Fee Resilient Helper
  async function getGasFees() {
    const feeData = await hre.ethers.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 25n / 10n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 20n / 10n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  // Check balance before
  const balBefore = await token.balanceOf(founder2.address);
  console.log(`Balance before sell: ${hre.ethers.formatUnits(balBefore, decimals)} BANDIT`);

  console.log("Executing exactInputSingle swap on SwapRouter...");
  const routerContract = await hre.ethers.getContractAt(
    [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
    ],
    ROUTER,
    founder2
  );

  const swapParams = {
    tokenIn: tokenAddress,
    tokenOut: WETH,
    fee: 10000, // 1%
    recipient: founder2.address,
    amountIn: sellAmount,
    amountOutMinimum: 0n, // Accept standard market price
    sqrtPriceLimitX96: 0n
  };

  const swapFees = await getGasFees();
  const tx = await routerContract.exactInputSingle(swapParams, {
    maxFeePerGas: swapFees.maxFeePerGas,
    maxPriorityFeePerGas: swapFees.maxPriorityFeePerGas
  });
  console.log(`  Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Transaction confirmed in block ${receipt?.blockNumber}.`);

  // Check balance after
  const balAfter = await token.balanceOf(founder2.address);
  console.log(`Balance after sell: ${hre.ethers.formatUnits(balAfter, decimals)} BANDIT`);
  console.log("Test sell completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
