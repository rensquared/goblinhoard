import { ethers } from "ethers";

async function checkGas() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.chain.robinhood.com/");
  const feeData = await provider.getFeeData();
  console.log("gasPrice:", feeData.gasPrice?.toString());
  console.log("maxFeePerGas:", feeData.maxFeePerGas?.toString());
  const gasPrice = feeData.gasPrice || 100000000n;
  const cost = 250000n * gasPrice;
  console.log("Cost for 250k gas:", ethers.formatEther(cost), "ETH");
}
checkGas().catch(console.error);
