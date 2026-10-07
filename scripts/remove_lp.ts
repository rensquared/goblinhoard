import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const OUTLAW_ADDRESS = deployed.token;
  const WETH_ADDRESS = deployed.weth;
  const NFPM_ADDRESS = deployed.nfpm;

  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found!");
  }
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founder1Data = wallets.founder[0];
  const founderSigner = new hre.ethers.Wallet(founder1Data.privateKey, hre.ethers.provider);
  console.log(`Founder Wallet 1 address: ${founderSigner.address}`);

  // Gas Fee Resilient Helper
  async function getGasFees() {
    const feeData = await hre.ethers.provider.getFeeData();
    const maxFeePerGas = (feeData.maxFeePerGas || 0n) * 25n / 10n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || 0n) * 20n / 10n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  const nfpm = await hre.ethers.getContractAt(
    [
      "function balanceOf(address owner) external view returns (uint256)",
      "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
      "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
      "function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint256 amount0, uint256 amount1)",
      "function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) external payable returns (uint256 amount0, uint256 amount1)"
    ],
    NFPM_ADDRESS,
    founderSigner
  );

  // 1. Scan and process all owned NFT positions
  const nftBal = await nfpm.balanceOf(founderSigner.address);
  console.log(`Founder NFT Balance: ${nftBal.toString()}`);
  
  if (nftBal === 0n) {
    console.log("No LP positions found for Founder Wallet 1.");
    return;
  }

  for (let i = 0; i < Number(nftBal); i++) {
    const tokenId = await nfpm.tokenOfOwnerByIndex(founderSigner.address, i);
    console.log(`\n--------------------------------------------`);
    console.log(`Processing LP Position Token ID: ${tokenId.toString()}`);
    console.log(`--------------------------------------------`);

    const pos = await nfpm.positions(tokenId);
    const liquidity = pos.liquidity;
    console.log(`  Position liquidity: ${liquidity.toString()}`);

    if (liquidity > 0n) {
      console.log("  Removing 100% liquidity...");
      const decreaseParams = {
        tokenId: tokenId,
        liquidity: liquidity,
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
      console.log("  Liquidity decreased.");
    }

    console.log("  Collecting tokens from position...");
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
  }

  // 2. Unwrap WETH to ETH on Founder Wallet 1
  const weth = await hre.ethers.getContractAt(
    [
      "function balanceOf(address account) external view returns (uint256)",
      "function withdraw(uint256 wad) external"
    ],
    WETH_ADDRESS,
    founderSigner
  );

  const wethBal = await weth.balanceOf(founderSigner.address);
  console.log(`\nRecovered WETH balance on Founder Wallet 1: ${hre.ethers.formatEther(wethBal)} WETH`);

  if (wethBal > 0n) {
    console.log("Unwrapping WETH to native ETH...");
    const withdrawFees = await getGasFees();
    const withdrawTx = await weth.withdraw(wethBal, {
      maxFeePerGas: withdrawFees.maxFeePerGas,
      maxPriorityFeePerGas: withdrawFees.maxPriorityFeePerGas
    });
    await withdrawTx.wait();
    console.log("  Unwrap complete.");
  }

  // 3. Send native ETH back to Deployer
  const ethBalance = await hre.ethers.provider.getBalance(founderSigner.address);
  console.log(`Founder Wallet 1 native ETH balance: ${hre.ethers.formatEther(ethBalance)} ETH`);

  // Leave 0.0003 ETH for future gas costs on Founder Wallet 1, send the rest to Deployer
  const reserveGas = hre.ethers.parseEther("0.0003");
  if (ethBalance > reserveGas) {
    const transferAmount = ethBalance - reserveGas;
    console.log(`Refunding ${hre.ethers.formatEther(transferAmount)} ETH back to Deployer (${deployer.address})...`);
    
    const refundFees = await getGasFees();
    const refundTx = await founderSigner.sendTransaction({
      to: deployer.address,
      value: transferAmount,
      maxFeePerGas: refundFees.maxFeePerGas,
      maxPriorityFeePerGas: refundFees.maxPriorityFeePerGas
    });
    await refundTx.wait();
    console.log("  Refund transaction complete.");
  }

  // Final check of Deployer balance
  const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`\nConsolidated Deployer Balance: ${hre.ethers.formatEther(deployerBalance)} ETH`);
  console.log("Liquidity removal and fund recovery complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
