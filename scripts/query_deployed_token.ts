import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const tokenAddress = hre.ethers.getAddress(deployed.token.toLowerCase());
  console.log(`Querying token at: ${tokenAddress}`);

  const code = await hre.ethers.provider.getCode(tokenAddress);
  console.log(`Bytecode length: ${code.length}`);
  if (code === "0x") {
    console.log("No bytecode found at this address!");
    return;
  }

  const token = await hre.ethers.getContractAt(
    [
      "function name() external view returns (string)",
      "function symbol() external view returns (string)"
    ],
    tokenAddress
  );

  const name = await token.name();
  const symbol = await token.symbol();
  
  console.log(`On-chain Name: "${name}"`);
  console.log(`On-chain Symbol: "${symbol}"`);
}

main().catch(console.error);
