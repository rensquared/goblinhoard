import { ethers } from "ethers";

const p = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com/');

async function readSlots(addr: string, name: string) {
  console.log(`--- Storage slots for ${name} (${addr}) ---`);
  for (let i = 0; i < 15; i++) {
    const val = await p.getStorage(addr, i);
    if (val !== ethers.ZeroHash) {
      console.log(`Slot ${i}: ${val}`);
    }
  }
}

async function main() {
  const curveCode = await p.getCode("0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a");
  console.log("Curve code length:", curveCode.length);
  const tokenCode = await p.getCode("0xc9564cc1818b69E09789B1D67da684692A6daAA6");
  console.log("Token code length:", tokenCode.length);
}

main().catch(console.error);
