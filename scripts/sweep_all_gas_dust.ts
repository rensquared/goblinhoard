import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY missing");
  const deployer = new ethers.Wallet(privKey, provider);

  const walletsPath = path.resolve("./wallets_hoard.json");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  for (const sw of hoardData.subWallets) {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const bal = await provider.getBalance(swWallet.address);

    if (bal > ethers.parseEther("0.00005")) {
      const feeData = await provider.getFeeData();
      const gasPrice = (feeData.gasPrice || 30000000n) * 12n / 10n; // 1.2x
      const gasCost = gasPrice * 21000n;
      const sendAmt = bal - gasCost;

      if (sendAmt > 0n) {
        console.log(`Sweeping SW ${sw.id} (${ethers.formatEther(sendAmt)} ETH)...`);
        try {
          const tx = await swWallet.sendTransaction({
            to: deployer.address,
            value: sendAmt,
            gasLimit: 21000,
            gasPrice: gasPrice
          });
          const rc = await tx.wait();
          console.log(`  ✓ Swept block ${rc?.blockNumber}! Tx: ${tx.hash}`);
        } catch (err: any) {
          console.error(`  ✕ Error SW ${sw.id}:`, err.message);
        }
      }
    }
  }

  const finalBal = await provider.getBalance(deployer.address);
  console.log(`\nFinal Deployer Balance: ${ethers.formatEther(finalBal)} ETH`);
}

main().catch(console.error);
