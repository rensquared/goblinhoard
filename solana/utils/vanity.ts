import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export interface VanityResult {
  address: string;
  secretKey: string;
  attempts: number;
  durationMs: number;
}

export class VanityGrinder {
  /**
   * Fast keypair generator looking for prefix or suffix in Base58 public key
   * Case-insensitive matching optional
   */
  static grindKeypair(options: {
    prefix?: string;
    suffix?: string;
    caseSensitive?: boolean;
    maxAttempts?: number;
    logProgressInterval?: number;
  }): VanityResult {
    const {
      prefix = "",
      suffix = "",
      caseSensitive = false,
      maxAttempts = 10_000_000,
      logProgressInterval = 100_000
    } = options;

    const targetPrefix = caseSensitive ? prefix : prefix.toLowerCase();
    const targetSuffix = caseSensitive ? suffix : suffix.toLowerCase();

    const startTime = Date.now();
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      const kp = Keypair.generate();
      const pubkeyStr = kp.publicKey.toBase58();
      const checkStr = caseSensitive ? pubkeyStr : pubkeyStr.toLowerCase();

      const prefixMatch = !targetPrefix || checkStr.startsWith(targetPrefix);
      const suffixMatch = !targetSuffix || checkStr.endsWith(targetSuffix);

      if (prefixMatch && suffixMatch) {
        const durationMs = Date.now() - startTime;
        return {
          address: pubkeyStr,
          secretKey: bs58.encode(kp.secretKey),
          attempts,
          durationMs
        };
      }

      if (attempts % logProgressInterval === 0) {
        const rate = Math.floor((attempts / (Date.now() - startTime)) * 1000);
        console.log(`[Grinder] Attempts: ${attempts.toLocaleString()} (${rate.toLocaleString()} keys/sec)...`);
      }
    }

    throw new Error(`Max attempts (${maxAttempts}) reached without finding match.`);
  }
}
