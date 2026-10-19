# 👺 THE HOARD: Solana Pump.fun Operator & Deployment Guide

This guide is for the operator running and maintaining **The Hoard** on Solana / Pump.fun.

---

## ⚡ Executive Summary

```
                       ┌───────────────────────────────────────────────┐
                       │   Pump.fun Trading on $HOARD Bonding Curve   │
                       └──────────────────────┬────────────────────────┘
                                              │ (1% Creator Fee)
                                              ▼
                             ┌─────────────────────────────────┐
                             │     Creator Wallet (Keypair)    │
                             └────────────────┬────────────────┘
                                              │ Real-Time WebSocket Split
                      ┌───────────────────────┴───────────────────────┐
             20% (0.2% Net Share)                            80% (0.8% Net Share)
                      ▼                                               ▼
     ┌─────────────────────────────────┐             ┌─────────────────────────────────┐
     │  Vanity Goblin Wallet (...gob)  │             │   Team / Altar Treasury Wallet  │
     │  `9umf2n1...Cgob`               │             │   `HoardAltarTreasury...`       │
     └────────────────┬────────────────┘             └─────────────────────────────────┘
                      │ Accumulates >= 0.005 SOL
                      ▼
     ┌────────────────────────────────────────────────────────┐
     │  Goblin Auto-Buyer (Swaps SOL -> $HOARD on Curve)     │
     └────────────────────────┬───────────────────────────────┘
                              │
               Is Curve >= 85.0 SOL (Graduated)?
              ┌───────────────┴───────────────┐
             NO                              YES
              ▼                               ▼
     Keep Buying $HOARD              🚀 RAYDIUM MIGRATION COMPLETE
     Push Curve to Raydium           Warband launches Multi-Pair Raids
                                     across $BONK, $WIF, $MOODENG, etc.
                                     Loot is plundered and burned in Pyre!
```

---

## ❓ Frequently Asked Questions for the Operator

### 1. Do I need to be online for the vanity wallet to work?
**NO.**
- The vanity wallet (`9umf2n1DPJb9ZE4zvrqE6xGZwszHhMHxg4k4RHUkCgob`) is a cryptographic public key on the Solana blockchain.
- It can receive funds, creator splits, and token transfers 24/7/365 without anyone having a computer or browser open.

### 2. Do I need to be online for the Fee Splitter and Auto-Buyer to work?
**YES (or run them on a cloud server/VPS).**
- The Fee Splitter and Auto-Buyer are autonomous off-chain bots that monitor Solana accounts and sign transactions.
- In production, **you do not run these in a browser or local laptop**. You run them on a server/VPS using **PM2** (included) or **Docker** so they run 24/7 in the background with auto-restart on crashes.

---

## 🚀 How to Test Everything in 3 Easy Steps

### Step 1: Instant Dry-Run Verification (0 SOL Needed)
Verify the whole pipeline (vanity wallet check, 20/80 math, auto-buyer threshold, migration detection) in 3 seconds:
```bash
npm run solana:test:dryrun
```

### Step 2: Test Live 3D Sandbox UI
1. Launch the web UI:
   ```bash
   cd frontend
   npm run dev
   ```
2. Open `http://localhost:3000`.
3. In the **"Fee Splitter & Goblin Auto-Buyer"** panel in the bottom-left/HUD:
   - Click **`Split +0.05 SOL`** &rarr; visually tests the 20% (0.010 SOL) to Goblin Wallet and 80% (0.040 SOL) to Treasury routing.
   - Click **`Spawn & Buy`** &rarr; spawns a goblin in 3D that charges towards the pyre with floating buy bubbles: `👺 Goblin Warband bought +0.005 SOL of $HOARD on Pump.fun!`.
   - Toggle **`Simulate Migration`** &rarr; verifies curve graduation to Raydium and autonomous multi-pair raiding!

### Step 3: Live On-Chain Test (Devnet or Small Mainnet SOL)
To test with real on-chain transactions:
1. Deposit `0.01 SOL` into the creator wallet.
2. Run the production daemon:
   ```bash
   npm run solana:daemon
   ```
3. Watch the console:
   - The daemon immediately detects the deposit via WebSocket.
   - Submits a single atomic transaction sending 20% to `...gob` and 80% to Treasury.
   - When the goblin wallet has >= 0.005 SOL, it executes a real buy swap on Pump.fun.

---

## 🛠️ Production Deployment (24/7 Background Running)

### Option A: Running with PM2 (Recommended)
PM2 ensures the bots stay online forever, automatically restarts them if the server reboots, and rotates logs:
```bash
# 1. Install PM2 globally (if not already installed)
npm install -g pm2

# 2. Start both the Solana daemon and Frontend
pm2 start ecosystem.config.js

# 3. Save to startup on server boot
pm2 save
pm2 startup

# 4. View live logs anytime
pm2 logs hoard-solana-daemon
```

### Option B: Running via Standalone Node/TS Command
```bash
npm run solana:daemon
```

---

## 🔑 Environment Variables Reference (`.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `TOKEN_MINT` | The Pump.fun token mint CA | `9JeFE6apEvFotefu1ocjWgSceEc3LG1LhgMxQNB4pump` |
| `CREATOR_PRIVATE_KEY` | Private key (Base58 or JSON) of creator wallet | Stored in `solana/wallets/dev_wallet.json` |
| `GOB_PRIVATE_KEY` | Private key of vanity goblin wallet (`...gob`) | Stored in `solana/wallets/goblin_wallet.json` |
| `TREASURY_WALLET` | Public key of the 80% fee recipient | e.g. `HoardAltarTreasury111111111111111111111111` |
| `SOLANA_RPC_URL` | Fast Solana RPC URL (Helius, QuickNode, Triton, or Public) | `https://api.mainnet-beta.solana.com` |
| `SOLANA_WS_URL` | Solana WebSocket endpoint | `wss://api.mainnet-beta.solana.com` |

---

## 📊 Ascension Tier Levels (Pump.fun Calibrated)

| Tier | Market Cap | Curve Status | In-Game World Unlocks |
| :--- | :--- | :--- | :--- |
| **T0: Genesis Bog** | **$5.0K** | 0 – 20 SOL | Solitary campfire lit, Chieftain Grimjaw stands vigil |
| **T1: Warband Mud Camp** | **$18.0K** | ~20 – 45 SOL | Warband gathers, Keep fortified, **Crypt of the Memes** unsealed |
| **T2: Dragon's Chasm** | **$38.0K** | ~45 – 85 SOL | Castle expands, Goblin Mine opens, **Dragon's Chasm** awakens |
| **T3: Raydium Migration** | **$69.0K** | **85 SOL (Graduation)** | **Bonding Curve Complete!** Migrated to Raydium AMM. **Multi-Pair Raiding Unleashed!** |
| **T4: Golden Citadel** | **$150.0K+** | Raydium Open Market | Golden realm monument, multi-pair plundering dominance |

---

## 📁 Key File Locations

- **Vanity Keypair**: [`solana/wallets/goblin_wallet.json`](file:///d:/project/robinchain/solana/wallets/goblin_wallet.json)
- **Production Daemon**: [`solana/scripts/run_production_daemon.ts`](file:///d:/project/robinchain/solana/scripts/run_production_daemon.ts)
- **Fee Splitter Script**: [`solana/scripts/fee_splitter_daemon.ts`](file:///d:/project/robinchain/solana/scripts/fee_splitter_daemon.ts)
- **Auto-Buyer Script**: [`solana/scripts/goblin_auto_buyer.ts`](file:///d:/project/robinchain/solana/scripts/goblin_auto_buyer.ts)
- **Dry-Run Test**: [`solana/scripts/test_pipeline_dryrun.ts`](file:///d:/project/robinchain/solana/scripts/test_pipeline_dryrun.ts)
- **PM2 Configuration**: [`ecosystem.config.js`](file:///d:/project/robinchain/ecosystem.config.js)
