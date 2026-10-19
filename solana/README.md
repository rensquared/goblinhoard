# Hoarded ($HOARD) - Solana Launchpad & Atomic Bundle Engine

This directory contains the complete Solana port of **Hoarded ($HOARD)**, transitioning the project from Robinhood Chain to Solana using the **Pump.fun Bonding Curve** and **Jito Block-0 Atomic Bundles**.

---

## ⚡ Key Architectural Advantages over EVM

1. **True Atomic Block-0 Bundles (Jito)**:
   - In EVM, multi-wallet buys were sequential and slow, causing front-running and slippage.
   - On Solana via Jito Block Engine, the **Token Creation**, **Dev Buy**, and **10 Sub-Wallet Sniper Buys** land in **Slot 0 within the exact same slot atomically**. Zero front-running possible.
2. **Sub-Second Execution & Reaction**:
   - Solana transactions finalize in ~400ms.
   - The Automated Profit Bot monitors the bonding curve via RPC/WebSocket and takes profit instantly at target milestones without RPC bottlenecks.
3. **Rent Reclaim Engine**:
   - Reclaims ~0.00204 SOL rent per closed token account upon liquidation.

---

## 📁 File Structure

```
solana/
├── config.ts                           # Global configuration, RPCs, Jito Tip Accounts, Program IDs
├── wallets_hoard_sol.json              # 10 Sub-wallets keypairs, roles & buy allocations
├── utils/
│   ├── pump.ts                         # Pump.fun instruction encoders, PDAs, and constant product math
│   ├── jito.ts                         # Jito Block Engine submission and tip transaction builder
│   └── vanity.ts                       # Fast vanity keypair grinder (e.g. "food...")
├── scripts/
│   ├── generate_launch_wallets.ts      # Generates Deployer & 10 Sub-wallets with tiered allocations
│   ├── fund_subwallets.ts              # Batch distributes SOL to all 10 sub-wallets from Deployer
│   ├── launch_jito_bundle.ts           # The 5-Tx Atomic Block-0 Jito Bundle Launcher
│   ├── profit_taking_bot.ts            # High-speed sub-25k tiered profit-taking bot
│   └── audit_and_sweep.ts              # Audits balances, closes token accounts, sweeps SOL to Deployer
└── scratch/                            # Receipts and vanity keypair artifacts
```

---

## 🚀 Execution Playbook

### Step 1: Environment Setup
In your `.env` file in the root directory, configure your Solana Private Key (Base58) and optional RPC:
```env
SOLANA_PRIVATE_KEY=your_base58_deployer_private_key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com # Or Helius/QuickNode
```

### Step 2: Generate / Inspect Wallets
Generate the 10 sniper sub-wallets (with optional `--vanity` for `food...` prefixes):
```bash
npx ts-node solana/scripts/generate_launch_wallets.ts
```

### Step 3: Batch Fund Sub-Wallets
Preview distribution in dry-run mode:
```bash
npx ts-node solana/scripts/fund_subwallets.ts
```
When funded and ready to execute live on-chain:
```bash
npx ts-node solana/scripts/fund_subwallets.ts --live
```

### Step 4: Launch via Atomic Jito Bundle
Test full simulation and curve math in dry-run:
```bash
npx ts-node solana/scripts/launch_jito_bundle.ts
```
Execute atomic launch in Slot 0:
```bash
npx ts-node solana/scripts/launch_jito_bundle.ts --live
```
*Receipt is automatically saved to `solana/scratch/solana_launch_receipt.json` with DexScreener, Photon, and Solscan links.*

### Step 5: Start the Sub-25k Profit Taking Bot
Run the profit bot in a separate terminal:
```bash
npx ts-node solana/scripts/profit_taking_bot.ts --live
```
**Tiered Profit Milestones**:
- **Tier 1 ($9,500 Mcap)**: Sells 60% of Alpha Snipers (Wallets 1-3) -> Secures initial capital.
- **Tier 2 ($14,000 Mcap)**: Sells 70% of Beta Swarm (Wallets 4-6) + closes Wallets 1-3 -> Majority harvest before $15k resistance.
- **Tier 3 ($18,500 Mcap)**: Sells 80% of Gamma Citadel (Wallets 7-9) + closes Wallets 4-6.
- **Tier 4 ($22,500 Mcap)**: Liquidates remaining Wallets 7-9 + 50% of Moonbag (Wallet 10), leaving 50% moonbag to ride to Raydium migration!

### Step 6: Audit & Sweep Profits
Inspect all balances:
```bash
npx ts-node solana/scripts/audit_and_sweep.ts
```
Reclaim rent from closed token accounts and sweep all SOL back to Deployer:
```bash
npx ts-node solana/scripts/audit_and_sweep.ts --close-accounts --sweep
```

---

## 🌐 3D Frontend (`hoarded.fun`) Live Sync

The 3D interactive web world at [`frontend/src/components/GoblinHoard3D.tsx`](../frontend/src/components/GoblinHoard3D.tsx) has been updated to automatically detect Solana Base58 mint addresses.

To point the live site to your launched Solana token, simply set in `frontend/.env.local`:
```env
NEXT_PUBLIC_SOLANA_MINT_ADDRESS=<Your_Launched_Mint_Address>
```
The site will query the Solana Pump.fun bonding curve every 3.5 seconds, calculating live Market Cap and reserves, animating the Hoard gold pile, spawning floating buy/sell bubbles, and recruiting goblins!
