import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Initiating rigorous system balance check on-chain...");

  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found!");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = deployed.token;
  const WETH_ADDRESS = deployed.weth;
  const POOL_ADDRESS = deployed.pool;
  const NFPM_ADDRESS = deployed.nfpm;

  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found!");
  }
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;
  const rewardWallets = wallets.reward;

  const weth = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    WETH_ADDRESS
  );

  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    tokenAddress
  );

  const nfpm = await hre.ethers.getContractAt(
    [
      "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
    ],
    NFPM_ADDRESS
  );

  const report: any = {
    deployer: {},
    founders: [],
    rewards: [],
    pool: {},
    lp: {}
  };

  // 1. Deployer Wallet
  const deployerAddr = "0x9325bcA0D53f5BeB1DeD01d5Cbb58025dc5fe63f";
  report.deployer.address = deployerAddr;
  report.deployer.eth = await hre.ethers.provider.getBalance(deployerAddr);
  report.deployer.weth = await weth.balanceOf(deployerAddr);
  report.deployer.outlaw = await token.balanceOf(deployerAddr);

  // 2. Founder Wallets
  for (let i = 0; i < founderWallets.length; i++) {
    const addr = founderWallets[i].address;
    const eth = await hre.ethers.provider.getBalance(addr);
    const wethBal = await weth.balanceOf(addr);
    const outlaw = await token.balanceOf(addr);
    report.founders.push({ index: i + 1, address: addr, eth, weth: wethBal, outlaw });
  }

  // 3. Reward Wallets
  for (let i = 0; i < rewardWallets.length; i++) {
    const addr = rewardWallets[i].address;
    const eth = await hre.ethers.provider.getBalance(addr);
    const wethBal = await weth.balanceOf(addr);
    const outlaw = await token.balanceOf(addr);
    report.rewards.push({ index: i + 1, address: addr, eth, weth: wethBal, outlaw });
  }

  // 4. Pool Contract
  report.pool.address = POOL_ADDRESS;
  report.pool.eth = await hre.ethers.provider.getBalance(POOL_ADDRESS);
  report.pool.weth = await weth.balanceOf(POOL_ADDRESS);
  report.pool.outlaw = await token.balanceOf(POOL_ADDRESS);

  // 5. LP Position ID 107945
  try {
    const pos = await nfpm.positions(107945n);
    report.lp.tokenId = "107945";
    report.lp.liquidity = pos.liquidity.toString();
    report.lp.tokensOwed0 = pos.tokensOwed0;
    report.lp.tokensOwed1 = pos.tokensOwed1;
  } catch (err: any) {
    report.lp.error = err.message;
  }

  // Save report to disk
  fs.writeFileSync(
    "./scratch/balance_check_report.json",
    JSON.stringify(
      report,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    ),
    "utf8"
  );
  console.log("Rigorous check complete! Report saved to scratch/balance_check_report.json.");
}

main().catch(console.error);
