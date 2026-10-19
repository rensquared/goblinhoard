import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const CURVE_ADDRESS = "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a";
const TOKEN_ADDRESS = "0xc9564cc1818b69E09789B1D67da684692A6daAA6";

const CURVE_ABI = [
  "function buy(uint256 amountIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensBought)",
  "function tokenReserve() external view returns (uint256)",
  "function quoteReserve() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

async function main() {
  console.log("==================================================================");
  console.log("   SUB-WALLET BUNDLE DRY-RUN TEST ON ROBINHOOD MAINNET (4663)    ");
  console.log("   Curve: " + CURVE_ADDRESS);
  console.log("==================================================================\n");

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(privKey, provider);
  const deployerBal = await provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Deployer Balance: ${ethers.formatEther(deployerBal)} ETH\n`);

  if (deployerBal < ethers.parseEther("0.002")) {
    throw new Error("Insufficient deployer balance for test. Need at least 0.002 ETH.");
  }

  // Load sub-wallets
  const walletsPath = path.resolve("./wallets_hoard.json");
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const testSubWallets = hoardData.subWallets.slice(0, 3); // Test with first 3 sub-wallets

  console.log(`[STAGE 1] Distributing micro-ETH (0.0004 ETH each) to 3 sub-wallets...`);
  const fundAmount = ethers.parseEther("0.0004");

  for (const sw of testSubWallets) {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const balBefore = await provider.getBalance(swWallet.address);
    console.log(`- Sub-Wallet ${sw.id} (${sw.role}): ${swWallet.address} | Balance: ${ethers.formatEther(balBefore)} ETH`);

    if (balBefore < ethers.parseEther("0.00035")) {
      console.log(`  -> Funding 0.0004 ETH from deployer...`);
      const tx = await deployer.sendTransaction({
        to: swWallet.address,
        value: fundAmount,
        gasLimit: 25000
      });
      await tx.wait();
      const balAfter = await provider.getBalance(swWallet.address);
      console.log(`  ✓ Funded! New balance: ${ethers.formatEther(balAfter)} ETH`);
    } else {
      console.log(`  ✓ Already sufficiently funded (${ethers.formatEther(balBefore)} ETH)`);
    }
  }

  console.log(`\n[STAGE 2] Executing automated buys (0.0003 ETH each) on test curve...`);
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 mins
  const buyAmount = ethers.parseEther("0.0003");
  const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

  const buyPromises = testSubWallets.map(async (sw: any) => {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const curve = new ethers.Contract(CURVE_ADDRESS, CURVE_ABI, swWallet);

    console.log(`[SW ${sw.id} - ${sw.role}] Submitting buy of 0.0003 ETH...`);
    const tx = await curve.buy(
      buyAmount, // amountIn (must match msg.value)
      0n, // minTokensOut (0 for test slippage tolerance)
      swWallet.address, // recipient
      { value: buyAmount, gasLimit: 250000 }
    );
    console.log(`[SW ${sw.id}] Tx broadcasted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[SW ${sw.id}] ✓ Confirmed in block ${receipt.blockNumber}! Gas used: ${receipt.gasUsed.toString()}`);

    const tokenBal = await tokenContract.balanceOf(swWallet.address);
    console.log(`[SW ${sw.id}] 🪙 Tokens received: ${ethers.formatUnits(tokenBal, 18)} GTEST\n`);
    return { id: sw.id, txHash: tx.hash, tokenBal: ethers.formatUnits(tokenBal, 18) };
  });

  const results = await Promise.all(buyPromises);

  console.log("==================================================================");
  console.log("🎉 SUCCESS! SUB-WALLET BUNDLE EXECUTION CONFIRMED ONCHAIN!");
  console.log("==================================================================");
  for (const r of results) {
    console.log(`Wallet ${r.id}: Acquired ${r.tokenBal} GTEST | Tx: ${r.txHash}`);
  }

  const finalDeployerBal = await provider.getBalance(deployer.address);
  console.log(`\nRemaining Deployer Balance: ${ethers.formatEther(finalDeployerBal)} ETH`);
  console.log("==================================================================");
}

main().catch(console.error);
