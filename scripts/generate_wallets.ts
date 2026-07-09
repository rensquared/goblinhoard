import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Generating 30 wallets...");
  const rewardWallets = [];
  const founderWallets = [];

  for (let i = 0; i < 20; i++) {
    const wallet = ethers.Wallet.createRandom();
    rewardWallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
    });
  }

  for (let i = 0; i < 10; i++) {
    const wallet = ethers.Wallet.createRandom();
    founderWallets.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
    });
  }

  const output = {
    reward: rewardWallets,
    founder: founderWallets,
  };

  const outputPath = path.resolve("./wallets.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Generated 20 reward wallets and 10 founder wallets.`);
  console.log(`Saved credentials to wallets.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
