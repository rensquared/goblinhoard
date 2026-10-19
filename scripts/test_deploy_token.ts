import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const LAUNCH_FORWARDER = "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948";
const PONS_V2_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

const FORWARDER_ABI = [
  "function launchAndBuy((string name, string symbol, string uri, string description, (string website, string twitter, string telegram, string discord, string other) socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 salt1, bytes32 salt2) params, uint256 minTokensOut, address referrer, uint256 buyAmount, uint256 deadline, address recipient, address[] route) payable"
];

const FACTORY_ABI = [
  "event TokenLaunched(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint16 creatorTaxBps, uint8 configId)"
];

async function main() {
  console.log("==================================================================");
  console.log("    PONS V2 TEST DEPLOYMENT WITH SOCIALS, LOGO & CREATOR TAX     ");
  console.log("    Network: Robinhood Chain Mainnet (Chain ID 4663)             ");
  console.log("==================================================================\n");

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) {
    throw new Error("PRIVATE_KEY not found in .env! Add it to d:\\project\\robinchain\\.env");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(privKey, provider);
  const balance = await provider.getBalance(deployer.address);

  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Current Balance:  ${ethers.formatEther(balance)} ETH\n`);

  if (balance < ethers.parseEther("0.002")) {
    console.error("✗ Deployer balance too low. At least ~0.002 ETH required.");
    return;
  }

  const forwarder = new ethers.Contract(LAUNCH_FORWARDER, FORWARDER_ABI, deployer);
  const factory = new ethers.Contract(PONS_V2_FACTORY, FACTORY_ABI, provider);

  // Small test buy amount: 0.001 ETH (~$2.50)
  const testBuyAmount = ethers.parseEther("0.001");
  const launchFee = ethers.parseEther("0.0005");
  const totalValue = launchFee + testBuyAmount; // 0.0015 ETH total (~$3.75)

  const salt1 = ethers.ZeroHash;
  const salt2 = ethers.hexlify(ethers.randomBytes(32));

  const launchParams = {
    name: "Goblin Hoard Test",
    symbol: "GTEST",
    uri: "https://hoarded.fun/icon.png",
    description: "The Hoard gathers. 2.5% creator tax recruits goblins that buy $HOARD until migration.",
    socials: {
      website: "https://hoarded.fun",
      twitter: "https://x.com/hoardedfun",
      telegram: "https://t.me/hoardedfun",
      discord: "",
      other: ""
    },
    creatorFeeRecipient: deployer.address,
    creatorTaxBps: 250, // 2.5% creator tax
    buybackEnabled: false,
    salt1: salt1,
    salt2: salt2
  };

  const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 mins

  console.log("Submitting launchAndBuy transaction via Pons LaunchForwarder...");
  console.log(`- Token Name:   ${launchParams.name}`);
  console.log(`- Token Symbol: ${launchParams.symbol}`);
  console.log(`- Website:      ${launchParams.socials.website}`);
  console.log(`- Twitter:      ${launchParams.socials.twitter}`);
  console.log(`- Telegram:     ${launchParams.socials.telegram}`);
  console.log(`- Creator Tax:  2.5% (250 bps)`);
  console.log(`- Test Buy:     ${ethers.formatEther(testBuyAmount)} ETH`);
  console.log(`- Total Value:  ${ethers.formatEther(totalValue)} ETH (~$3.75)\n`);

  // Arg order: (params, minTokensOut, referrer, buyAmount, deadline, recipient, route)
  const tx = await forwarder.launchAndBuy(
    launchParams,
    0n, // minTokensOut
    ethers.ZeroAddress, // referrer
    testBuyAmount, // buyAmount
    deadline,
    deployer.address,
    [],
    { value: totalValue, gasLimit: 4500000 }
  );

  console.log(`Transaction broadcasted: ${tx.hash}`);
  console.log("Waiting for block confirmation on Robinhood Chain...");
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}!\n`);

  let tokenAddr = "";
  let curveAddr = "";
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed && parsed.name === "TokenLaunched") {
        tokenAddr = parsed.args.token;
        curveAddr = parsed.args.curve;
        break;
      }
    } catch {}
  }

  console.log("==================================================================");
  console.log("🎉 SUCCESS! PONS V2 TEST TOKEN DEPLOYED WITH FULL METADATA");
  console.log("==================================================================");
  console.log(`Token Address: ${tokenAddr}`);
  console.log(`Curve Address: ${curveAddr}`);
  console.log(`Pons URL:      https://ponsfamily.com/token/${tokenAddr}`);
  console.log(`Blockscout:    https://robinhoodchain.blockscout.com/token/${tokenAddr}`);
  console.log("==================================================================");
}

main().catch(console.error);
