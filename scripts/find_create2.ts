import { ethers } from "ethers";

const p = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com/');
const DEPLOYER_ADDR = "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42";

async function main() {
  const code = await p.getCode(DEPLOYER_ADDR);
  const hex = code.slice(2);

  // Search for CREATE2 (f5)
  let pos = 0;
  const matches: number[] = [];
  while ((pos = hex.indexOf("f5", pos)) !== -1) {
    if (pos % 2 === 0) {
      matches.push(pos / 2);
    }
    pos += 2;
  }
  console.log(`Found ${matches.length} CREATE2 opcodes in LaunchDeployer at bytecode offsets:`, matches);

  // For each CREATE2, inspect surrounding 60 bytes
  for (const m of matches) {
    const start = Math.max(0, m - 40);
    const end = Math.min(hex.length / 2, m + 10);
    console.log(`CREATE2 at offset ${m}:`, hex.slice(start * 2, end * 2));
  }
}

main().catch(console.error);
