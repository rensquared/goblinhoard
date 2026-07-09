import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

// EIP-2612 Permit Signing Helper
async function getPermitSignature(
  wallet: ethers.Wallet,
  tokenAddress: string,
  tokenName: string,
  spenderAddress: string,
  value: bigint,
  deadline: number,
  chainId: number
): Promise<ethers.Signature> {
  const domain = {
    name: tokenName,
    version: "1",
    chainId: chainId,
    verifyingContract: tokenAddress,
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const tokenContract = await hre.ethers.getContractAt("OutlawToken", tokenAddress);
  const nonce = await tokenContract.nonces(wallet.address);

  const message = {
    owner: wallet.address,
    spender: spenderAddress,
    value: value,
    nonce: nonce,
    deadline: deadline,
  };

  const sigString = await wallet.signTypedData(domain, types, message);
  return ethers.Signature.from(sigString);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = 31337;
  console.log("====================================================");
  console.log("    OUTLAW CAPITAL - HEIST ENGINE LAUNCH SIMULATOR  ");
  console.log("====================================================");

  // 1. Read wallets
  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found! Generate it first.");
  }
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const rewardAddresses = wallets.reward.map((w: any) => w.address);
  const founderAddresses = wallets.founder.map((w: any) => w.address);

  // 2. Deploy contracts
  console.log("\n[1/5] Deploying OutlawToken...");
  const OutlawToken = await hre.ethers.getContractFactory("OutlawToken");
  const token = await OutlawToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`      OutlawToken deployed at: ${tokenAddress}`);

  console.log("      Deploying MockWETH...");
  const MockWETH = await hre.ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();

  console.log("      Deploying MockSwapRouter (Constant Product)...");
  const MockSwapRouter = await hre.ethers.getContractFactory("MockSwapRouter");
  const router = await MockSwapRouter.deploy(tokenAddress, wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("      Deploying HeistEngine...");
  const HeistEngine = await hre.ethers.getContractFactory("HeistEngine");
  const engine = await HeistEngine.deploy(tokenAddress, wethAddress, routerAddress, rewardAddresses);
  await engine.waitForDeployment();
  const engineAddress = await engine.getAddress();



  // 3. Fund LP and Wallets
  console.log("\n[2/5] Distributing token supply...");
  const decimals = await token.decimals();
  
  const lpSupply = 700_000_000n * 10n ** BigInt(decimals);
  await token.transfer(routerAddress, lpSupply);
  console.log(`      Seeded LP Pool with 700M OUTLAW`);

  const fundingAmount = 10_000_000n * 10n ** BigInt(decimals);
  for (let i = 0; i < 20; i++) {
    await token.transfer(rewardAddresses[i], fundingAmount);
  }
  for (let i = 0; i < 10; i++) {
    await token.transfer(founderAddresses[i], fundingAmount);
  }
  console.log(`      Seeded 20 Reward Wallets (200M total) and 10 Founder Wallets (100M total)`);

  console.log("      Executing EIP-2612 Permits for 20 reward wallets...");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const maxAllowance = hre.ethers.MaxUint256;
  const tokenName = await token.name();

  for (let i = 0; i < 20; i++) {
    const wData = wallets.reward[i];
    const wSigner = new hre.ethers.Wallet(wData.privateKey, hre.ethers.provider);
    const sig = await getPermitSignature(wSigner, tokenAddress, tokenName, engineAddress, maxAllowance, deadline, chainId);
    
    await token.permit(wSigner.address, engineAddress, maxAllowance, deadline, sig.v, sig.r, sig.s);
  }
  console.log("      Permits successfully registered. HeistEngine authorized.");

  // 4. Generate 5 Traders & Fund with WETH (Reduced to 5 to run instantly!)
  console.log("\n[3/5] Generating 5 active mock traders...");
  const traders: ethers.Wallet[] = [];
  const startEthBal = hre.ethers.parseEther("20.0"); // 20 ETH each

  for (let i = 0; i < 5; i++) {
    const traderWallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
    await deployer.sendTransaction({
      to: traderWallet.address,
      value: startEthBal,
    });
    await weth.connect(traderWallet).deposit({ value: hre.ethers.parseEther("18.0") });
    await weth.connect(traderWallet).approve(engineAddress, hre.ethers.MaxUint256);
    await token.connect(traderWallet).approve(routerAddress, hre.ethers.MaxUint256);

    traders.push(traderWallet);
  }
  console.log("      5 traders initialized and funded with WETH & Gas.");

  // Fund and approve MockSwapRouter for the 10 founder wallets so they can sell
  const founderSigners: ethers.Wallet[] = [];
  const fGasAmount = hre.ethers.parseEther("0.1");
  for (let i = 0; i < 10; i++) {
    const fData = wallets.founder[i];
    const fSigner = new hre.ethers.Wallet(fData.privateKey, hre.ethers.provider);
    
    await deployer.sendTransaction({
      to: fSigner.address,
      value: fGasAmount,
    });

    await token.connect(fSigner).approve(routerAddress, hre.ethers.MaxUint256);
    founderSigners.push(fSigner);
  }

  // 5. Run Launch Simulation
  console.log("\n[4/5] Running launch simulation (Swaps & Heists)...");
  
  let totalWethSwapped = 0n;
  let txCount = 0;
  let buysCount = 0;
  let sellsCount = 0;
  let heistCount = 0;

  const heistOutcomes = {
    tax: 0,
    safe: 0,
    blessing: 0,
    stash: 0,
    legendary: 0
  };

  const initialPrice = await router.getCurrentPrice();
  console.log(`      Initial Price: 1 WETH = ${hre.ethers.formatUnits(initialPrice, 18)} OUTLAW`);

  // Target 30 swap iterations. This is guaranteed to complete in under 2 seconds!
  const totalIterations = 35; 

  for (let i = 0; i < totalIterations; i++) {
    const trader = traders[Math.floor(Math.random() * 5)];
    const isBuy = Math.random() < 0.75; // 75% buys, 25% sells

    if (isBuy) {
      const playHeist = Math.random() < 0.5;

      // Choose WETH input size between 0.15 WETH and 0.45 WETH
      const wethInput = hre.ethers.parseEther((Math.random() * 0.3 + 0.15).toFixed(4));

      const wethRes = await router.wethReserve();
      const outlawRes = await router.outlawReserve();
      
      // Prevent division by zero or buying more than available reserve
      if (outlawRes <= 10_000_000n * 10n ** BigInt(decimals)) {
        console.log(`      [Iter ${i + 1}] Pool supply depleted, skipping buy.`);
        continue;
      }

      const k = wethRes * outlawRes;
      const newWethRes = wethRes + wethInput;
      const newOutlawRes = k / newWethRes;
      let amountOut = outlawRes - newOutlawRes;

      // Cap buy amount at 2 Million tokens (0.2% of supply) to respect the 2% Max Wallet limit
      const maxBuyLimit = 2_000_000n * 10n ** 18n;
      if (amountOut > maxBuyLimit) {
        amountOut = maxBuyLimit;
      }

      if (amountOut === 0n) continue;

      if (playHeist) {
        const wholeTokens = amountOut / 10n ** 18n;
        if (wholeTokens === 0n) continue;
        amountOut = wholeTokens * 10n ** 18n + 670000000000000000n; // whole tokens + 0.67
      } else {
        const wholeTokens = amountOut / 10n ** 18n;
        if (wholeTokens === 0n) continue;
        amountOut = wholeTokens * 10n ** 18n;
      }

      const maxWeth = wethInput * 200n / 100n; // 2x tolerance for high price impact

      try {
        const tx = await engine.connect(trader).heistSwap(amountOut, maxWeth);
        const receipt = await tx.wait();
        
        const swapLog = receipt.logs
          .map((log: any) => {
            try { return engine.interface.parseLog(log); } catch { return null; }
          })
          .find((e: any) => e && e.name === "SwapExecuted");

        if (swapLog) {
          totalWethSwapped += swapLog.args.amountIn;
        }

        txCount++;
        buysCount++;

        if (playHeist) {
          heistCount++;
          const heistLog = receipt.logs
            .map((log: any) => {
              try { return engine.interface.parseLog(log); } catch { return null; }
            })
            .find((e: any) => e && e.name === "HeistResult");

          if (heistLog) {
            const outcome = Number(heistLog.args.outcome);
            if (outcome === 0) heistOutcomes.tax++;
            else if (outcome === 1) heistOutcomes.safe++;
            else if (outcome === 2) heistOutcomes.blessing++;
            else if (outcome === 3) heistOutcomes.stash++;
            else if (outcome === 4) heistOutcomes.legendary++;
          }
        }
      } catch (err: any) {
        console.log("      Buy failed with error stack:", err.stack);
      }
    } else {
      // Sell swap
      const traderBal = await token.balanceOf(trader.address);
      if (traderBal > 100000n * 10n ** 18n) {
        const pct = BigInt(Math.floor(Math.random() * 20) + 10);
        const sellAmount = traderBal * pct / 100n;
        
        try {
          await router.connect(trader).exactInputSingle({
            tokenIn: tokenAddress,
            tokenOut: wethAddress,
            fee: 10000,
            recipient: trader.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: sellAmount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
          });
          
          txCount++;
          sellsCount++;
        } catch (err) {}
      }
    }

    // Strategic Founder Sell Control
    const currentPrice = await router.getCurrentPrice();
    if (currentPrice <= initialPrice / 2n) {
      // Pick a random founder wallet to take profit
      const founder = founderSigners[Math.floor(Math.random() * 10)];
      const founderBal = await token.balanceOf(founder.address);
      
      const sellAmount = 1_500_000n * 10n ** BigInt(decimals);
      if (founderBal >= sellAmount) {
        try {
          await router.connect(founder).exactInputSingle({
            tokenIn: tokenAddress,
            tokenOut: wethAddress,
            fee: 10000,
            recipient: founder.address, // receives WETH
            deadline: Math.floor(Date.now() / 1000) + 3600,
            amountIn: sellAmount,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
          });
        } catch {}
      }
    }
  }

  // 7. Calculate founder profit extraction
  let totalFounderWethExtracted = 0n;
  for (let i = 0; i < 10; i++) {
    const fWethBal = await weth.balanceOf(founderAddresses[i]);
    totalFounderWethExtracted += fWethBal;
  }

  const finalPrice = await router.getCurrentPrice();

  console.log("\n[5/5] Simulation complete. Compiling statistics...");
  console.log("====================================================");
  console.log("                SIMULATION SUMMARY REPORT           ");
  console.log("====================================================");
  console.log(`  Total Trades Executed:      ${txCount}`);
  console.log(`  Buys:                       ${buysCount}`);
  console.log(`  Sells:                      ${sellsCount}`);
  console.log(`  Actual Simulated Volume:    ${hre.ethers.formatUnits(totalWethSwapped, 18)} WETH`);
  console.log(`  Estimated USD Volume:       $${(Number(hre.ethers.formatUnits(totalWethSwapped, 18)) * 1717).toFixed(2)}`);
  console.log("----------------------------------------------------");
  console.log(`  Initial Price (Launch):     1 WETH = ${hre.ethers.formatUnits(initialPrice, 18)} OUTLAW`);
  console.log(`  Final Price (Post-Launch):  1 WETH = ${hre.ethers.formatUnits(finalPrice, 18)} OUTLAW`);
  
  const increaseFactor = Number(initialPrice) / Number(finalPrice);
  console.log(`  Token Price Performance:    +${((increaseFactor - 1) * 100).toFixed(2)}%`);
  console.log("----------------------------------------------------");
  console.log("  HEIST MODE GAME STATISTICS:");
  console.log(`    Total Heist Swaps:        ${heistCount}`);
  console.log(`    - Sheriff's Taxes (10% Burn):  ${heistOutcomes.tax} times`);
  console.log(`    - Safe Escapes (Standard):    ${heistOutcomes.safe} times`);
  console.log(`    - Robin's Blessings (+25%):   ${heistOutcomes.blessing} times`);
  console.log(`    - Hidden Stashes (+50%):      ${heistOutcomes.stash} times`);
  console.log(`    - Legendary Heists (+100%):   ${heistOutcomes.legendary} times`);
  console.log("----------------------------------------------------");
  console.log("  FOUNDER WALLETS CASH-OUT:");
  console.log(`    Total WETH Secured:        ${hre.ethers.formatUnits(totalFounderWethExtracted, 18)} WETH`);
  console.log(`    USD Value Extracted:       $${(Number(hre.ethers.formatUnits(totalFounderWethExtracted, 18)) * 1717).toFixed(2)}`);
  console.log("====================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
