import { ethers } from "ethers";

const p = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com/');
const DEPLOYER_ADDR = "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42";

async function main() {
  const code = await p.getCode(DEPLOYER_ADDR);
  const hex = code.slice(2);
  const snippet = hex.slice(2000 * 2, 2150 * 2);
  console.log("Bytecode around offset 2000-2150:");
  console.log(snippet);
}

main().catch(console.error);
