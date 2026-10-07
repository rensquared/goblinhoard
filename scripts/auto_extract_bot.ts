import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const deployedPath = path.resolve("./scratch/deployed_addresses.json");
if (!fs.existsSync(deployedPath)) {
  throw new Error("deployed_addresses.json not found! Run deploy_and_setup_lp.ts first.");
}
const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));

const POOL_ADDRESS = ethers.getAddress(deployed.pool.toLowerCase());
const OUTLAW_ADDRESS = ethers.getAddress(deployed.token.toLowerCase());
const WETH_ADDRESS = ethers.getAddress(deployed.weth.toLowerCase());
const ROUTER_ADDRESS = ethers.getAddress(deployed.router.toLowerCase());

const ETH_PRICE_USD = 1742.05; // Fixed rate from current session config
const TOTAL_SUPPLY = 1_000_000_000n;

// Milestone Targets
interface Milestone {
  targetMcapUsd: number;
  tokensToSell: bigint;
  triggered: boolean;
  walletIndexAssigned?: number;
  txHash?: string;
}

const DEFAULT_MILESTONES: Milestone[] = [
  { targetMcapUsd: 15000, tokensToSell: 10_000_000n * 10n ** 18n, triggered: false }, // 10M tokens = 1% supply
  { targetMcapUsd: 30000, tokensToSell: 10_000_000n * 10n ** 18n, triggered: false },
  { targetMcapUsd: 60000, tokensToSell: 10_000_000n * 10n ** 18n, triggered: false },
  { targetMcapUsd: 120000, tokensToSell: 10_000_000n * 10n ** 18n, triggered: false },
  { targetMcapUsd: 250000, tokensToSell: 10_000_000n * 10n ** 18n, triggered: false },
];

const STATE_DIR = path.resolve("./scratch");
const STATE_FILE = path.join(STATE_DIR, "milestone_state.json");

function loadState(): Milestone[] {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      // Ensure bigints are parsed correctly from string format
      return data.map((m: any) => ({
        ...m,
        tokensToSell: BigInt(m.tokensToSell)
      }));
    } catch (e) {
      console.warn("Failed to parse state file, using defaults.");
    }
  }

  return DEFAULT_MILESTONES;
}

function saveState(state: Milestone[]) {
  const serialized = state.map((m) => ({
    ...m,
    tokensToSell: m.tokensToSell.toString()
  }));
  fs.writeFileSync(STATE_FILE, JSON.stringify(serialized, null, 2), "utf8");
}

async function main() {
  console.log("-------------------------------------------------------------");
  console.log("🚨 OUTLAW CAPITAL - AUTO EXTRACT MILESTONE BOT WAKING UP 🚨");
  console.log("-------------------------------------------------------------");

  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found!");
  }
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founderWallets = wallets.founder;

  const pool = await ethers.getContractAt(
    ["function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationQueue, uint16 observationCard, uint8 feeProtocol, bool unlocked)"],
    POOL_ADDRESS
  );

  const router = await ethers.getContractAt(
    [
      "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
    ],
    ROUTER_ADDRESS
  );

  let milestones = loadState();
  console.log(`Loaded milestones. Triggers pending: ${milestones.filter(m => !m.triggered).length}`);

  // Fetch OUTLAW position mapping (token0 vs token1)
  const isOutlawToken0 = OUTLAW_ADDRESS.toLowerCase() < WETH_ADDRESS.toLowerCase();

  // Run infinite loop monitoring price
  while (true) {
    try {
      const slot = await pool.slot0();
      const tick = Number(slot.tick);

      // Sane tick boundary check to filter out RPC glitches/failures
      if (isOutlawToken0) {
        if (tick > -100000 || tick < -250000) {
          console.log(`[${new Date().toLocaleTimeString()}] Ignored glitch tick: ${tick}`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
      } else {
        if (tick < 100000 || tick > 250000) {
          console.log(`[${new Date().toLocaleTimeString()}] Ignored glitch tick: ${tick}`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
      }

      // Compute OUTLAW price in terms of WETH:
      // Price = 1.0001^(isOutlawToken0 ? tick : -tick)
      const priceWeth = Math.pow(1.0001, isOutlawToken0 ? tick : -tick);
      const priceUsd = priceWeth * ETH_PRICE_USD;
      const mcapUsd = priceUsd * Number(TOTAL_SUPPLY);

      console.log(`[${new Date().toLocaleTimeString()}] Tick: ${tick} | Price: $${priceUsd.toFixed(8)} | MCap: $${mcapUsd.toFixed(2)}`);

      // Find next untriggered milestone to check
      const nextMilestoneIdx = milestones.findIndex(m => !m.triggered);

      if (nextMilestoneIdx !== -1) {
        const milestone = milestones[nextMilestoneIdx];

        if (mcapUsd >= milestone.targetMcapUsd) {
          console.log(`\n🎉 TARGET MCAP HIT: $${mcapUsd.toFixed(2)} >= $${milestone.targetMcapUsd}!`);
          
          // Select wallet to sell from (use milestone index to assign a separate founder wallet)
          const walletIndex = nextMilestoneIdx % founderWallets.length;
          const walletData = founderWallets[walletIndex];
          const wallet = new ethers.Wallet(walletData.privateKey, ethers.provider);

          console.log(`🚀 Executing Milestone Sell using Founder Wallet ${walletIndex + 1} (${wallet.address})...`);

          const amountIn = milestone.tokensToSell;

          const params = {
            tokenIn: OUTLAW_ADDRESS,
            tokenOut: WETH_ADDRESS,
            fee: 10000n, // 1%
            recipient: wallet.address,
            amountIn: amountIn,
            amountOutMinimum: 0n, // Accept price impact for direct milestone sells
            sqrtPriceLimitX96: 0n
          };

          const tx = await router.connect(wallet).exactInputSingle(params);
          console.log(`  Swap transaction submitted: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log(`  Milestone Swap Confirmed in block ${receipt.blockNumber}!`);

          // Mark triggered and save state
          milestone.triggered = true;
          milestone.walletIndexAssigned = walletIndex;
          milestone.txHash = tx.hash;
          saveState(milestones);

          console.log(`💾 Milestone Trigger state saved to local JSON database.\n`);
        }
      } else {
        console.log("All milestones triggered. Bot entering idle sleep mode.");
        break;
      }
    } catch (e: any) {
      console.error("Error in bot extraction cycle:", e.message || e);
    }

    // Sleep 10 seconds before next price check
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
