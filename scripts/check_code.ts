import { ethers } from "hardhat";

async function main() {
  const address = ethers.getAddress("0xEb52d7Ad94adeA5033B0b8c1623B4133aa83588d".toLowerCase());
  const code = await ethers.provider.getCode(address);
  console.log(`Address: ${address}`);
  console.log(`Bytecode length: ${code.length}`);
}

main().catch(console.error);
