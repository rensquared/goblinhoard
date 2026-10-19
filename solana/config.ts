import { PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

export const SOLANA_CONFIG = {
  // RPC Endpoints
  mainnetRpc: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  devnetRpc: "https://api.devnet.solana.com",
  wsEndpoint: process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com",

  // Jito Block Engine Endpoints
  jitoBlockEngineUrls: [
    "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
    "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles",
    "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles",
    "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles",
    "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles"
  ],

  // Jito Tip Accounts
  jitoTipAccounts: [
    new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
    new PublicKey("HFqU5x63VTxvQssQn138i26LvbTQR35427xESKAgGgav"),
    new PublicKey("Cw8CFyM9FkoMi7K7CrncAhqqQ4CtzFBgDKVaDocuRo21"),
    new PublicKey("ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49"),
    new PublicKey("DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh"),
    new PublicKey("ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt"),
    new PublicKey("DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL"),
    new PublicKey("3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT")
  ],

  // Pump.fun Protocol Constants
  pumpProgramId: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
  pumpGlobal: new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"),
  pumpFeeRecipient: new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM"),
  pumpEventAuthority: new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1"),
  mplTokenMetadata: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),

  // Token Metadata Parameters
  token: {
    name: "Hoarded",
    symbol: "HOARD",
    uri: "https://hoarded.fun/token-metadata.json",
    description: "The Hoard gathers. Creator fees recruit goblins that buy $HOARD until migration.",
    twitter: "https://x.com/hoardedfun",
    telegram: "https://t.me/hoardedfun",
    website: "https://hoarded.fun"
  },

  // File Paths
  walletsPath: path.resolve(__dirname, "./wallets_hoard_sol.json"),
  receiptPath: path.resolve(__dirname, "./scratch/solana_launch_receipt.json"),
  vanityMintPath: path.resolve(__dirname, "./scratch/vanity_mint.json")
};
