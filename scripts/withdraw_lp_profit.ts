import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Withdrawing 90% of LP liquidity to capture profits and thin the pool...");

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

  const nfpm = await hre.ethers.getContractAt(
    [
      "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
      "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint256 amount0, uint256 amount1)",
      "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) external payable returns (uint256 amount0, uint256 amount1)"
    ],
    NFPM_ADDRESS,
    founderSigner
  );

  // Active position ID
  const tokenId = 107945n;
  const pos = await nfpm.positions(tokenId);
  const currentLiquidity = pos.liquidity;
  console.log(`Current Position Liquidity: ${currentLiquidity.toString()}`);

  if (currentLiquidity === 0n) {
    console.log("Position liquidity is already 0!");
    return;
  }

  // Withdraw 100% of the current liquidity
  const withdrawLiquidity = currentLiquidity;
  console.log(`Withdrawing 100% liquidity (${withdrawLiquidity.toString()})...`);

  const decreaseParams = {
    tokenId: tokenId,
    liquidity: withdrawLiquidity,
    amount0Min: 0n,
    amount1Min: 0n,
    deadline: Math.floor(Date.now() / 1000) + 3600
  };

  const decreaseFees = await getGasFees();
  const decreaseTx = await nfpm.decreaseLiquidity(decreaseParams, {
    maxFeePerGas: decreaseFees.maxFeePerGas,
    maxPriorityFeePerGas: decreaseFees.maxPriorityFeePerGas
  });
  await decreaseTx.wait();
  console.log("  Liquidity successfully decreased.");

  // Collect the tokens back to Founder Wallet 1
  console.log("Collecting WETH and OUTLAW back to Founder Wallet 1...");
  const collectParams = {
    tokenId: tokenId,
    recipient: founderSigner.address,
    amount0Max: 2n ** 128n - 1n,
    amount1Max: 2n ** 128n - 1n
  };

  const collectFees = await getGasFees();
  const collectTx = await nfpm.collect(collectParams, {
    maxFeePerGas: collectFees.maxFeePerGas,
    maxPriorityFeePerGas: collectFees.maxPriorityFeePerGas
  });
  await collectTx.wait();
  console.log("  Collect complete.");

  // Query balances
  const weth = await hre.ethers.getContractAt(
    [
      "function balanceOf(address account) external view returns (uint256)"
    ],
    WETH_ADDRESS,
    founderSigner
  );
  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    OUTLAW_ADDRESS
  );

  const wethBal = await weth.balanceOf(founderSigner.address);
  const outlawBal = await token.balanceOf(founderSigner.address);

  console.log(`\nRecovered Assets in Founder Wallet 1:`);
  console.log(`  Recovered WETH:   ${hre.ethers.formatEther(wethBal)} WETH`);
  console.log(`  Recovered OUTLAW: ${hre.ethers.formatUnits(outlawBal, 18)} OUTLAW`);

  const ethBal = await hre.ethers.provider.getBalance(founderSigner.address);
  console.log(`Founder Wallet 1 native ETH balance: ${hre.ethers.formatEther(ethBal)} ETH`);
}

main().catch(console.error);
