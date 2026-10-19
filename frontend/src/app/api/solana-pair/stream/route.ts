import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

const RPC_HTTP = process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
const RPC_WSS = process.env.SOLANA_WSS_URL || "wss://api.mainnet-beta.solana.com";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim();

  if (!address || address.length < 32 || address.length > 44) {
    return new Response(JSON.stringify({ error: "Invalid address" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let accountSubId: number | null = null;
      let pollInterval: NodeJS.Timeout | null = null;

      const sendEvent = (data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      const closeStream = () => {
        if (isClosed) return;
        isClosed = true;
        if (accountSubId !== null) {
          try {
            conn.removeAccountChangeListener(accountSubId);
          } catch {}
        }
        if (pollInterval) clearInterval(pollInterval);
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", () => {
        closeStream();
      });

      const conn = new Connection(RPC_HTTP, {
        wsEndpoint: RPC_WSS,
        commitment: "processed"
      });

      try {
        const mintPubkey = new PublicKey(address);
        const [curvePDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("bonding-curve"), mintPubkey.toBuffer()],
          PUMP_PROGRAM_ID
        );

        // Function to parse bonding curve buffer
        const parseCurveData = (buf: Buffer) => {
          if (buf.length < 49) return null;
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
              : `Synced (Pump.fun · ${curveSol.toFixed(2)} SOL in curve)`,
            timestamp: Date.now()
          };
        };

        // 1. Fetch initial account state immediately
        const initialInfo = await conn.getAccountInfo(curvePDA, "processed");
        if (initialInfo?.data) {
          const parsed = parseCurveData(initialInfo.data);
          if (parsed) sendEvent(parsed);
        } else {
          // Check DexScreener as immediate fallback for migrated tokens
          try {
            const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
              cache: "no-store"
            });
            const dexJson = await dexRes.json();
            const pair = dexJson?.pairs?.[0];
            if (pair) {
              const mcap = Math.round(Number(pair.marketCap || pair.fdv || 0));
              const liqQuote = Number(pair.liquidity?.quote || 0);
              const liqUsd = Number(pair.liquidity?.usd || 0);
              const dexId = pair.dexId?.toUpperCase() || "SOLANA DEX";

              sendEvent({
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
                statusText: `Synced (${dexId} · $${mcap.toLocaleString()} MC)`,
                timestamp: Date.now()
              });
            } else {
              sendEvent({
                success: false,
                error: "Token or pair not found on Solana Mainnet or DexScreener"
              });
            }
          } catch {
            sendEvent({
              success: false,
              error: "Token not found on Solana"
            });
          }
        }

        // 2. Subscribe via Solana WebSocket for sub-second real-time slot updates
        accountSubId = conn.onAccountChange(
          curvePDA,
          (info) => {
            const parsed = parseCurveData(info.data);
            if (parsed) {
              sendEvent(parsed);
            }
          },
          "processed"
        );

        // 3. Fallback heartbeat & DexScreener sync every 2.5s
        pollInterval = setInterval(async () => {
          if (isClosed) return;
          try {
            const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
              cache: "no-store"
            });
            const dexJson = await dexRes.json();
            const pair = dexJson?.pairs?.[0];
            if (pair) {
              const mcap = Math.round(Number(pair.marketCap || pair.fdv || 0));
              const volume = Math.round(Number(pair.volume?.h24 || 2500));
              sendEvent({
                heartbeat: true,
                marketCapUsd: mcap,
                volume24h: volume,
                priceUsd: Number(pair.priceUsd || 0),
                txns24h: pair.txns?.h24 || null,
                timestamp: Date.now()
              });
            }
          } catch {}
        }, 2500);
      } catch (err: any) {
        sendEvent({ success: false, error: err.message || "Failed to initialize stream" });
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
