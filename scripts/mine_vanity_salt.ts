import { ethers } from "ethers";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

/**
 * Robinhood Chain CREATE2 Vanity Miner
 * Generates salt for a factory contract to deploy $HOARD at a vanity address starting with 0x4663...
 * (4663 is Robinhood Chain ID)
 */

async function mineVanityAddress() {
  console.log("=================================================");
  console.log("  ROBINHOOD CHAIN VANITY MINER (Prefix: 0x4663)");
  console.log("  Chain ID: 4663 (Robinhood Chain Mainnet)");
  console.log("=================================================\n");

  // Factory address on Robinhood Chain
  // e.g. Pons V2 Factory or Custom Deployer Factory
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

  // Init code hash of the token bytecode
  // Replace with actual bytecode keccak256 hash when ready to deploy
  const sampleInitCode = "0x608060405234801561001057600080fd5b506101...HOARD_INIT_CODE";
  const initCodeHash = ethers.keccak256(ethers.toUtf8Bytes(sampleInitCode));

  const TARGET_PREFIX = "0x4663";
  console.log(`Target Prefix: ${TARGET_PREFIX}`);
  console.log(`Deployer Factory: ${FACTORY_ADDRESS}`);
  console.log(`Init Code Hash: ${initCodeHash}\n`);
  console.log("Mining salt (searching ~65,536 combinations on average)...");

  const startTime = Date.now();
  let attempts = 0;

  while (true) {
    attempts++;
    const salt = ethers.hexlify(crypto.randomBytes(32));
    const predicted = ethers.getCreate2Address(FACTORY_ADDRESS, salt, initCodeHash);

    if (predicted.toLowerCase().startsWith(TARGET_PREFIX.toLowerCase())) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log("\n================ SUCCESS FOUND! ================");
      console.log(`Vanity Contract Address : ${predicted}`);
      console.log(`Matching Salt           : ${salt}`);
      console.log(`Attempts Checked        : ${attempts.toLocaleString()}`);
      console.log(`Time Taken              : ${elapsed}s`);
      console.log("================================================\n");

      // Save to scratch file
      const outPath = path.join(__dirname, "../scratch/vanity_salt.json");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(
        outPath,
        JSON.stringify(
          {
            targetPrefix: TARGET_PREFIX,
            factory: FACTORY_ADDRESS,
            predictedAddress: predicted,
            salt: salt,
            initCodeHash: initCodeHash,
            timestamp: new Date().toISOString()
          },
          null,
          2
        )
      );
      console.log(`Results saved to: scratch/vanity_salt.json`);
      break;
    }

    if (attempts % 100000 === 0) {
      console.log(`Searched ${attempts.toLocaleString()} salts...`);
    }
  }
}

mineVanityAddress().catch(console.error);
