import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found! Run deploy_and_setup_lp.ts first.");
  }
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const ROUTER = ethers.getAddress(deployed.router.toLowerCase());
  const OUTLAW_ADDRESS = ethers.getAddress(deployed.token.toLowerCase());

  const [deployer] = await ethers.getSigners();
  console.log(`Starting setup using deployer: ${deployer.address}`);

  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found! Run generate_wallets.ts first.");
  }

  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;

  const token = await ethers.getContractAt("OutlawToken", OUTLAW_ADDRESS);
  const gasAmount = ethers.parseEther("0.0005"); // 0.0005 ETH is plenty for multiple swaps on Robinhood Chain

  console.log(`Funding and approving ${founderWallets.length} founder wallets...`);

  let nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");

  for (let i = 0; i < founderWallets.length; i++) {
    const fData = founderWallets[i];
    const wallet = new ethers.Wallet(fData.privateKey, ethers.provider);

    // 1. Send gas (ETH) from deployer to founder wallet
    console.log(`Funding Wallet ${i + 1} (${wallet.address}) with 0.0005 ETH...`);
    const balance = await ethers.provider.getBalance(wallet.address);
    if (balance < ethers.parseEther("0.00025")) {
      let sent = false;
      let retries = 0;
      while (!sent && retries < 5) {
        try {
          const fundTx = await deployer.sendTransaction({
            to: wallet.address,
            value: gasAmount,
            nonce: nonce
          });
          await fundTx.wait();
          nonce++;
          sent = true;
          console.log(`  Sent 0.0005 ETH gas to ${wallet.address}`);
        } catch (error: any) {
          if (error.message.includes("nonce too low")) {
            nonce++;
            retries++;
            console.log(`  Nonce too low. Retrying with incremented nonce: ${nonce}...`);
          } else {
            throw error;
          }
        }
      }
    } else {
      console.log(`  Wallet ${wallet.address} already has gas.`);
    }

    // 2. Approve Router on the OutlawToken contract
    console.log(`  Approving SwapRouter for Wallet ${i + 1}...`);
    const allowance = await token.allowance(wallet.address, ROUTER);
    if (allowance === 0n) {
      const approveTx = await token.connect(wallet).approve(ROUTER, ethers.MaxUint256);
      await approveTx.wait();
      console.log(`  SwapRouter approved successfully!`);
    } else {
      console.log(`  SwapRouter already approved.`);
    }
  }

  console.log("\nSetup complete! All founder wallets are funded with gas and authorized to sell on SwapRouter02.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
