import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction
} from "@solana/web3.js";
import fetch from "node-fetch";
import bs58 from "bs58";
import { SOLANA_CONFIG } from "../config";

export class JitoService {
  /**
   * Get a random Jito tip account from the official list
   */
  static getRandomTipAccount(): PublicKey {
    const accounts = SOLANA_CONFIG.jitoTipAccounts;
    const randomIndex = Math.floor(Math.random() * accounts.length);
    return accounts[randomIndex];
  }

  /**
   * Create a Jito tip transfer instruction
   */
  static createTipInstruction(
    payer: PublicKey,
    tipLamports: number | bigint,
    tipAccount?: PublicKey
  ): TransactionInstruction {
    const recipient = tipAccount || this.getRandomTipAccount();
    return SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports: BigInt(tipLamports)
    });
  }

  /**
   * Send a bundle of versioned transactions to Jito Block Engine endpoints
   */
  static async sendBundle(
    transactions: VersionedTransaction[]
  ): Promise<{ success: boolean; bundleId?: string; error?: string }> {
    const serializedTxs = transactions.map((tx) => bs58.encode(tx.serialize()));

    for (const endpoint of SOLANA_CONFIG.jitoBlockEngineUrls) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [serializedTxs]
          })
        });

        const data = (await response.json()) as {
          jsonrpc: string;
          result?: string;
          error?: { message: string };
        };

        if (data.result) {
          return { success: true, bundleId: data.result };
        } else if (data.error) {
          console.warn(`Jito error on ${endpoint}: ${data.error.message}`);
        }
      } catch (err: any) {
        console.warn(`Failed to send bundle to ${endpoint}: ${err.message}`);
      }
    }

    return {
      success: false,
      error: "All Jito Block Engine endpoints failed or returned an error."
    };
  }

  /**
   * Poll Jito bundle status by bundleId
   */
  static async checkBundleStatus(bundleId: string): Promise<string> {
    const endpoint = SOLANA_CONFIG.jitoBlockEngineUrls[0];
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBundleStatuses",
          params: [[bundleId]]
        })
      });
      const data = (await response.json()) as any;
      if (data?.result?.value && data.result.value.length > 0) {
        return data.result.value[0]?.confirmation_status || "Pending";
      }
    } catch {
      // Ignore polling errors
    }
    return "Pending";
  }
}
