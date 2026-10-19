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
  console.log("       HOARDED ($HOARD) - LIVE PROFIT & INITIAL EXTRACTION        ");
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

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const curve = new ethers.Contract(curveAddress, CURVE_ABI, provider);

  const qr = await curve.quoteReserve();
  const tr = await curve.tokenReserve();
  const price = Number(qr) / Number(tr);
  const mcapEth = price * 1e9;
  const mcapUsd = mcapEth * 2500;

  console.log(`Token: ${tokenAddress}`);
  console.log(`Curve: ${curveAddress}`);
  console.log(`Curve Quote Reserve: ${ethers.formatEther(qr)} ETH`);
  console.log(`Current Mcap: $${mcapUsd.toFixed(2)} (${mcapEth.toFixed(4)} ETH)`);
  console.log(`Deployer Initial Balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} ETH\n`);

  // Target sell percentages per sub-wallet:
  // Wallets 1-3 (Alpha Snipers): 100% (full initial + profit harvest)
  // Wallets 4-6 (Beta Swarm): 85% (majority harvest, retain 15% moonbag)
  // Wallets 7-9 (Gamma Citadel): 75% (majority harvest, retain 25% moonbag)
  // Wallet 10 (Epsilon Moonbag): 50% (harvest 50%, retain 50% moonbag)
  const sellPercentages: { [key: number]: number } = {
    1: 100,
    2: 100,
    3: 100,
    4: 85,
    5: 85,
    6: 85,
    7: 75,
    8: 75,
    9: 75,
    10: 50
  };

  console.log(">>> [STEP 1/3] Executing Multi-Wallet Profit-Taking Sells directly to Deployer...");
  let totalSoldTokens = 0n;

  for (const sw of hoardData.subWallets) {
    const pct = sellPercentages[sw.id] || 80;
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const bal = await token.balanceOf(swWallet.address);

    if (bal === 0n) {
      console.log(`[SW ${sw.id} - ${sw.role}] 0 HOARD balance, skipping.`);
      continue;
    }

    const toSell = pct >= 100 ? bal : (bal * BigInt(pct)) / 100n;
    totalSoldTokens += toSell;

    console.log(`[SW ${sw.id} - ${sw.role}] Selling ${ethers.formatUnits(toSell, 18)} HOARD (${pct}%)...`);
    const curveWithSigner = new ethers.Contract(curveAddress, CURVE_ABI, swWallet);
    const tokenWithSigner = new ethers.Contract(tokenAddress, ERC20_ABI, swWallet);

    const allowance = await token.allowance(swWallet.address, curveAddress);
    if (allowance < toSell) {
      const appTx = await tokenWithSigner.approve(curveAddress, ethers.MaxUint256);
      await appTx.wait();
    }

    // Direct payout to deployer!
    const tx = await curveWithSigner.sell(toSell, 0n, deployer.address, { gasLimit: 250000 });
    const receipt = await tx.wait();
    console.log(`  ✓ Confirmed block ${receipt.blockNumber}! Tx: ${tx.hash}`);
  }

  const deployerMidBal = await provider.getBalance(deployer.address);
  console.log(`\nDeployer Balance after sells: ${ethers.formatEther(deployerMidBal)} ETH`);

  // STEP 2: Claim Creator Fees from Escrow
  console.log("\n>>> [STEP 2/3] Checking and Claiming 2.5% Creator Tax Fees...");
  const taxWalletPath = path.resolve("./tax_wallet.json");
  if (fs.existsSync(taxWalletPath)) {
    const taxData = JSON.parse(fs.readFileSync(taxWalletPath, "utf8"));
    const taxWallet = new ethers.Wallet(taxData.privateKey, provider);
    const escrow = new ethers.Contract(FEE_ESCROW, ESCROW_ABI, taxWallet);

    const pending = await escrow.balanceOf(taxWallet.address);
    console.log(`Tax Wallet: ${taxWallet.address}`);
    console.log(`Unclaimed Tax Fees: ${ethers.formatEther(pending)} ETH`);

    if (pending > 0n) {
      // Ensure tax wallet has tiny gas for claim
      const taxEthBal = await provider.getBalance(taxWallet.address);
      if (taxEthBal < ethers.parseEther("0.00005")) {
        console.log("Funding Tax Wallet with 0.0001 ETH for gas...");
        const fundTx = await deployer.sendTransaction({
          to: taxWallet.address,
          value: ethers.parseEther("0.0001"),
          gasLimit: 21000
        });
        await fundTx.wait();
      }

      console.log("Claiming accrued creator fees...");
      const claimTx = await escrow.claim({ gasLimit: 200000 });
      await claimTx.wait();
      console.log(`  ✓ Creator fees claimed! Tx: ${claimTx.hash}`);

      // STEP 3: Sweep claimed fees to Deployer
      console.log("\n>>> [STEP 3/3] Sweeping Tax Wallet Proceeds to Deployer...");
      const finalTaxBal = await provider.getBalance(taxWallet.address);
      const gasBuffer = ethers.parseEther("0.00001");
      if (finalTaxBal > gasBuffer) {
        const sweepAmt = finalTaxBal - gasBuffer;
        console.log(`Sweeping ${ethers.formatEther(sweepAmt)} ETH from Tax Wallet to Deployer...`);
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

  const finalDeployerBal = await provider.getBalance(deployer.address);
  console.log("\n==================================================================");
  console.log(`🎉 PROFIT EXTRACTION COMPLETE!`);
  console.log(`Deployer Final ETH Balance: ${ethers.formatEther(finalDeployerBal)} ETH`);
  console.log("==================================================================");
}

main().catch(console.error);
