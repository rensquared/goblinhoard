import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Debugging swap from deployer: ${deployer.address}`);

  const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
  const ROUTER_ADDRESS = "0xCaf681a66D020601342297493863E78C959E5cb2";
  const OUTLAW_ADDRESS = "0xf8101a357Dd585Da279c8adDF1ED110745986199";

  const wethInfo = await hre.ethers.getContractAt(
    ["function name() external view returns (string)", "function symbol() external view returns (string)"],
    WETH_ADDRESS
  );
  try {
    console.log(`WETH Name: ${await wethInfo.name()} | Symbol: ${await wethInfo.symbol()}`);
  } catch (err: any) {
    console.log("Failed to query WETH info:", err.message);
  }

  const weth = await hre.ethers.getContractAt(
    [
      "function balanceOf(address src) external view returns (uint)",
      "function allowance(address owner, address spender) external view returns (uint256)"
    ],
    WETH_ADDRESS
  );

  const router = await hre.ethers.getContractAt(
    [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) calldata params) external payable returns (uint256 amountOut)"
    ],
    ROUTER_ADDRESS
  );

  const wethBal = await weth.balanceOf(deployer.address);
  const allowance = await weth.allowance(deployer.address, ROUTER_ADDRESS);
  console.log(`Deployer WETH balance: ${hre.ethers.formatEther(wethBal)} WETH`);
  console.log(`Router WETH allowance: ${hre.ethers.formatEther(allowance)} WETH`);
  const poolAddress = "0x4813FA328c2db857626DC7b184d721c819de6699";
  const pool = await hre.ethers.getContractAt(
    ["function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"],
    poolAddress
  );
  const slot0 = await pool.slot0();
  console.log(`Pool Price: ${slot0.sqrtPriceX96.toString()} | Tick: ${slot0.tick}`);
  const params = {
    tokenIn: WETH_ADDRESS,
    tokenOut: OUTLAW_ADDRESS,
    fee: 10000,
    recipient: deployer.address,
    amountIn: allowance,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n
  };

  console.log("Simulating exactInputSingle swap via staticCall...");
  try {
    await router.exactInputSingle.staticCall(params);
    console.log("Static call succeeded! Transaction would succeed.");
  } catch (error: any) {
    console.error("Static call failed!");
    console.error("Error details:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
