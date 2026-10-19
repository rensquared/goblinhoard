import { ethers } from "ethers";

const p = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com/');
async function main() {
  const addrs = [
    "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948", // LaunchForwarder
    "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e", // Factory
    "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42", // LaunchDeployer
    "0x31eA5b453A6Cd60F36203830DE046ff32DeC2CDB"  // 0x31eA
  ];
  const tokenCode = await p.getCode("0xc9564cc1818b69E09789B1D67da684692A6daAA6");
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
  const tokenSelectors = extractSelectors(tokenCode);
  console.log("Token selectors:", tokenSelectors);
}

main().catch(console.error);
