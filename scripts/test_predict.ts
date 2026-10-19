import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const p = new ethers.JsonRpcProvider(RPC_URL);

async function main() {
  const DEPLOYER_ADDR = "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42";
  
  // ABI of predictLaunchAddresses
  const abi = [
    `function predictLaunchAddresses(
      (
        address tokenImplementation,
        address curveImplementation,
        address feeEscrow,
        address launchpadFactory,
        (address recipient, uint16 feeBps, uint16 burnBps, uint16 creatorTaxBps, uint16 referralTaxBps) fees,
        address creator,
        address referrer,
        uint256 totalSupply,
        uint256 initialCurveSupply,
        uint256 graduationThreshold,
        bool buybackEnabled,
        uint256 minBuy,
        uint256 maxBuy,
        bytes32 salt,
        string name,
        string symbol,
        string uri,
        string description,
        (string website, string twitter, string telegram, string discord, string other) socials
      ) params
    ) external view returns (address token, address curve)`
  ];

  const contract = new ethers.Contract(DEPLOYER_ADDR, abi, p);
  const sel = contract.interface.getFunction("predictLaunchAddresses")?.selector;
  console.log("predictLaunchAddresses selector:", sel);

  // Parameters from test deploy
  const testParams = {
    tokenImplementation: "0x29fcb43b46531bca003ddc8fcb67ffe91900c762",
    curveImplementation: "0xc7819b64a1daecd7ec19856d026cb14efbd89046",
    feeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
    launchpadFactory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
    fees: {
      recipient: "0x3E90d09B0aD64aDAF10E62533f4b90DD47aBD9A3",
      feeBps: 100, // 1% ecosystem fee
      burnBps: 0,
      creatorTaxBps: 250, // 2.5%
      referralTaxBps: 0
    },
    creator: "0x3E90d09B0aD64aDAF10E62533f4b90DD47aBD9A3",
    referrer: ethers.ZeroAddress,
    totalSupply: ethers.parseEther("1000000000"), // 1B
    initialCurveSupply: ethers.parseEther("800000000"), // 800M
    graduationThreshold: ethers.parseEther("10"), // 10 ETH
    buybackEnabled: false,
    minBuy: 0,
    maxBuy: 0,
    salt: "0xc182e56ef02dd08908f58c46dea5f53f24a1e9f85329cb356fab0302a31b68cd",
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
    }
  };

  const vanityFood = JSON.parse(fs.readFileSync(path.resolve("./scratch/vanity_food.json"), "utf8"));
  testParams.salt = vanityFood.salt;
  testParams.fees.recipient = vanityFood.taxRecipient;

  testParams.name = "Goblin Hoard";
  testParams.symbol = "HOARD";
  const res1 = await contract.predictLaunchAddresses(testParams);
  console.log("With 'Goblin Hoard':", res1[0]);

  testParams.name = "Hoarded";
  testParams.symbol = "HOARD";
  const res2 = await contract.predictLaunchAddresses(testParams);
  console.log("With 'Hoarded':     ", res2[0]);
}

main().catch(console.error);
