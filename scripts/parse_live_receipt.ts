import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const TX_HASH = "0x102b6e81426dc6ecf5d9f9cbee63381a4080acc2b42815cec47a63d5bd24d2b4";

async function main() {
  const p = new ethers.JsonRpcProvider(RPC_URL);
  const receipt = await p.getTransactionReceipt(TX_HASH);
  console.log("Status:", receipt?.status);
  console.log("Block:", receipt?.blockNumber);
  console.log("Logs count:", receipt?.logs.length);

  for (const log of receipt!.logs) {
    console.log(`Log from ${log.address} - topics:`, log.topics);
  }
}

main().catch(console.error);
