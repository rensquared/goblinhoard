import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Executing first buy from deployer: ${deployer.address}`);

  const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
  const ROUTER_ADDRESS = "0xCaf681a66D020601342297493863E78C959E5cb2";
  const OUTLAW_ADDRESS = "0xf8101a357Dd585Da279c8adDF1ED110745986199";

  const weth = await hre.ethers.getContractAt(
    [
      "function deposit() external payable",
      "function approve(address guy, uint wad) external returns (bool)",
      "function balanceOf(address src) external view returns (uint)"
    ],
    WETH_ADDRESS
  );

  const router = await hre.ethers.getContractAt(
    [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) calldata params) external payable returns (uint256 amountOut)"
    ],
    ROUTER_ADDRESS
  );

  // 1. Wrap 0.0015 ETH into WETH
  const wrapAmount = hre.ethers.parseEther("0.0015");
  console.log(`Wrapping ${hre.ethers.formatEther(wrapAmount)} ETH into WETH...`);
  const wrapTx = await weth.deposit({ value: wrapAmount });
  await wrapTx.wait();
  console.log("WETH wrap complete.");

  // 2. Approve SwapRouter to spend WETH
  console.log("Approving SwapRouter to spend WETH...");
  const approveTx = await weth.approve(ROUTER_ADDRESS, wrapAmount);
  await approveTx.wait();
  console.log("Approval complete.");

  // 3. Execute Swap WETH -> OUTLAW
  console.log("Executing swap WETH -> OUTLAW on Uniswap V3 SwapRouter...");
  const params = {
    tokenIn: WETH_ADDRESS,
    tokenOut: OUTLAW_ADDRESS,
    fee: 10000, // 1%
    recipient: deployer.address,
    amountIn: wrapAmount,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n
  };

  const swapTx = await router.exactInputSingle(params);
  const receipt = await swapTx.wait();
  console.log("Swap transaction completed!");
  console.log(`Transaction Hash: ${receipt.hash}`);

  // Check OUTLAW balance of deployer
  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    OUTLAW_ADDRESS
  );
  const outlawBal = await token.balanceOf(deployer.address);
  console.log(`First buy successful! Received: ${hre.ethers.formatUnits(outlawBal, 18)} OUTLAW`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
