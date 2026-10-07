import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployedPath = path.resolve("./scratch/deployed_addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const NFPM_ADDRESS = deployed.nfpm;

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founder1 = wallets.founder[0];

  const nfpm = await hre.ethers.getContractAt(
    [
      "function balanceOf(address owner) external view returns (uint256)",
      "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
      "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
    ],
    NFPM_ADDRESS
  );

  const nftBal = await nfpm.balanceOf(founder1.address);
  console.log(`Founder Wallet 1 LP NFT Balance: ${nftBal.toString()}`);

  if (nftBal === 0n) {
    console.log("No LP positions found for Founder Wallet 1.");
    return;
  }

  for (let i = 0; i < Number(nftBal); i++) {
    const tokenId = await nfpm.tokenOfOwnerByIndex(founder1.address, i);
    const pos = await nfpm.positions(tokenId);
    console.log(`\nLP NFT Position Token ID: ${tokenId.toString()}`);
    console.log(`  Liquidity: ${pos.liquidity.toString()}`);
    console.log(`  Tokens Owed 0 (WETH):   ${hre.ethers.formatEther(pos.tokensOwed0)} WETH`);
    console.log(`  Tokens Owed 1 (OUTLAW): ${hre.ethers.formatUnits(pos.tokensOwed1, 18)} OUTLAW`);
  }
}

main().catch(console.error);
