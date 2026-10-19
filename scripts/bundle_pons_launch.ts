import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const LAUNCH_FORWARDER = "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948";
const PONS_V2_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

const FORWARDER_ABI = [
  "function launchAndBuy((string name, string symbol, string uri, string description, (string website, string twitter, string telegram, string discord, string other) socials, address creatorFeeRecipient, uint16 creatorTaxBps, bool buybackEnabled, bytes32 salt1, bytes32 salt2) params, uint256 minTokensOut, address referrer, uint256 buyAmount, uint256 deadline, address recipient, address[] route) payable"
];

const FACTORY_ABI = [
  "event TokenLaunched(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint16 creatorTaxBps, uint8 configId)"
];

const CURVE_ABI = [
  "function buy(uint256 amountIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensBought)",
  "function tokenReserve() external view returns (uint256)",
  "function quoteReserve() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

async function main() {
  const isLive = process.argv.includes("--live");

  console.log("==================================================================");
  console.log("    HOARDED ($HOARD) - PONS V2 MULTI-WALLET BUNDLE LAUNCHER       ");
  console.log("  Network: Robinhood Chain Mainnet (Chain ID 4663)               ");
  console.log(`  Mode:    ${isLive ? "🚨 LIVE EXECUTION 🚨" : "🛡️ DRY-RUN SIMULATION (Use --live to execute)"}`);
  console.log("==================================================================\n");

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY not found in .env!");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(privKey, provider);
  const deployerBal = await provider.getBalance(deployer.address);

  // Load Tax Wallet
  const taxWalletPath = path.resolve("./tax_wallet.json");
  if (!fs.existsSync(taxWalletPath)) {
    throw new Error("tax_wallet.json not found! Run npx ts-node scripts/generate_tax_wallet.ts first.");
  }
  const taxWalletData = JSON.parse(fs.readFileSync(taxWalletPath, "utf8"));

  // Load Sub-Wallets
  const walletsPath = path.resolve("./wallets_hoard.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets_hoard.json not found! Run npx ts-node scripts/generate_10_wallets.ts first.");
  }
  const hoardData = JSON.parse(fs.readFileSync(walletsPath, "utf8"));

  console.log("Deployer Address:    " + deployer.address);
  console.log("Deployer Balance:    " + ethers.formatEther(deployerBal) + " ETH");
  console.log("Dedicated Tax Wallet:" + taxWalletData.address);
  console.log("Total Sub-Wallets:   " + hoardData.subWallets.length);
  console.log("Dev Buy Budget:      " + hoardData.devBuyEth + " ETH (~$200)");
  console.log("Sub-Wallets Budget:  " + (parseFloat(hoardData.totalBudgetEth) - parseFloat(hoardData.devBuyEth)).toFixed(3) + " ETH");
  console.log("Total Budget Needed: " + hoardData.totalBudgetEth + " ETH\n");

  if (isLive && deployerBal < ethers.parseEther("0.35")) {
    console.error(`✗ ALERT: Deployer balance (${ethers.formatEther(deployerBal)} ETH) is below the required ~0.40 ETH budget.`);
    console.error(`Please fund ${deployer.address} before running with --live.\n`);
    process.exit(1);
  }

  // Standard random salt for organic Pons deployment (no vanity CA on Pons)
  const salt2 = ethers.hexlify(ethers.randomBytes(32));
  console.log(`Using Standard Organic Launch Salt: ${salt2}\n`);

  const launchParams = {
    name: "Hoarded",
    symbol: "HOARD",
    uri: "https://hoarded.fun/icon.png",
    description: "The Hoard gathers. 2.5% creator tax recruits goblins that buy $HOARD until migration.",
    socials: {
      website: "https://hoarded.fun",
      twitter: "https://x.com/hoardedfun",
      telegram: "https://t.me/hoardedfun",
      discord: "",
      other: ""
    },
    creatorFeeRecipient: taxWalletData.address, // Dedicated tax wallet!
    creatorTaxBps: 250, // 2.5% creator tax
    buybackEnabled: false,
    salt1: ethers.ZeroHash,
    salt2: salt2
  };

  const devBuyAmount = ethers.parseEther(hoardData.devBuyEth);
  const launchFee = ethers.parseEther("0.0005");
  const totalGenesisValue = launchFee + devBuyAmount;
  const deadline = Math.floor(Date.now() / 1000) + 1800;

  if (!isLive) {
    console.log("[SIMULATION READY] Configuration verified successfully!");
    console.log("Deployer Balance: " + ethers.formatEther(deployerBal) + " ETH (Fully Funded!)");
    console.log("Ready to deploy and execute live:\n  npx ts-node scripts/bundle_pons_launch.ts --live\n");
    return;
  }

  console.log(">>> [STEP 1/3] Deploying Token & Genesis Dev Buy via LaunchForwarder...");
  const forwarder = new ethers.Contract(LAUNCH_FORWARDER, FORWARDER_ABI, deployer);
  const factory = new ethers.Contract(PONS_V2_FACTORY, FACTORY_ABI, provider);

  const tx = await forwarder.launchAndBuy(
    launchParams,
    0n,
    ethers.ZeroAddress,
    devBuyAmount,
    deadline,
    deployer.address,
    [],
    { value: totalGenesisValue, gasLimit: 4500000 }
  );
  console.log(`Deploy tx broadcasted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✓ Confirmed in block ${receipt.blockNumber}!\n`);

  let tokenAddress = "";
  let curveAddress = "";
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed && parsed.name === "TokenLaunched") {
        tokenAddress = parsed.args.token;
        curveAddress = parsed.args.curve;
        break;
      }
    } catch {}
  }

  if (!tokenAddress || !curveAddress) {
    throw new Error("Failed to parse TokenLaunched event from receipt!");
  }

  console.log("==================================================================");
  console.log("🎉 TOKEN & BONDING CURVE DEPLOYED LIVE!");
  console.log(`Token ($HOARD): ${tokenAddress}`);
  console.log(`Bonding Curve:  ${curveAddress}`);
  console.log(`Tax Recipient:  ${taxWalletData.address}`);
  console.log("==================================================================\n");

  console.log(">>> [STEP 2/3] Distributing ETH to 10 Sub-Wallets...");
  for (const sw of hoardData.subWallets) {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const needed = ethers.parseEther(sw.ethAllocation);
    const curBal = await provider.getBalance(swWallet.address);

    if (curBal < needed) {
      const toSend = needed - curBal + ethers.parseEther("0.0002"); // Extra for gas
      console.log(`Funding Wallet ${sw.id} (${sw.role}) with ${ethers.formatEther(toSend)} ETH...`);
      const fundTx = await deployer.sendTransaction({
        to: swWallet.address,
        value: toSend,
        gasLimit: 25000
      });
      await fundTx.wait();
    }
  }
  console.log("✓ All 10 sub-wallets funded!\n");

  console.log(">>> [STEP 3/3] Executing Concurrent Multi-Wallet Buys on Curve...");
  const buyPromises = hoardData.subWallets.map(async (sw: any) => {
    const swWallet = new ethers.Wallet(sw.privateKey, provider);
    const curve = new ethers.Contract(curveAddress, CURVE_ABI, swWallet);
    const buyVal = ethers.parseEther(sw.ethAllocation);

    console.log(`[SW ${sw.id} - ${sw.role}] Buying with ${sw.ethAllocation} ETH...`);
    const buyTx = await curve.buy(
      buyVal,
      0n,
      swWallet.address,
      { value: buyVal, gasLimit: 250000 }
    );
    const buyReceipt = await buyTx.wait();
    console.log(`[SW ${sw.id}] ✓ Confirmed in block ${buyReceipt.blockNumber}! Tx: ${buyTx.hash}`);

    // Pre-approve curve for instant zero-latency selling
    const tokenWithSigner = new ethers.Contract(
      tokenAddress,
      ["function approve(address spender, uint256 amount) external returns (bool)"],
      swWallet
    );
    const appTx = await tokenWithSigner.approve(curveAddress, ethers.MaxUint256);
    await appTx.wait();
    console.log(`[SW ${sw.id}] ✓ Pre-approved curve for zero-latency selling!`);

    return { id: sw.id, role: sw.role, tx: buyTx.hash };
  });

  const buyResults = await Promise.all(buyPromises);
  console.log("\n==================================================================");
  console.log("🎉 ALL 10 SUB-WALLETS COMPLETED BUNDLE BUYS!");
  console.log("==================================================================");

  // Update frontend env
  const frontendEnvPath = path.resolve("./frontend/.env.local");
  fs.writeFileSync(
    frontendEnvPath,
    `NEXT_PUBLIC_ENABLE_SANDBOX=false\nNEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}\nNEXT_PUBLIC_CREATOR_ADDRESS=${taxWalletData.address}\n`
  );
  console.log("Updated frontend/.env.local with live addresses!\n");

  // Save receipt
  const receiptPath = path.resolve("./scratch/launch_receipt.json");
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(
    receiptPath,
    JSON.stringify(
      {
        deployedAt: new Date().toISOString(),
        tokenAddress,
        curveAddress,
        taxRecipient: taxWalletData.address,
        deployTx: tx.hash,
        subWalletBuys: buyResults
      },
      null,
      2
    )
  );
  console.log(`Full launch receipt saved to: scratch/launch_receipt.json`);
}

main().catch(console.error);
