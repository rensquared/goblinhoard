import { Connection, PublicKey, Transaction, Keypair, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=== TRANSFERRING ALL SOL ===");
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const conn = new Connection(rpcUrl, "confirmed");

  const walletPath = path.resolve(__dirname, "../wallets/creator_wallet.json");
  const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(bs58.decode(raw.privateKey));
  const destination = new PublicKey("46uZPMaRmPKu2qyN2WZswHdYLtJSRz57gBASUjCk3BeM");

  console.log("From Wallet:", payer.publicKey.toBase58());
  console.log("To Wallet:  ", destination.toBase58());

  const balance = await conn.getBalance(payer.publicKey);
  console.log(`Current Balance: ${(balance / 1e9).toFixed(9)} SOL (${balance} lamports)`);

  const fee = 5000; // Standard 1-signature network fee
  const sendAmount = balance - fee;

  if (sendAmount <= 0) {
    console.error("Insufficient balance to cover fee.");
    process.exit(1);
  }

  console.log(`Sending:         ${(sendAmount / 1e9).toFixed(9)} SOL (${sendAmount} lamports)`);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: destination,
      lamports: sendAmount,
    })
  );

  tx.feePayer = payer.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.sign(payer);

  console.log("Broadcasting transaction...");
  const signature = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 5,
  });

  console.log("Tx signature submitted:", signature);
  console.log("Waiting for confirmation...");

  const confirmation = await conn.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    console.error("Transfer failed:", confirmation.value.err);
    process.exit(1);
  }

  console.log("Transaction successfully CONFIRMED on Solana!");
  const newBalance = await conn.getBalance(payer.publicKey);
  const destBalance = await conn.getBalance(destination);
  console.log(`Remaining Sender Balance:      ${(newBalance / 1e9).toFixed(9)} SOL`);
  console.log(`New Destination Balance:       ${(destBalance / 1e9).toFixed(9)} SOL`);
  console.log(`Solscan URL: https://solscan.io/tx/${signature}`);
}

main().catch((err) => {
  console.error("Transfer error:", err);
  process.exit(1);
});
