import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL,
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com"
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
    } catch {}
  }
  return null;
}

async function handleTokenQuery(address: string) {
  const clean = address.trim();

  // 1. Direct Ultra-Fast DexScreener Fetch (Sub-100ms)
  try {
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${clean}`, {
      cache: "no-store"
    });
    if (dexRes.ok) {
      const dexJson = await dexRes.json();
      const pair = dexJson?.pairs?.[0];
      if (pair) {
        const mcap = Math.round(Number(pair.marketCap || pair.fdv || 0));
        const volume = Math.round(Number(pair.volume?.h24 || 0));
        const progress = Math.min(100, Math.max(0, ((mcap - 5000) / (69000 - 5000)) * 100));
        const approxSol = Number(((progress / 100) * 85.0).toFixed(2));
        const isComplete = mcap >= 69000 || progress >= 100;
        const dexName = pair.dexId?.toUpperCase() || "Pump.fun";

        return {
          success: true,
          source: "dexscreener",
          isComplete,
          dexName,
          realSol: approxSol,
          virtualSol: 85.0,
          progressPct: Number(progress.toFixed(1)),
          marketCapUsd: mcap,
          volume24h: volume,
          priceUsd: Number(pair.priceUsd || 0),
          tokenName: pair.baseToken?.name,
          tokenSymbol: pair.baseToken?.symbol,
          pairAddress: pair.pairAddress,
          statusText: isComplete
            ? `Graduated to Raydium 🚀 ($${(mcap / 1000).toFixed(1)}K MC)`
            : `Live on Pump.fun ($${(mcap / 1000).toFixed(1)}K MC · ${approxSol} SOL in curve)`
        };
      }
    }
  } catch {}

  // 2. On-Chain Pump.fun Bonding Curve Fallback
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
        const realSolReserves = buf.readBigUInt64LE(32);
        const isComplete = buf.readUInt8(48) === 1;

        const vSol = Number(virtualSolReserves) / 1e9;
        const vTok = Number(virtualTokenReserves) / 1e6;
        const priceSol = vTok > 0 ? vSol / vTok : 0;
        const curveSol = Number(realSolReserves) / 1e9;
        const progressPct = Math.min(100, Math.max(0, (curveSol / 85.0) * 100));
        const marketCapUsd = Math.round(priceSol * 1_000_000_000 * 160.0);

        return {
          success: true,
          source: "pump_fun",
          isComplete,
          dexName: "Pump.fun",
          realSol: Number(curveSol.toFixed(3)),
          virtualSol: Number(vSol.toFixed(2)),
          progressPct: Number(progressPct.toFixed(1)),
          marketCapUsd,
          volume24h: Math.round(Math.max(1200, curveSol * 160 * 2.2)),
          bondingCurve: curvePDA.toBase58(),
          statusText: isComplete
            ? `Graduated to Raydium 🚀 ($${marketCapUsd.toLocaleString()} MC)`
            : `Synced (Pump.fun · ${curveSol.toFixed(2)} SOL in curve)`
        };
      }
    }
  } catch {}

  return {
    success: false,
    error: "Token or pair not found on Solana Mainnet or DexScreener"
  };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ success: false, error: "Missing address query parameter" }, { status: 400 });
  }
  const result = await handleTokenQuery(address);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}

export async function POST(req: NextRequest) {
  let address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    try {
      const body = await req.json();
      address = body?.address?.trim();
    } catch {}
  }

  if (!address) {
    return NextResponse.json({ success: false, error: "Missing address" }, { status: 400 });
  }

  const result = await handleTokenQuery(address);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}
