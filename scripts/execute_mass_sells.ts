import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Checking pool balances and executing mass founder sells...");

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = deployed.token;
  const WETH_ADDRESS = deployed.weth;
  const ROUTER_ADDRESS = deployed.router;
  const POOL_ADDRESS = deployed.pool;

  const weth = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    WETH_ADDRESS
  );

  const poolWethBal = await weth.balanceOf(POOL_ADDRESS);
  console.log(`Pool WETH balance: ${hre.ethers.formatEther(poolWethBal)} WETH`);

  if (poolWethBal === 0n) {
    console.log("No WETH in pool to extract. Sells will revert!");
    return;
  }

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

  // We want to sell Outlaw tokens to pull out the WETH. 
  // Let's divide the sell across multiple founder wallets to distribute the trades.
  // Each founder wallet holds 10 Million OUTLAW. Let's sell 5M tokens per wallet.
  const sellAmountPerWallet = 5_000_000n * 10n ** 18n;

  for (let i = 0; i < founderWallets.length; i++) {
    const founderData = founderWallets[i];
    const founderSigner = new hre.ethers.Wallet(founderData.privateKey, hre.ethers.provider);
    
    const token = await hre.ethers.getContractAt("OutlawToken", tokenAddress, founderSigner);
    const bal = await token.balanceOf(founderSigner.address);

    if (bal < sellAmountPerWallet) {
      continue;
    }

    console.log(`\nFounder Wallet ${i + 1} (${founderSigner.address}) selling 5M tokens...`);
    const router = await hre.ethers.getContractAt(
      [
        "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
      ],
      ROUTER_ADDRESS,
      founderSigner
    );

    const swapParams = {
      tokenIn: tokenAddress,
      tokenOut: WETH_ADDRESS,
      fee: 10000,
      recipient: founderSigner.address,
      amountIn: sellAmountPerWallet,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    };

    try {
      const fees = await getGasFees();
      const tx = await router.exactInputSingle(swapParams, {
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas
      });
      console.log(`  Tx sent: ${tx.hash}`);
      await tx.wait();
      console.log("  Tx confirmed!");
    } catch (e: any) {
      console.error(`  Swap failed: ${e.message}`);
      // If we run out of WETH in the pool, swaps will start failing. Stop early.
      if (e.message.includes("execution reverted") || e.message.includes("reverted")) {
        console.log("Pool has been fully drained of WETH. Stopping mass sells.");
        break;
      }
    }
  }
}

main().catch(console.error);
