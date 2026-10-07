import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  // Compute contract address helper
  function getContractAddress(sender: string, nonce: number): string {
    const rlpEncoded = ethers.encodeRlp([sender, ethers.toBeHex(nonce)]);
    const hash = ethers.keccak256(rlpEncoded);
    return ethers.getAddress("0x" + hash.substring(26));
  }

  console.log("\nScanning contract addresses for nonces 170 to 228:");
  for (let nonce = 170; nonce <= 228; nonce++) {
    const address = getContractAddress(deployer.address, nonce);
    const code = await ethers.provider.getCode(address);
    if (code !== "0x") {
      console.log(`Nonce ${nonce} -> Created Contract: ${address} | Bytecode Length: ${code.length}`);
      
      // If it's a token contract, check name/symbol
      try {
        const token = await ethers.getContractAt("OutlawToken", address);
        const name = await token.name();
        const symbol = await token.symbol();
        const totalSupply = await token.totalSupply();
        console.log(`  [Token] Name: "${name}" | Symbol: "${symbol}" | TotalSupply: ${ethers.formatEther(totalSupply)}`);
      } catch (err) {}
      
      // Check if it matches HeistEngine
      try {
        const engine = await ethers.getContractAt("HeistEngine", address);
        const tokenAddr = await engine.token();
        console.log(`  [HeistEngine] Token Address: ${tokenAddr}`);
      } catch (err) {}
    }
  }
}

main().catch(console.error);
