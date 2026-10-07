import { ethers } from "ethers";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const deployer = process.env.FACTORY_ADDRESS || "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const initCodeHash = ethers.keccak256(ethers.toUtf8Bytes("OutlawHoardTokenInitCode"));
const TARGET_PREFIX = "0x4663";
const TARGET_SUFFIX = "f00d"; // FOOD

if (isMainThread) {
  const cpus = os.cpus().length;
  console.log("==========================================================");
  console.log(`  PARALLEL VANITY MINER: ${TARGET_PREFIX}...${TARGET_SUFFIX.toUpperCase()} (FOOD)`);
  console.log(`  Chain ID: 4663 (Robinhood Chain Mainnet)`);
  console.log(`  Spawning ${cpus} worker threads across all CPU cores...`);
  console.log("==========================================================\n");

  let found = false;
  const start = Date.now();
  let totalAttempts = 0;
  const workers: Worker[] = [];

  for (let i = 0; i < cpus; i++) {
    const worker = new Worker(__filename, {
      workerData: { deployer, initCodeHash, TARGET_PREFIX, TARGET_SUFFIX, threadId: i }
    });
    workers.push(worker);

    worker.on("message", (msg) => {
      if (msg.type === "found" && !found) {
        found = true;
        const elapsed = ((Date.now() - start) / 1000).toFixed(2);
        console.log("\n==================== MATCH FOUND! ====================");
        console.log(`Vanity Contract Address : ${msg.addr}`);
        console.log(`Matching Salt           : ${msg.salt}`);
        console.log(`Total Attempts Checked  : ${(totalAttempts + msg.attempts).toLocaleString()}`);
        console.log(`Total Time Taken        : ${elapsed}s`);
        console.log("======================================================\n");

        const outPath = path.join(__dirname, "../scratch/vanity_food.json");
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(
          outPath,
          JSON.stringify(
            {
              vanityAddress: msg.addr,
              prefix: TARGET_PREFIX,
              suffix: TARGET_SUFFIX,
              salt: msg.salt,
              deployer,
              initCodeHash,
              timestamp: new Date().toISOString()
            },
            null,
            2
          )
        );
        console.log(`Saved result to: scratch/vanity_food.json`);

        // Terminate all workers
        workers.forEach((w) => w.terminate());
        process.exit(0);
      } else if (msg.type === "progress") {
        totalAttempts += msg.count;
        if (totalAttempts % 4000000 === 0) {
          const rate = Math.floor(totalAttempts / ((Date.now() - start) / 1000));
          console.log(`Checked ${totalAttempts.toLocaleString()} salts... (${rate.toLocaleString()} salts/sec)`);
        }
      }
    });
  }
} else {
  const { deployer, initCodeHash, TARGET_PREFIX, TARGET_SUFFIX } = workerData;
  const prefixLower = TARGET_PREFIX.toLowerCase();
  const suffixLower = TARGET_SUFFIX.toLowerCase();

  // Optimized buffer creation
  const deployerBytes = Buffer.from(deployer.slice(2), "hex");
  const initHashBytes = Buffer.from(initCodeHash.slice(2), "hex");

  let attempts = 0;
  while (true) {
    attempts++;
    const saltBytes = crypto.randomBytes(32);
    // CREATE2 hash: keccak256(0xff ++ deployer ++ salt ++ initCodeHash)
    const preimage = Buffer.concat([
      Buffer.from([0xff]),
      deployerBytes,
      saltBytes,
      initHashBytes
    ]);
    const hash = ethers.keccak256(preimage);
    const addr = "0x" + hash.slice(26);

    if (addr.toLowerCase().startsWith(prefixLower) && addr.toLowerCase().endsWith(suffixLower)) {
      parentPort?.postMessage({
        type: "found",
        addr: ethers.getAddress(addr),
        salt: "0x" + saltBytes.toString("hex"),
        attempts
      });
      break;
    }

    if (attempts % 100000 === 0) {
      parentPort?.postMessage({ type: "progress", count: 100000 });
    }
  }
}
