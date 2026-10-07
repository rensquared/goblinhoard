import hre from "hardhat";

async function main() {
  const address = "0x9325bcA0D53f5BeB1DeD01d5Cbb58025dc5fe63f";
  
  const pendingCount = await hre.ethers.provider.getTransactionCount(address, "pending");
  const latestCount = await hre.ethers.provider.getTransactionCount(address, "latest");
  const balance = await hre.ethers.provider.getBalance(address);

  console.log(`Deployer Address: ${address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);
  console.log(`Latest Nonce: ${latestCount}`);
  console.log(`Pending Nonce: ${pendingCount}`);

  // Query block explorer api or loop backwards to find recent transactions
  const blockNum = await hre.ethers.provider.getBlockNumber();
  console.log(`Current Block Number: ${blockNum}`);
}

main().catch(console.error);
