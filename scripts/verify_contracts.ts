import { ethers } from "hardhat";

async function main() {
  const addresses = [
    "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA"
  ];

  for (const addr of addresses) {
    const formatted = ethers.getAddress(addr.toLowerCase());
    const code = await ethers.provider.getCode(formatted);
    console.log(`Address: ${formatted} | Code Length: ${code.length}`);
  }
}

main().catch(console.error);
