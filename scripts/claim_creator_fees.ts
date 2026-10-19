import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const FEE_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

const ESCROW_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function claim() external returns (uint256 amount)"
];

async function main() {
  console.log("==========================================================");
  console.log("   GOBLIN HOARD - 2.5% CREATOR TAX FEE CLAIMER            ");
  console.log("==========================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const taxWalletPath = path.resolve("./tax_wallet.json");
  if (!fs.existsSync(taxWalletPath)) throw new Error("tax_wallet.json not found!");
  const taxData = JSON.parse(fs.readFileSync(taxWalletPath, "utf8"));
  const taxWallet = new ethers.Wallet(taxData.privateKey, provider);

  const escrow = new ethers.Contract(FEE_ESCROW, ESCROW_ABI, taxWallet);

  const pending = await escrow.balanceOf(taxWallet.address);
  const curBal = await provider.getBalance(taxWallet.address);

  console.log(`Tax Wallet:        ${taxWallet.address}`);
  console.log(`Current Balance:   ${ethers.formatEther(curBal)} ETH`);
  console.log(`Claimable in Escrow: ${ethers.formatEther(pending)} ETH\n`);

  if (pending > 0n) {
    // 1. Ensure tax wallet has tiny gas for claim
    if (curBal < ethers.parseEther("0.00003")) {
      const privKey = process.env.PRIVATE_KEY;
      if (privKey) {
        const deployer = new ethers.Wallet(privKey, provider);
        const feeData = await provider.getFeeData();
        const gasPrice = (feeData.gasPrice || 30000000n) * 12n / 10n;
        console.log("Funding Tax Wallet with 0.00005 ETH for gas...");
        const fundTx = await deployer.sendTransaction({
          to: taxWallet.address,
          value: ethers.parseEther("0.00005"),
          gasLimit: 21000,
          gasPrice
        });
        await fundTx.wait();
      }
    }

    // 2. Claim fees from Escrow
    console.log("Claiming accrued ETH creator fees...");
    const feeData = await provider.getFeeData();
    const gasPrice = (feeData.gasPrice || 30000000n) * 12n / 10n;
    const tx = await escrow.claim({ gasLimit: 250000, gasPrice });
    const receipt = await tx.wait();
    console.log(`✓ Fees claimed in block ${receipt?.blockNumber}! Tx: ${tx.hash}`);

    const newBal = await provider.getBalance(taxWallet.address);
    console.log(`Updated Tax Wallet Balance: ${ethers.formatEther(newBal)} ETH`);

    // 3. Sweep all proceeds directly to deployer
    const privKey = process.env.PRIVATE_KEY;
    if (privKey) {
      const deployer = new ethers.Wallet(privKey, provider);
      const sweepFeeData = await provider.getFeeData();
      const sweepGasPrice = (sweepFeeData.gasPrice || 30000000n) * 12n / 10n;
      const gasCost = sweepGasPrice * 21000n;
      const safetyBuffer = gasCost + ethers.parseEther("0.000001");

      if (newBal > safetyBuffer) {
        const sweepAmt = newBal - safetyBuffer;
        console.log(`Sweeping ${ethers.formatEther(sweepAmt)} ETH to Deployer (${deployer.address})...`);
        const sweepTx = await taxWallet.sendTransaction({
          to: deployer.address,
          value: sweepAmt,
          gasLimit: 21000,
          gasPrice: sweepGasPrice
        });
        const sweepRc = await sweepTx.wait();
        console.log(`✓ Swept to Deployer in block ${sweepRc?.blockNumber}! Tx: ${sweepTx.hash}`);
        const depBal = await provider.getBalance(deployer.address);
        console.log(`\n==========================================================`);
        console.log(`🎉 SUCCESS! Deployer Final Balance: ${ethers.formatEther(depBal)} ETH`);
        console.log(`==========================================================`);
      }
    }
  } else {
    console.log("No pending fees to claim at this moment.");
  }
}

main().catch(console.error);
