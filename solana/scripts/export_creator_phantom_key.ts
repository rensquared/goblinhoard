import fs from "fs";
import path from "path";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const walletPath = path.resolve(__dirname, "../wallets/creator_wallet.json");

if (!fs.existsSync(walletPath)) {
  console.error("Wallet file not found at:", walletPath);
  process.exit(1);
}

const secretKeyRaw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyRaw));

console.log("=== CREATOR WALLET PHANTOM IMPORT HELPER ===");
console.log("Public Key:", keypair.publicKey.toBase58());
console.log("Phantom-Compatible Base58 Private Key:");
console.log(bs58.encode(keypair.secretKey));
console.log("\nCopy the private key above and import it into Phantom / Solflare: Settings -> Manage Accounts -> Add/Connect Wallet -> Import Private Key.");
