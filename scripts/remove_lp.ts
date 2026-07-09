import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founder1 = wallets.founder[0];
  console.log(`Founder Wallet 1 address: ${founder1.address}`);

  const NFPM_ADDRESS = "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3";
  const OUTLAW_ADDRESS = "0xf8101a357Dd585Da279c8adDF1ED110745986199";
  const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

  // 1. Fund the Founder Wallet with a tiny bit of ETH for gas
  const fundAmount = hre.ethers.parseEther("0.001"); // ~1.70 USD, plenty for L2 gas fees
  const founderBalance = await hre.ethers.provider.getBalance(founder1.address);
  console.log(`Founder current native balance: ${hre.ethers.formatEther(founderBalance)} ETH`);

  if (founderBalance < hre.ethers.parseEther("0.0003")) {
    console.log(`Funding Founder 1 with ${hre.ethers.formatEther(fundAmount)} ETH for gas...`);
    const fundTx = await deployer.sendTransaction({
      to: founder1.address,
      value: fundAmount
    });
    await fundTx.wait();
    console.log("Funding complete.");
  }

  // 2. Instantiate Founder Signer
  const founderSigner = new hre.ethers.Wallet(founder1.privateKey, hre.ethers.provider);

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

  // 3. Get token ID of position
  const nftBal = await nfpm.balanceOf(founder1.address);
  console.log(`Founder NFT Balance: ${nftBal.toString()}`);
  if (nftBal === 0n) {
    throw new Error("Founder 1 owns no LP positions!");
  }

  const tokenId = await nfpm.tokenOfOwnerByIndex(founder1.address, 0);
  console.log(`Position Token ID: ${tokenId.toString()}`);

  // 4. Get Position Details
  const pos = await nfpm.positions(tokenId);
  const liquidity = pos.liquidity;
  console.log(`Current position liquidity: ${liquidity.toString()}`);

  if (liquidity === 0n) {
    console.log("Liquidity is already zero. Proceeding straight to collect.");
  } else {
    // 5. Decrease Liquidity (Remove 100% of it)
    console.log("Removing 100% liquidity...");
    const decreaseParams = {
      tokenId: tokenId,
      liquidity: liquidity,
      amount0Min: 0n,
      amount1Min: 0n,
      deadline: Math.floor(Date.now() / 1000) + 3600
    };
    const decreaseTx = await nfpm.decreaseLiquidity(decreaseParams);
    await decreaseTx.wait();
    console.log("Liquidity decreased.");
  }

  // 6. Collect all tokens (principal + fees)
  console.log("Collecting WETH and OUTLAW from NonfungiblePositionManager...");
  const collectParams = {
    tokenId: tokenId,
    recipient: founder1.address,
    amount0Max: 2n ** 128n - 1n,
    amount1Max: 2n ** 128n - 1n
  };
  const collectTx = await nfpm.collect(collectParams);
  const collectReceipt = await collectTx.wait();
  console.log("Collect transaction completed!");

  // 7. Verify OUTLAW and WETH balances of Founder Wallet 1
  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    OUTLAW_ADDRESS
  );
  const weth = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    WETH_ADDRESS
  );

  const outlawBal = await token.balanceOf(founder1.address);
  const wethBal = await weth.balanceOf(founder1.address);

  console.log(`\n====================================================`);
  console.log(`            LP REMOVAL SUMMARY REPORT`);
  console.log(`====================================================`);
  console.log(`  Recovered OUTLAW: ${hre.ethers.formatUnits(outlawBal, 18)} OUTLAW`);
  console.log(`  Recovered WETH:   ${hre.ethers.formatEther(wethBal)} WETH`);
  console.log(`====================================================`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
