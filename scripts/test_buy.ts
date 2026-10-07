import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Executing $1.00 test buy from Deployer account...");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer Wallet: ${deployer.address}`);

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = deployed.token;
  const WETH_ADDRESS = deployed.weth;
  const ROUTER = deployed.router;

  // Gas Fee Resilient Helper
  async function getGasFees() {
    const feeData = await hre.ethers.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 25n / 10n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 20n / 10n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  const weth = await hre.ethers.getContractAt(
    [
      "function deposit() external payable",
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)"
    ],
    WETH_ADDRESS,
    deployer
  );

  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)", "function decimals() external view returns (uint8)"],
    tokenAddress,
    deployer
  );

  const decimals = await token.decimals();
  const buyAmountETH = hre.ethers.parseEther("0.0006"); // ~$1.04 USD

  console.log(`1. Wrapping ${hre.ethers.formatEther(buyAmountETH)} ETH to WETH...`);
  const wrapFees = await getGasFees();
  const wrapTx = await weth.deposit({
    value: buyAmountETH,
    maxFeePerGas: wrapFees.maxFeePerGas,
    maxPriorityFeePerGas: wrapFees.maxPriorityFeePerGas
  });
  await wrapTx.wait();
  console.log("   Wrap complete.");

  console.log("2. Approving SwapRouter for WETH...");
  const approveFees = await getGasFees();
  const approveTx = await weth.approve(ROUTER, buyAmountETH, {
    maxFeePerGas: approveFees.maxFeePerGas,
    maxPriorityFeePerGas: approveFees.maxPriorityFeePerGas
  });
  await approveTx.wait();
  console.log("   Approval complete.");

  const balBefore = await token.balanceOf(deployer.address);
  console.log(`\nBalance before buy: ${hre.ethers.formatUnits(balBefore, decimals)} OUTLAW`);

  console.log("3. Executing exactInputSingle swap on SwapRouter...");
  const routerContract = await hre.ethers.getContractAt(
    [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
    ],
    ROUTER,
    deployer
  );

  const swapParams = {
    tokenIn: WETH_ADDRESS,
    tokenOut: tokenAddress,
    fee: 10000, // 1%
    recipient: deployer.address,
    amountIn: buyAmountETH,
    amountOutMinimum: 0n, // Accept standard market price
    sqrtPriceLimitX96: 0n
  };

  const swapFees = await getGasFees();
  const tx = await routerContract.exactInputSingle(swapParams, {
    maxFeePerGas: swapFees.maxFeePerGas,
    maxPriorityFeePerGas: swapFees.maxPriorityFeePerGas
  });
  console.log(`   Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`   Transaction confirmed in block ${receipt?.blockNumber}.`);

  const balAfter = await token.balanceOf(deployer.address);
  console.log(`Balance after buy: ${hre.ethers.formatUnits(balAfter, decimals)} OUTLAW`);
  
  const tokensBought = balAfter - balBefore;
  console.log(`Successfully bought ${hre.ethers.formatUnits(tokensBought, decimals)} OUTLAW tokens!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
