# Live Mainnet Launch Walkthrough - Outlaw Capital

We have successfully deployed the official production contract suite for **Outlaw Capital (`Outlaw`)** on Robinhood Chain Mainnet. Trading is currently locked (untradeable) and ready for activation.

---

## Deployed Production Contracts

* **OutlawToken (`Outlaw`):** [`0x62B6151243185046120FAAa1226724779b81E04A`](https://robinhoodchain.blockscout.com/address/0x62B6151243185046120FAAa1226724779b81E04A)
  * Fixed supply: 1 Billion `Outlaw` tokens.
* **HeistEngine:** [`0x2dd7f8e5B08AfA437873C152E59C44fcA4fAf119`](https://robinhoodchain.blockscout.com/address/0x2dd7f8e5B08AfA437873C152E59C44fcA4fAf119)
  * Configured with EIP-2612 offline permits for all 20 reward wallets.
* **Uniswap V3 Pool:** [`0x61f48C8aB2D1f81752c98ea0F8c549a5A82b9B89`](https://robinhoodchain.blockscout.com/address/0x61f48C8aB2D1f81752c98ea0F8c549a5A82b9B89)
  * Starting price tick: `189800` ($10,000 launch Market Cap).
  * Main LP Liquidity: 700 Million `Outlaw` (70% of supply) deposited in range `185800` to `189600`.

Live addresses are saved to [`scratch/deployed_addresses.json`](file:///d:/project/robinchain/scratch/deployed_addresses.json).

---

## Wallet Distributions & Approvals

1. **Reward Reserves:** 200 Million tokens (20% of supply) distributed to the 20 reward wallets (10M each).
2. **Founder Reserves:** 100 Million tokens (10% of supply) distributed to the 10 founder wallets (10M each).
3. **Founder Setup:** All 10 founder wallets successfully registered their SwapRouter approvals on the new token address. Funding was skipped to conserve your ETH budget.

---

## Launch Trigger Sequence (To Go Live)

To open trading to the public, follow this final step:

1. Run the bridge liquidity script:
   ```bash
   npx hardhat run scripts/add_bridge_liquidity.ts --network robinhood
   ```
   *This will instantly deposit `0.002 WETH` and `10M Outlaw` into the `189600` to `190000` bridge range, completing the trading circuit.*

2. Start the milestone auto-extract bot:
   ```bash
   npx hardhat run scripts/auto_extract_bot.ts --network robinhood
   ```
