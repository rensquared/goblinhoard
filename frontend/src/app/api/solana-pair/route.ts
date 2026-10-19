import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL,
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com"
].filter(Boolean) as string[];

async function querySolanaRpc(method: string, params: any[]): Promise<any> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params
        }),
        cache: "no-store"
      });
      if (res.ok) {
        const json = await res.json();
        if (json && !json.error) return json.result;
      }
    } catch {
      // try next RPC
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return NextResponse.json({ success: false, error: "Missing address" }, { status: 400 });
    }

    const clean = address.trim();

    // 1. Try On-Chain Pump.fun Bonding Curve
    try {
      const mintPubkey = new PublicKey(clean);
      const [curvePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), mintPubkey.toBuffer()],
        PUMP_PROGRAM_ID
      );

      const accInfo = await querySolanaRpc("getAccountInfo", [
        curvePDA.toBase58(),
        { encoding: "base64" }
      ]);

      if (accInfo?.data?.[0]) {
        const buf = Buffer.from(accInfo.data[0], "base64");
        if (buf.length >= 49) {
          const virtualTokenReserves = buf.readBigUInt64LE(8);
          const virtualSolReserves = buf.readBigUInt64LE(16);
          const realTokenReserves = buf.readBigUInt64LE(24);
          const realSolReserves = buf.readBigUInt64LE(32);
          const isComplete = buf.readUInt8(48) === 1;

          const vSol = Number(virtualSolReserves) / 1e9;
          const vTok = Number(virtualTokenReserves) / 1e6;
          const priceSol = vTok > 0 ? vSol / vTok : 0;
          const curveSol = Number(realSolReserves) / 1e9;
          const progressPct = Math.min(100, Math.max(0, (curveSol / 85.0) * 100));

          // If graduated or near migration, also check DexScreener for live Raydium pool price
          let marketCapUsd = Math.round(priceSol * 1_000_000_000 * 160.0);
          let dexName = "Pump.fun";

          if (isComplete) {
            try {
              const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${clean}`, { cache: "no-store" });
              const dexJson = await dexRes.json();
              const pair = dexJson?.pairs?.[0];
              if (pair) {
                marketCapUsd = Math.round(Number(pair.marketCap || pair.fdv || marketCapUsd));
                dexName = pair.dexId?.toUpperCase() || "Raydium";
              }
            } catch {
              // keep fallback
            }
          }

          return NextResponse.json({
            success: true,
            source: "pump_fun",
            isComplete,
            dexName,
            realSol: Number(curveSol.toFixed(3)),
            virtualSol: Number(vSol.toFixed(2)),
            progressPct: Number(progressPct.toFixed(1)),
            marketCapUsd,
            volume24h: Math.round(Math.max(1200, curveSol * 160 * 2.2)),
            bondingCurve: curvePDA.toBase58(),
            statusText: isComplete
              ? `Graduated to ${dexName} 🚀 ($${marketCapUsd.toLocaleString()} MC)`
              : `Synced (Pump.fun · ${curveSol.toFixed(2)} SOL in curve)`
          });
        }
      }
    } catch {
      // Not a direct mint keypair or curve
    }

    // 2. Fallback: DexScreener Universal Lookup (supports migrated tokens, Raydium pairs, etc.)
    try {
      const [tokenRes, pairRes] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${clean}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${clean}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null)
      ]);

      const pair = tokenRes?.pairs?.[0] || pairRes?.pair;
      if (pair) {
        const mcap = Math.round(Number(pair.marketCap || pair.fdv || 0));
        const liqQuote = Number(pair.liquidity?.quote || 0);
        const liqUsd = Number(pair.liquidity?.usd || 0);
        const dexId = pair.dexId?.toUpperCase() || "SOLANA DEX";

        return NextResponse.json({
          success: true,
          source: "dexscreener",
          isComplete: true,
          dexName: dexId,
          realSol: Number((liqQuote || liqUsd / 160).toFixed(2)),
          virtualSol: 85.0,
          progressPct: 100.0,
          marketCapUsd: mcap,
          volume24h: Math.round(Number(pair.volume?.h24 || 2500)),
          tokenName: pair.baseToken?.name,
          tokenSymbol: pair.baseToken?.symbol,
          pairAddress: pair.pairAddress,
          statusText: `Synced (${dexId} · $${mcap.toLocaleString()} MC)`
        });
      }
    } catch {
      // DexScreener error
    }

    return NextResponse.json({
      success: false,
      error: "Token or pair not found on Solana Mainnet or DexScreener (Unminted or invalid address)"
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
