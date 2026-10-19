import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const TOKEN_ADDRESS = "0xD41d83f9b1dF9D15766f353B709ca0a96fb8d6c9";
const CURVE_ADDRESS = "0x8bf021c97f5958b746E9895E306AE3C697271EF0";
const TAX_WALLET = "0x5a886dA2B621E0C5BAa55E68a0e038680F2ECf11";

const CURVE_ABI = [
  "function buy(uint256 amountIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensBought)",
  "function quoteReserve() external view returns (uint256)",
  "function tokenReserve() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

async function main() {
  console.log("==================================================================");
  console.log("  HOARDED ($HOARD) - EXECUTING SUB-WALLET DISTRIBUTION & BUYS     ");
  console.log(`  Token: ${TOKEN_ADDRESS}`);
  console.log(`  Curve: ${CURVE_ADDRESS}`);
  console.log("==================================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY not found!");
  const deployer = new ethers.Wallet(privKey, provider);
  const deployerBal = await provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${ethers.formatEther(deployerBal)} ETH\n`);

  const walletsPath = path.resolve("./wallets_hoard.json");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  console.log(">>> [STEP 1/2] Funding all 10 Sub-Wallets...");
  for (const sw of hoardData.subWallets) {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const needed = ethers.parseEther(sw.ethAllocation);
    const curBal = await provider.getBalance(swWallet.address);

    if (curBal < needed) {
      const toSend = needed - curBal + ethers.parseEther("0.0003"); // Gas buffer
      console.log(`Funding Wallet ${sw.id} (${sw.role}) with ${ethers.formatEther(toSend)} ETH...`);
      const tx = await deployer.sendTransaction({
        to: swWallet.address,
        value: toSend,
        gasLimit: 25000
      });
      await tx.wait();
      console.log(`  ✓ Funded Wallet ${sw.id}!`);
    } else {
      console.log(`  ✓ Wallet ${sw.id} already funded.`);
    }
  }
  console.log("✓ All 10 sub-wallets funded!\n");

  console.log(">>> [STEP 2/2] Firing Concurrent Multi-Wallet Buys + Pre-approvals on Curve...");
  const buyPromises = hoardData.subWallets.map(async (sw: any) => {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const curve = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, swWallet);
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, swWallet);
    const buyVal = ethers.parseEther(sw.ethAllocation);

    console.log(`[SW ${sw.id} - ${sw.role}] Submitting buy of ${sw.ethAllocation} ETH...`);
    const buyTx = await curve.buy(
      buyVal,
      0n,
      swWallet.address,
      { value: buyVal, gasLimit: 250000 }
    );
    const buyReceipt = await buyTx.wait();
    console.log(`[SW ${sw.id}] ✓ Confirmed in block ${buyReceipt.blockNumber}!`);

    // Pre-approve curve for instant zero-latency selling
    const appTx = await token.approve(CURVE_ADDRESS, ethers.MaxUint256);
    await appTx.wait();
    console.log(`[SW ${sw.id}] ✓ Pre-approved curve for instant selling!`);

    const tokBal = await token.balanceOf(swWallet.address);
    console.log(`[SW ${sw.id}] 🪙 Holdings: ${ethers.formatUnits(tokBal, 18)} HOARD\n`);

    return { id: sw.id, role: sw.role, tx: buyTx.hash, tokBal: ethers.formatUnits(tokBal, 18) };
  });

  const results = await Promise.all(buyPromises);
  console.log("==================================================================");
  console.log("🎉 ALL 10 SUB-WALLETS COMPLETED BUNDLE BUYS & PRE-APPROVALS!");
  console.log("==================================================================");

  // Update frontend env
  const frontendEnvPath = path.resolve("./frontend/.env.local");
  fs.writeFileSync(
    frontendEnvPath,
    `NEXT_PUBLIC_ENABLE_SANDBOX=false\nNEXT_PUBLIC_TOKEN_ADDRESS=${TOKEN_ADDRESS}\nNEXT_PUBLIC_CREATOR_ADDRESS=${TAX_WALLET}\n`
  );
  console.log("Updated frontend/.env.local with LIVE token & creator addresses!");

  // Save receipt
  const receiptPath = path.resolve("./scratch/launch_receipt.json");
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(
    receiptPath,
    JSON.stringify(
      {
        deployedAt: new Date().toISOString(),
        tokenAddress: TOKEN_ADDRESS,
        curveAddress: CURVE_ADDRESS,
        taxRecipient: TAX_WALLET,
        deployTx: "0x102b6e81426dc6ecf5d9f9cbee63381a4080acc2b42815cec47a63d5bd24d2b4",
        subWalletBuys: results
      },
      null,
      2
    )
  );
  console.log("Receipt saved to: scratch/launch_receipt.json");
}

main().catch(console.error);
