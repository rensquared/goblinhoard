import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const txCount = await ethers.provider.getTransactionCount(deployer.address, "latest");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Latest confirmed nonce: ${txCount}`);
  
  // Let's scan transactions around the latest blocks
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log(`Current block number: ${blockNumber}`);
  
  // We can query the last 50 blocks for any transactions from our deployer
  for (let i = blockNumber - 100; i <= blockNumber; i++) {
    const block = await ethers.provider.getBlock(i, true);
    if (!block || !block.prefetchedTransactions) continue;
    for (const tx of block.prefetchedTransactions) {
      if (tx.from.toLowerCase() === deployer.address.toLowerCase()) {
        const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        console.log(`Block ${i} | Nonce ${tx.nonce} | Hash ${tx.hash} | GasPrice ${ethers.formatUnits(tx.gasPrice || 0n, "gwei")} gwei`);
        if (receipt) {
          console.log(`  Status: ${receipt.status === 1 ? "SUCCESS" : "REVERTED"}`);
          if (receipt.contractAddress) {
            console.log(`  Created Contract: ${receipt.contractAddress}`);
          }
        }
      }
    }
  }
}

main().catch(console.error);
