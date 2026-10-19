import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { SOLANA_CONFIG } from "../config";

export interface BondingCurveState {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

// Discriminators (Anchor sha256("global:<name>")[0..8])
const CREATE_DISCRIMINATOR = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 73, 173]);

export class PumpFunService {
  /**
   * Derive the bonding curve PDA for a given mint
   */
  static getBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bonding-curve"), mint.toBuffer()],
      SOLANA_CONFIG.pumpProgramId
    );
  }

  /**
   * Derive the associated bonding curve token account
   */
  static getAssociatedBondingCurve(mint: PublicKey, bondingCurve: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(mint, bondingCurve, true);
  }

  /**
   * Derive the Metaplex metadata PDA for a given mint
   */
  static getMetadataPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        SOLANA_CONFIG.mplTokenMetadata.toBuffer(),
        mint.toBuffer()
      ],
      SOLANA_CONFIG.mplTokenMetadata
    );
  }

  /**
   * Derive the mint authority PDA
   */
  static getMintAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("mint-authority")],
      SOLANA_CONFIG.pumpProgramId
    );
  }

  /**
   * Parse the on-chain bonding curve account data buffer
   */
  static parseBondingCurveState(data: Buffer): BondingCurveState {
    if (data.length < 49) {
      throw new Error(`Invalid bonding curve buffer length: ${data.length}`);
    }
    // Offset 8 skips the 8-byte discriminator
    const offset = 8;
    const virtualTokenReserves = data.readBigUInt64LE(offset);
    const virtualSolReserves = data.readBigUInt64LE(offset + 8);
    const realTokenReserves = data.readBigUInt64LE(offset + 16);
    const realSolReserves = data.readBigUInt64LE(offset + 24);
    const tokenTotalSupply = data.readBigUInt64LE(offset + 32);
    const complete = data.readUInt8(offset + 40) === 1;

    return {
      virtualTokenReserves,
      virtualSolReserves,
      realTokenReserves,
      realSolReserves,
      tokenTotalSupply,
      complete
    };
  }

  /**
   * Calculate tokens received for a given SOL amount based on constant product formula (k = x * y)
   */
  static calculateTokensOut(
    solLamports: bigint,
    virtualSol: bigint,
    virtualToken: bigint
  ): bigint {
    if (solLamports <= 0n) return 0n;
    // 1% pump.fun fee deduction
    const solInAfterFee = (solLamports * 99n) / 100n;
    const k = virtualSol * virtualToken;
    const newVirtualSol = virtualSol + solInAfterFee;
    const newVirtualToken = k / newVirtualSol;
    return virtualToken - newVirtualToken;
  }

  /**
   * Calculate SOL received for selling a given token amount
   */
  static calculateSolOut(
    tokenAmount: bigint,
    virtualSol: bigint,
    virtualToken: bigint
  ): bigint {
    if (tokenAmount <= 0n) return 0n;
    const k = virtualSol * virtualToken;
    const newVirtualToken = virtualToken + tokenAmount;
    const newVirtualSol = k / newVirtualToken;
    const solOutBeforeFee = virtualSol - newVirtualSol;
    return (solOutBeforeFee * 99n) / 100n;
  }

  /**
   * Build Pump.fun Create Instruction
   */
  static createTokenInstruction(params: {
    mint: PublicKey;
    creator: PublicKey;
    name: string;
    symbol: string;
    uri: string;
  }): TransactionInstruction {
    const { mint, creator, name, symbol, uri } = params;
    const [bondingCurve] = this.getBondingCurvePDA(mint);
    const associatedBondingCurve = this.getAssociatedBondingCurve(mint, bondingCurve);
    const [metadata] = this.getMetadataPDA(mint);
    const [mintAuthority] = this.getMintAuthorityPDA();

    // Encode Borsh string arguments
    const encodeString = (str: string) => {
      const buf = Buffer.from(str, "utf8");
      const len = Buffer.alloc(4);
      len.writeUInt32LE(buf.length, 0);
      return Buffer.concat([len, buf]);
    };

    const data = Buffer.concat([
      CREATE_DISCRIMINATOR,
      encodeString(name),
      encodeString(symbol),
      encodeString(uri)
    ]);

    const keys = [
      { pubkey: mint, isSigner: true, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: SOLANA_CONFIG.pumpGlobal, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.mplTokenMetadata, isSigner: false, isWritable: false },
      { pubkey: metadata, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpEventAuthority, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpProgramId, isSigner: false, isWritable: false }
    ];

    return new TransactionInstruction({
      programId: SOLANA_CONFIG.pumpProgramId,
      keys,
      data
    });
  }

  /**
   * Build Pump.fun Buy Instruction
   */
  static createBuyInstruction(params: {
    mint: PublicKey;
    buyer: PublicKey;
    tokenAmount: bigint;
    maxSolLamports: bigint;
  }): TransactionInstruction {
    const { mint, buyer, tokenAmount, maxSolLamports } = params;
    const [bondingCurve] = this.getBondingCurvePDA(mint);
    const associatedBondingCurve = this.getAssociatedBondingCurve(mint, bondingCurve);
    const associatedUser = getAssociatedTokenAddressSync(mint, buyer, true);

    const data = Buffer.alloc(8 + 8 + 8);
    BUY_DISCRIMINATOR.copy(data, 0);
    data.writeBigUInt64LE(tokenAmount, 8);
    data.writeBigUInt64LE(maxSolLamports, 16);

    const keys = [
      { pubkey: SOLANA_CONFIG.pumpGlobal, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpFeeRecipient, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedUser, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpEventAuthority, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpProgramId, isSigner: false, isWritable: false }
    ];

    return new TransactionInstruction({
      programId: SOLANA_CONFIG.pumpProgramId,
      keys,
      data
    });
  }

  /**
   * Build Pump.fun Sell Instruction
   */
  static createSellInstruction(params: {
    mint: PublicKey;
    seller: PublicKey;
    tokenAmount: bigint;
    minSolLamports: bigint;
  }): TransactionInstruction {
    const { mint, seller, tokenAmount, minSolLamports } = params;
    const [bondingCurve] = this.getBondingCurvePDA(mint);
    const associatedBondingCurve = this.getAssociatedBondingCurve(mint, bondingCurve);
    const associatedUser = getAssociatedTokenAddressSync(mint, seller, true);

    const data = Buffer.alloc(8 + 8 + 8);
    SELL_DISCRIMINATOR.copy(data, 0);
    data.writeBigUInt64LE(tokenAmount, 8);
    data.writeBigUInt64LE(minSolLamports, 16);

    const keys = [
      { pubkey: SOLANA_CONFIG.pumpGlobal, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpFeeRecipient, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedUser, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpEventAuthority, isSigner: false, isWritable: false },
      { pubkey: SOLANA_CONFIG.pumpProgramId, isSigner: false, isWritable: false }
    ];

    return new TransactionInstruction({
      programId: SOLANA_CONFIG.pumpProgramId,
      keys,
      data
    });
  }
}
