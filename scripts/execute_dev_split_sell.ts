import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const CURVE_ABI = [
  "function quoteReserve() external view returns (uint256)",
  "function tokenReserve() external view returns (uint256)",
  "function sell(uint256 amountIn, uint256 minEthOut, address recipient) external returns (uint256 ethOut)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const ESCROW_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function claim() external returns (uint256 amount)"
];

const FEE_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

async function main() {
  console.log("==================================================================");
  console.log("   HOARDED ($HOARD) - DEV TOKEN SPLIT, DISPERSED SELL & REWIRE    ");
  console.log("   Target: Retain ~$50 worth in Deployer, Liquidate Remainder     ");
  console.log("==================================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY missing in .env");
  const deployer = new ethers.Wallet(privKey, provider);

  const receiptPath = path.resolve("./scratch/launch_receipt.json");
  const rc = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  const tokenAddress = rc.tokenAddress;
  const curveAddress = rc.curveAddress;

  const walletsPath = path.resolve("./wallets_hoard.json");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, deployer);
  const curve = new ethers.Contract(curveAddress, CURVE_ABI, provider);

  // 1. Calculate reserves, price, and $50 token retention target
  const qr = await curve.quoteReserve();
  const tr = await curve.tokenReserve();
  const priceEth = Number(qr) / Number(tr);
  const priceUsd = priceEth * 2500;
  const mcapUsd = priceEth * 1e9 * 2500;

  console.log(`Token Address: ${tokenAddress}`);
  console.log(`Curve Address: ${curveAddress}`);
  console.log(`Current Quote Reserve: ${ethers.formatEther(qr)} ETH`);
  console.log(`Current Mcap: $${mcapUsd.toFixed(2)}`);
  console.log(`Price per token: $${priceUsd.toExponential(4)}`);

  const depTokBal = await token.balanceOf(deployer.address);
  const depStartEth = await provider.getBalance(deployer.address);
  console.log(`Deployer Initial HOARD: ${ethers.formatUnits(depTokBal, 18)} HOARD`);
  console.log(`Deployer Initial ETH:   ${ethers.formatEther(depStartEth)} ETH\n`);

  // We want to keep ~$50 worth of tokens in Deployer
  const tokensFor50Usd = 50 / priceUsd;
  // Let's round to a clean 4,400,000 tokens (~$50.50 worth)
  const tokensToKeep = ethers.parseUnits("4400000", 18);
  if (depTokBal <= tokensToKeep) {
    throw new Error("Deployer balance is already at or below $50 target!");
  }

  const totalToDisperse = depTokBal - tokensToKeep;
  console.log(`>>> Tokens to KEEP in Deployer: ${ethers.formatUnits(tokensToKeep, 18)} HOARD (~$50 worth)`);
  console.log(`>>> Tokens to SPLIT & SELL:     ${ethers.formatUnits(totalToDisperse, 18)} HOARD\n`);

  // We will split across 5 intermediary wallets (Wallets 1-5)
  const workerWallets = hoardData.subWallets.slice(0, 5);
  const sharePerWallet = totalToDisperse / BigInt(workerWallets.length);
  const remainder = totalToDisperse % BigInt(workerWallets.length);

  // STEP 1: Disperse tokens from deployer to worker wallets
  console.log(">>> [STEP 1/3] Dispersing tokens from Deployer to 5 clean worker wallets...");
  for (let i = 0; i < workerWallets.length; i++) {
    const sw = workerWallets[i];
    const amountToSend = i === workerWallets.length - 1 ? sharePerWallet + remainder : sharePerWallet;
    console.log(`Sending ${ethers.formatUnits(amountToSend, 18)} HOARD to Worker ${sw.id} (${sw.address})...`);
    const tx = await token.transfer(sw.address, amountToSend);
    const receipt = await tx.wait();
    console.log(`  ✓ Transfer confirmed in block ${receipt.blockNumber}! Tx: ${tx.hash}`);
  }

  // Verify deployer token balance
  const depRemainingTok = await token.balanceOf(deployer.address);
  console.log(`\nDeployer Remaining HOARD: ${ethers.formatUnits(depRemainingTok, 18)} HOARD (~$50 worth)\n`);

  // STEP 2: Worker wallets sell on curve and rewire ETH back to Deployer
  console.log(">>> [STEP 2/3] Worker wallets selling on curve & rewiring ETH to Deployer...");
  for (const sw of workerWallets) {
    const swSigner = new ethers.Wallet(sw.privateKey, provider);
    const swToken = new ethers.Contract(tokenAddress, ERC20_ABI, swSigner);
    const swCurve = new ethers.Contract(curveAddress, CURVE_ABI, swSigner);

    const bal = await swToken.balanceOf(swSigner.address);
    if (bal === 0n) continue;

    console.log(`[Worker ${sw.id}] Selling ${ethers.formatUnits(bal, 18)} HOARD on curve...`);

    // Ensure allowance
    const allowance = await swToken.allowance(swSigner.address, curveAddress);
    if (allowance < bal) {
      const appTx = await swToken.approve(curveAddress, ethers.MaxUint256);
      await appTx.wait();
    }

    const preEth = await provider.getBalance(swSigner.address);
    const sellTx = await swCurve.sell(bal, 0n, swSigner.address, { gasLimit: 250000 });
    const sellReceipt = await sellTx.wait();
    console.log(`  ✓ Sold in block ${sellReceipt.blockNumber}! Tx: ${sellTx.hash}`);

    // Check received ETH and rewire directly to Deployer
    const postEth = await provider.getBalance(swSigner.address);
    const gasReserve = ethers.parseEther("0.00001");
    if (postEth > gasReserve) {
      const rewireAmt = postEth - gasReserve;
      console.log(`  >> Rewiring ${ethers.formatEther(rewireAmt)} ETH back to Deployer...`);
      const rewireTx = await swSigner.sendTransaction({
        to: deployer.address,
        value: rewireAmt,
        gasLimit: 21000
      });
      await rewireTx.wait();
      console.log(`  ✓ Rewired to Deployer! Tx: ${rewireTx.hash}`);
    }
  }

  // STEP 3: Claim accrued creator fees and sweep
  console.log("\n>>> [STEP 3/3] Checking & sweeping any newly accrued creator fees from Escrow...");
  const taxWalletPath = path.resolve("./tax_wallet.json");
  if (fs.existsSync(taxWalletPath)) {
    const taxData = JSON.parse(fs.readFileSync(taxWalletPath, "utf8"));
    const taxWallet = new ethers.Wallet(taxData.privateKey, provider);
    const escrow = new ethers.Contract(FEE_ESCROW, ESCROW_ABI, taxWallet);

    const pending = await escrow.balanceOf(taxWallet.address);
    console.log(`Pending Fees in Escrow: ${ethers.formatEther(pending)} ETH`);

    if (pending > 0n) {
      const taxEthBal = await provider.getBalance(taxWallet.address);
      if (taxEthBal < ethers.parseEther("0.00005")) {
        const fundTx = await deployer.sendTransaction({
          to: taxWallet.address,
          value: ethers.parseEther("0.0001"),
          gasLimit: 21000
        });
        await fundTx.wait();
      }

      console.log("Claiming creator fees...");
      const claimTx = await escrow.claim({ gasLimit: 200000 });
      await claimTx.wait();
      console.log(`  ✓ Claimed! Tx: ${claimTx.hash}`);

      const finalTaxBal = await provider.getBalance(taxWallet.address);
      const gasBuffer = ethers.parseEther("0.00001");
      if (finalTaxBal > gasBuffer) {
        const sweepAmt = finalTaxBal - gasBuffer;
        console.log(`Sweeping ${ethers.formatEther(sweepAmt)} ETH to Deployer...`);
        const sweepTx = await taxWallet.sendTransaction({
          to: deployer.address,
          value: sweepAmt,
          gasLimit: 21000
        });
        await sweepTx.wait();
        console.log(`  ✓ Swept! Tx: ${sweepTx.hash}`);
      }
    }
  }

  const finalDepEth = await provider.getBalance(deployer.address);
  const finalDepTok = await token.balanceOf(deployer.address);
  console.log("\n==================================================================");
  console.log("🎉 OPERATION COMPLETE!");
  console.log(`Deployer Final ETH:   ${ethers.formatEther(finalDepEth)} ETH`);
  console.log(`Deployer Final HOARD: ${ethers.formatUnits(finalDepTok, 18)} HOARD (~$50 worth)`);
  console.log("==================================================================");
}

main().catch(console.error);
