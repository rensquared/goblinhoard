import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const TX_HASH = "0x914ae728c25158bb12a3f34376a55d0f88e505086f0247bbe0fbabf899536b9e";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);

  console.log("Tx From:", tx?.from);
  console.log("Tx To:", tx?.to);
  console.log("Tx Value:", tx?.value ? ethers.formatEther(tx.value) : "0", "ETH");
  console.log("Gas Used:", receipt?.gasUsed.toString());
  console.log("Logs count:", receipt?.logs.length);

  // Let's decode the LaunchForwarder calldata
  const FORWARDER_ABI = [
    "function launchAndBuy((string name, string symbol, string uri, string description, (string website, string twitter, string telegram, string discord, string other) socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 salt1, bytes32 salt2) params, uint256 minTokensOut, address referrer, uint256 buyAmount, uint256 deadline, address recipient, address[] route) payable"
  ];
  const iface = new ethers.Interface(FORWARDER_ABI);
  const decoded = iface.parseTransaction({ data: tx!.data, value: tx!.value });
  console.log("Decoded params:");
  console.log("salt1:", decoded?.args.params.salt1);
  console.log("salt2:", decoded?.args.params.salt2);
  console.log("creatorFeeRecipient:", decoded?.args.params.creatorFeeRecipient);

  // Let's inspect logs for deployed address
  // Let's inspect contracts
  const code31 = await provider.getCode("0x31eA5b453A6Cd60F36203830DE046ff32DeC2CDB");
  console.log("0x31eA code length:", code31.length);
  const code37 = await provider.getCode("0x3711cea4feade896c913c68f01eda97cb06d1a42");
  console.log("0x3711 code length:", code37.length);

  // Check factory methods
  const FACTORY_ABI = [
    "function launchDeployer() external view returns (address)",
    "function getLaunchedToken(bytes32 salt) external view returns (address token, address curve)"
  ];
  const tokenCode = await provider.getCode("0xc9564cc1818b69E09789B1D67da684692A6daAA6");
  console.log("Deployed token runtime code length:", tokenCode.length);
  console.log("Runtime code hash:", ethers.keccak256(tokenCode));

  // Let's also check Blockscout internal transactions
  try {
    const res = await fetch("https://robinhoodchain.blockscout.com/api/v2/transactions/0x914ae728c25158bb12a3f34376a55d0f88e505086f0247bbe0fbabf899536b9e/internal-transactions");
    const json: any = await res.json();
    console.log("Internal txs count:", json.items?.length);
    for (const item of json.items || []) {
      console.log(`Internal: ${item.type} from ${item.from?.hash} to ${item.to?.hash} created_contract: ${item.created_contract?.hash}`);
    }
  } catch (err: any) {
    console.log("Blockscout fetch error:", err.message);
  }
}

main().catch(console.error);
