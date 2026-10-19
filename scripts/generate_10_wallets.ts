import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

interface SubWallet {
  id: number;
  role: string;
  tier: string;
  ethAllocation: string; // ETH to fund
  targetMcapSell: string;
  maxSupplyPercent: string;
  address: string;
  privateKey: string;
}

async function main() {
  console.log("------------------------------------------------");
  console.log("Generating 10 Clean Sub-Wallets for GOBLIN HOARD");
  console.log("Budget: ~$1,000 - $1,300 (~0.42 ETH)");
  console.log("Max Holding per Wallet: < 2.5% Total Supply");
  console.log("------------------------------------------------\n");

  const subWallets: SubWallet[] = [];

  const roles = [
    { role: "Alpha Sniper 1", tier: "T1 ($12K Mcap)", eth: "0.032", maxSupply: "1.8%" },
    { role: "Alpha Sniper 2", tier: "T1 ($12K Mcap)", eth: "0.030", maxSupply: "1.7%" },
    { role: "Alpha Sniper 3", tier: "T1 ($12K Mcap)", eth: "0.028", maxSupply: "1.6%" },
    { role: "Beta Swarm 1", tier: "T2 ($25K Mcap)", eth: "0.032", maxSupply: "1.8%" },
    { role: "Beta Swarm 2", tier: "T2 ($25K Mcap)", eth: "0.030", maxSupply: "1.7%" },
    { role: "Beta Swarm 3", tier: "T2 ($25K Mcap)", eth: "0.028", maxSupply: "1.6%" },
    { role: "Gamma Citadel 1", tier: "T3 ($40K Grad)", eth: "0.032", maxSupply: "1.8%" },
    { role: "Gamma Citadel 2", tier: "T3 ($40K Grad)", eth: "0.030", maxSupply: "1.7%" },
    { role: "Gamma Citadel 3", tier: "T3 ($40K Grad)", eth: "0.028", maxSupply: "1.6%" },
    { role: "Epsilon Moonbag", tier: "Post-Migration", eth: "0.025", maxSupply: "1.4%" },
  ];

  for (let i = 0; i < 10; i++) {
    const wallet = ethers.Wallet.createRandom();
    subWallets.push({
      id: i + 1,
      role: roles[i].role,
      tier: roles[i].tier,
      ethAllocation: roles[i].eth,
      targetMcapSell: roles[i].tier,
      maxSupplyPercent: roles[i].maxSupply,
      address: wallet.address,
      privateKey: wallet.privateKey,
    });
    console.log(`[Wallet ${i + 1}] ${roles[i].role} -> ${wallet.address} (Eth: ${roles[i].eth} ETH, Max Supply: ${roles[i].maxSupply})`);
  }

  const devBuyEth = "0.080"; // ~$200 dev buy (~4.5% supply)
  const totalSubWalletsEth = subWallets.reduce((acc, w) => acc + parseFloat(w.ethAllocation), 0);
  const totalEthRequired = (parseFloat(devBuyEth) + totalSubWalletsEth + 0.02).toFixed(3); // 0.02 for gas/fees

  const outputData = {
    generatedAt: new Date().toISOString(),
    network: "Robinhood Chain Mainnet (4663)",
    totalBudgetEth: totalEthRequired,
    devBuyEth,
    subWalletsCount: 10,
    subWallets,
  };

  const outputPath = path.resolve("./wallets_hoard.json");
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf8");

  console.log("\n------------------------------------------------");
  console.log(`Successfully generated 10 sub-wallets.`);
  console.log(`Dev Buy Allocation: ${devBuyEth} ETH (~$200)`);
  console.log(`Sub-Wallets Total Funding: ${totalSubWalletsEth.toFixed(3)} ETH`);
  console.log(`Estimated Total ETH Required (Inc. Launch & Gas): ~${totalEthRequired} ETH`);
  console.log(`Saved credentials securely to wallets_hoard.json (Git-ignored)`);
  console.log("------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
