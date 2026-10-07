import hre from "hardhat";

async function main() {
  const txHash = "0xcc781d6bd0a31e825fb7bfd683e00a4829e6be4e52a8a649383b5902c21a2819";
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.log("Transaction receipt not found!");
    return;
  }

  console.log(`Transaction status: ${receipt.status === 1 ? "Success" : "Failed"}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log("Logs emitted:");
  for (const log of receipt.logs) {
    console.log(`  Address: ${log.address} | Topics: ${log.topics.join(", ")}`);
  }
}

main().catch(console.error);
