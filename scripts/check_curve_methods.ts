import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const p = new ethers.JsonRpcProvider(RPC_URL);
const CURVE = "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a";

async function main() {
  const curveCode = await p.getCode(CURVE);
  console.log("Curve code length:", curveCode.length);

  function extractSelectors(bytecode: string): string[] {
    const selectors = new Set<string>();
    const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
    const regex = /63([0-9a-fA-F]{8})/g;
    let match;
    while ((match = regex.exec(hex)) !== null) {
      selectors.add("0x" + match[1]);
    }
    return Array.from(selectors);
  }

  const selectors = extractSelectors(curveCode);
  console.log("Curve selectors count:", selectors.length);

  // Look up common swap selectors
  const testSels = selectors.slice(35, 65).join(",");
  const res = await fetch("https://api.openchain.xyz/signature-database/v1/lookup?function=" + testSels);
  const data = await res.json();
  console.log("Selectors info:", JSON.stringify(data.result.function, null, 2));
}

main().catch(console.error);
