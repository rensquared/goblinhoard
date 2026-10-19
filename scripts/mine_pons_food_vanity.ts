import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("==================================================================");
  console.log("     PONS V2 FAST LOCAL EVM VANITY MINER: PREFIX 0xf00d...        ");
  console.log("     Running in local Hardhat fork against Robinhood Mainnet       ");
  console.log("==================================================================\n");

  const DEPLOYER_ADDR = "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42";
  const MinerFactory = await ethers.getContractFactory("PonsVanityMiner");
  const miner = await MinerFactory.deploy(DEPLOYER_ADDR);
  await miner.waitForDeployment();
  console.log("Vanity Miner contract deployed locally.");

  // Load Tax Wallet
  const taxWalletPath = path.resolve("./tax_wallet.json");
  const taxData = JSON.parse(fs.readFileSync(taxWalletPath, "utf8"));

  const params = {
    tokenImplementation: "0x29fcb43b46531bca003ddc8fcb67ffe91900c762",
    curveImplementation: "0xc7819b64a1daecd7ec19856d026cb14efbd89046",
    feeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
    launchpadFactory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
    fees: {
      recipient: taxData.address,
      feeBps: 100,
      burnBps: 0,
      creatorTaxBps: 250,
      referralTaxBps: 0
    },
    creator: "0x3E90d09B0aD64aDAF10E62533f4b90DD47aBD9A3",
    referrer: ethers.ZeroAddress,
    totalSupply: ethers.parseEther("1000000000"),
    initialCurveSupply: 100n,
    graduationThreshold: ethers.parseEther("1.68"),
    buybackEnabled: false,
    minBuy: 0,
    maxBuy: 0,
    salt: ethers.ZeroHash,
    name: "Hoarded",
    symbol: "HOARD",
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

  const targetPrefix = "0xf00d";
  console.log(`Target Prefix: ${targetPrefix}`);
  console.log("Starting batch search...\n");

  const startTime = Date.now();
  const batchSize = 100;
  let attempts = 0;

  for (let batch = 0; batch < 2000; batch++) {
    const seed = Math.floor(Math.random() * 1000000000);
    const [found, salt, predictedToken] = await miner.mineVanity(
      params,
      targetPrefix,
      batchSize,
      seed
    );

    attempts += batchSize;

    if (found) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log("\n==================== MATCH FOUND! ====================");
      console.log(`Vanity Contract Address : ${predictedToken}`);
      console.log(`Matching Salt           : ${salt}`);
      console.log(`Total Attempts Checked  : ${attempts.toLocaleString()}`);
      console.log(`Time Taken              : ${elapsed}s`);
      console.log("======================================================\n");

      const outPath = path.resolve("./scratch/vanity_food.json");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(
        outPath,
        JSON.stringify(
          {
            vanityAddress: predictedToken,
            prefix: targetPrefix,
            salt: salt,
            taxRecipient: taxData.address,
            timestamp: new Date().toISOString()
          },
          null,
          2
        )
      );
      console.log(`Saved result to: scratch/vanity_food.json`);
      return;
    }

    if (attempts % 5000 === 0) {
      const rate = Math.floor(attempts / ((Date.now() - startTime) / 1000));
      console.log(`Checked ${attempts.toLocaleString()} salts... (${rate} salts/sec)`);
    }
  }

  console.log("Batch limit reached without match. Re-run to search next batches.");
}

main().catch(console.error);
