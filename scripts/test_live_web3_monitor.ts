import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const FEE_ESCROW_ADDR = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const SAMPLE_CREATOR = "0x9d6d78d710f68882582dc34edd8fe707444c2df4"; // Sample creator from prior audit

const ESCROW_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function totalClaimed(address account) external view returns (uint256)",
  "event Deposited(address indexed recipient, uint256 amount)"
];

async function main() {
  console.log("Testing live on-chain FeeEscrow reader on Robinhood Chain...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const escrow = new ethers.Contract(FEE_ESCROW_ADDR, ESCROW_ABI, provider);
  const [unclaimed, blockNum] = await Promise.all([
    escrow.balanceOf(SAMPLE_CREATOR),
    provider.getBlockNumber()
  ]);

  console.log(`Current Block Number: ${blockNum}`);
  console.log(`Sample Creator (${SAMPLE_CREATOR.slice(0, 8)}...) Unclaimed Creator Fees: ${ethers.formatEther(unclaimed)} ETH`);
  
  const FEE_PER_GOBLIN = 0.003;
  const accruedEth = parseFloat(ethers.formatEther(unclaimed));
  const goblinsEarned = Math.floor(accruedEth / FEE_PER_GOBLIN);
  console.log(`Goblins Recruited from these fees: ${goblinsEarned} Goblins`);
  console.log("Live reader query succeeded!");
}

main().catch(console.error);
