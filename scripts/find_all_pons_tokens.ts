import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);

  // Query events on factory from recent blocks
  const factory = new ethers.Contract(FACTORY, [
    "event TokenLaunched(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint16 creatorTaxBps, uint8 configId)"
  ], provider);

  // Look in the last 20,000 blocks (~6-8 hours)
  const filter = factory.filters.TokenLaunched();
  const logs = await factory.queryFilter(filter, currentBlock - 30000, currentBlock);
  console.log(`Found ${logs.length} tokens launched in last 30k blocks:`);

  for (const log of logs.slice(-5)) {
    const parsed = factory.interface.parseLog(log);
    if (parsed) {
      const curveBal = await provider.getBalance(parsed.args.curve);
      console.log(`---`);
      console.log(`Token:  ${parsed.args.token} (${parsed.args.name} - $${parsed.args.symbol})`);
      console.log(`Curve:  ${parsed.args.curve}`);
      console.log(`Creator: ${parsed.args.creator}`);
      console.log(`Curve ETH Balance: ${ethers.formatEther(curveBal)} ETH`);
      console.log(`Creator Tax: ${parsed.args.creatorTaxBps} bps`);
    }
  }
}

main().catch(console.error);
