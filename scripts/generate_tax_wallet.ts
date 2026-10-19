import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const taxWalletPath = path.resolve("./tax_wallet.json");
  if (fs.existsSync(taxWalletPath)) {
    const existing = JSON.parse(fs.readFileSync(taxWalletPath, "utf8"));
    console.log("Tax wallet already exists:");
    console.log("Address:", existing.address);
    return;
  }

  const wallet = ethers.Wallet.createRandom();
  const data = {
    role: "Dedicated Creator Tax Escrow Recipient",
    purpose: "Receives 2.5% creator tax from Pons V2 bonding curve for Goblin Hoard ($HOARD)",
    address: wallet.address,
    privateKey: wallet.privateKey,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(taxWalletPath, JSON.stringify(data, null, 2));
  console.log("==================================================================");
  console.log("   DEDICATED TAX WALLET GENERATED FOR GOBLIN HOARD ($HOARD)      ");
  console.log("==================================================================");
  console.log(`Address:     ${wallet.address}`);
  console.log(`Saved to:    tax_wallet.json (git-ignored)`);
  console.log("==================================================================");
}

main().catch(console.error);
