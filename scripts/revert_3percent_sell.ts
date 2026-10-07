import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployerAddr = "0x9325bcA0D53f5BeB1DeD01d5Cbb58025dc5fe63f";
  const revertWethAmount = 327039000000000000n; // 0.327039 WETH

  console.log(`Reverting second 3% sell using ${hre.ethers.formatEther(revertWethAmount)} WETH from deployer wallet...`);

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = deployed.token;
  const WETH_ADDRESS = deployed.weth;
  const ROUTER_ADDRESS = deployed.router;

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;

  // Primary deployer signer
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
      "function approve(address spender, uint256 amount) external returns (bool)"
    ],
    WETH_ADDRESS,
    deployerSigner
  );

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address account) external view returns (uint256)",
      "function transfer(address to, uint256 value) external returns (bool)"
    ],
    tokenAddress,
    deployerSigner
  );

  const router = await hre.ethers.getContractAt(
    [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
    ],
    ROUTER_ADDRESS,
    deployerSigner
  );

  console.log("Approving router to spend WETH...");
  const fees1 = await getGasFees();
  const txApp = await weth.approve(ROUTER_ADDRESS, revertWethAmount, {
    maxFeePerGas: fees1.maxFeePerGas,
    maxPriorityFeePerGas: fees1.maxPriorityFeePerGas
  });
  await txApp.wait();
  console.log("  Approval complete.");

  console.log("Executing buyback swap WETH -> OUTLAW...");
  const swapParams = {
    tokenIn: WETH_ADDRESS,
    tokenOut: tokenAddress,
    fee: 10000,
    recipient: deployerSigner.address,
    amountIn: revertWethAmount,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n
  };

  const fees2 = await getGasFees();
  const txSwap = await router.exactInputSingle(swapParams, {
    maxFeePerGas: fees2.maxFeePerGas,
    maxPriorityFeePerGas: fees2.maxPriorityFeePerGas
  });
  await txSwap.wait();
  console.log("  Buyback swap complete!");

  const deployerOutlawBal = await token.balanceOf(deployerSigner.address);
  console.log(`Deployer OUTLAW balance: ${hre.ethers.formatUnits(deployerOutlawBal, 18)} OUTLAW`);

  // Distribute back to the founder wallets
  // Founder 5: 5M
  // Founder 6: 5M
  // Founder 7: 10M
  // Founder 8: 10M
  const distributions = [
    { index: 4, amount: 5_000_000n * 10n ** 18n },
    { index: 5, amount: 5_000_000n * 10n ** 18n },
    { index: 6, amount: 10_000_000n * 10n ** 18n },
    { index: 7, amount: 10_000_000n * 10n ** 18n }
  ];

  console.log("\nDistributing tokens back to founder wallets...");
  for (const dist of distributions) {
    const targetAddr = founderWallets[dist.index].address;
    console.log(`  Sending ${hre.ethers.formatUnits(dist.amount, 6)}M OUTLAW to Founder Wallet ${dist.index + 1} (${targetAddr})...`);
    
    const feesDist = await getGasFees();
    const txDist = await token.transfer(targetAddr, dist.amount, {
      maxFeePerGas: feesDist.maxFeePerGas,
      maxPriorityFeePerGas: feesDist.maxPriorityFeePerGas
    });
    await txDist.wait();
  }

  console.log("\nReversion complete! The pool and founder reserves have been fully restored.");
}

main().catch(console.error);
