import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Restoring pool liquidity to Token ID 107945...");

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const NFPM_ADDRESS = deployed.nfpm;
  const WETH_ADDRESS = deployed.weth;
  const OUTLAW_ADDRESS = deployed.token;

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founder1Data = wallets.founder[0];
  const founderSigner = new hre.ethers.Wallet(founder1Data.privateKey, hre.ethers.provider);
  console.log(`Founder Wallet 1: ${founderSigner.address}`);

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
    founderSigner
  );

  const token = await hre.ethers.getContractAt(
    [
      "function balanceOf(address account) external view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)"
    ],
    OUTLAW_ADDRESS,
    founderSigner
  );

  const nfpm = await hre.ethers.getContractAt(
    [
      "function increaseLiquidity((uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)"
    ],
    NFPM_ADDRESS,
    founderSigner
  );

  const wethBal = await weth.balanceOf(founderSigner.address);
  const outlawBal = await token.balanceOf(founderSigner.address);

  console.log(`WETH balance to deposit: ${hre.ethers.formatEther(wethBal)} WETH`);
  console.log(`OUTLAW balance to deposit: ${hre.ethers.formatUnits(outlawBal, 18)} OUTLAW`);

  if (wethBal === 0n && outlawBal === 0n) {
    console.log("No balances to restore.");
    return;
  }

  console.log("Approving NFPM for WETH and OUTLAW...");
  const fees1 = await getGasFees();
  const txApp1 = await weth.approve(NFPM_ADDRESS, wethBal, {
    maxFeePerGas: fees1.maxFeePerGas,
    maxPriorityFeePerGas: fees1.maxPriorityFeePerGas
  });
  await txApp1.wait();

  const fees2 = await getGasFees();
  const txApp2 = await token.approve(NFPM_ADDRESS, outlawBal, {
    maxFeePerGas: fees2.maxFeePerGas,
    maxPriorityFeePerGas: fees2.maxPriorityFeePerGas
  });
  await txApp2.wait();
  console.log("  Approvals complete.");

  console.log("Increasing pool liquidity back to original range...");
  const increaseParams = {
    tokenId: 107945n,
    amount0Desired: wethBal, // WETH is token0
    amount1Desired: outlawBal, // OUTLAW is token1
    amount0Min: 0n,
    amount1Min: 0n,
    deadline: Math.floor(Date.now() / 1000) + 3600
  };

  const fees3 = await getGasFees();
  const txInc = await nfpm.increaseLiquidity(increaseParams, {
    maxFeePerGas: fees3.maxFeePerGas,
    maxPriorityFeePerGas: fees3.maxPriorityFeePerGas
  });
  await txInc.wait();
  console.log("Liquidity successfully restored! The pool is back to its original state.");
}

main().catch(console.error);
