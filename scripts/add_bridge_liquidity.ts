import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Starting bridge liquidity setup using deployer: ${deployer.address}`);

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = deployed.token;
  const WETH = deployed.weth;
  const NFPM = deployed.nfpm;

  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found!");
  }
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  
  // Connect to Founder Wallet 1
  const founder1Data = wallets.founder[0];
  const founder1 = new hre.ethers.Wallet(founder1Data.privateKey, hre.ethers.provider);
  console.log(`Founder Wallet 1: ${founder1.address}`);

  let deployNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
  let founderNonce = await hre.ethers.provider.getTransactionCount(founder1.address, "pending");

  // Gas Fee Resilient Helper
  async function getGasFees() {
    const feeData = await hre.ethers.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 25n / 10n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 20n / 10n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  // Nonce & Gas Fee Resilient Helper functions for Deployer
  async function sendDeployerTx(txFunc: (nonce: number, maxFee: bigint, maxPriority: bigint) => Promise<any>): Promise<any> {
    let sent = false;
    let retries = 0;
    while (!sent && retries < 15) {
      try {
        const fees = await getGasFees();
        const tx = await txFunc(deployNonce, fees.maxFeePerGas, fees.maxPriorityFeePerGas);
        await tx.wait();
        deployNonce++;
        sent = true;
        return tx;
      } catch (error: any) {
        if (error.message.includes("nonce too low") || error.message.includes("replacement transaction underpriced")) {
          deployNonce++;
          retries++;
          console.log(`  [Deployer] Nonce collision. Retrying with nonce: ${deployNonce}...`);
        } else if (error.message.includes("max fee per gas less than block base fee")) {
          retries++;
          console.log(`  [Deployer] Gas fee spike. Retrying...`);
        } else {
          retries++;
          console.log(`  [Deployer] Network/RPC timeout: ${error.message}. Retrying in 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    throw new Error("Failed to execute deployer transaction after max retries");
  }

  // Nonce & Gas Fee Resilient Helper functions for Founder 1
  async function sendFounderTx(txFunc: (nonce: number, maxFee: bigint, maxPriority: bigint) => Promise<any>): Promise<any> {
    let sent = false;
    let retries = 0;
    while (!sent && retries < 15) {
      try {
        const fees = await getGasFees();
        const tx = await txFunc(founderNonce, fees.maxFeePerGas, fees.maxPriorityFeePerGas);
        await tx.wait();
        founderNonce++;
        sent = true;
        return tx;
      } catch (error: any) {
        if (error.message.includes("nonce too low") || error.message.includes("replacement transaction underpriced")) {
          founderNonce++;
          retries++;
          console.log(`  [Founder] Nonce collision. Retrying with nonce: ${founderNonce}...`);
        } else if (error.message.includes("max fee per gas less than block base fee")) {
          retries++;
          console.log(`  [Founder] Gas fee spike. Retrying...`);
        } else {
          retries++;
          console.log(`  [Founder] Network/RPC timeout: ${error.message}. Retrying in 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    throw new Error("Failed to execute founder transaction after max retries");
  }

  // 1. Transfer 10 Million OUTLAW from Founder Wallet 1 to deployer
  console.log("Transferring 10M OUTLAW from Founder Wallet 1 to deployer...");
  const tokenContractFounder = await hre.ethers.getContractAt("OutlawToken", tokenAddress, founder1);
  const decimals = await tokenContractFounder.decimals();
  const transferAmount = 10_000_000n * 10n ** BigInt(decimals);
  
  await sendFounderTx((nonce, maxFee, maxPriority) => {
    return tokenContractFounder.transfer(deployer.address, transferAmount, {
      nonce,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPriority
    });
  });
  console.log("  Transfer complete.");

  // 2. Wrap 0.002 ETH to WETH on deployer
  console.log("Wrapping 0.002 ETH to WETH on deployer...");
  const wethContract = await hre.ethers.getContractAt(
    ["function deposit() external payable", "function approve(address guy, uint wad) external returns (bool)"],
    WETH,
    deployer
  );
  
  await sendDeployerTx((nonce, maxFee, maxPriority) => {
    return wethContract.deposit({
      value: hre.ethers.parseEther("0.002"),
      nonce,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPriority
    });
  });
  console.log("  Wrapped to WETH successfully.");

  // 3. Approve NFPM for both WETH and OUTLAW on deployer
  console.log("Approving NFPM for WETH and OUTLAW...");
  const tokenContractDeployer = await hre.ethers.getContractAt("OutlawToken", tokenAddress, deployer);
  
  await sendDeployerTx((nonce, maxFee, maxPriority) => {
    return tokenContractDeployer.approve(NFPM, hre.ethers.MaxUint256, {
      nonce,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPriority
    });
  });

  await sendDeployerTx((nonce, maxFee, maxPriority) => {
    return wethContract.approve(NFPM, hre.ethers.MaxUint256, {
      nonce,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPriority
    });
  });
  console.log("  Approvals complete.");

  // 4. Mint bridge LP position
  console.log("Minting bridge LP position (ticks 189600 to 190000)...");
  const nfpmContract = await hre.ethers.getContractAt(
    [
      "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) calldata params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
    ],
    NFPM,
    deployer
  );

  const [token0, token1] = tokenAddress.toLowerCase() < WETH.toLowerCase()
    ? [tokenAddress, WETH]
    : [WETH, tokenAddress];
  const isOutlawToken0 = tokenAddress.toLowerCase() < WETH.toLowerCase();

  const mintParams = {
    token0: token0,
    token1: token1,
    fee: 10000,
    tickLower: 189600,
    tickUpper: 190000,
    amount0Desired: isOutlawToken0 ? transferAmount : hre.ethers.parseEther("0.002"),
    amount1Desired: isOutlawToken0 ? hre.ethers.parseEther("0.002") : transferAmount,
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: founder1.address, // Send LP NFT to Founder Wallet 1
    deadline: Math.floor(Date.now() / 1000) + 3600
  };

  await sendDeployerTx((nonce, maxFee, maxPriority) => {
    return nfpmContract.mint(mintParams, {
      nonce,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPriority
    });
  });
  console.log("Bridge LP successfully minted! Trading is now active.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
