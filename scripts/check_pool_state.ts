import hre from "hardhat";

async function main() {
  const poolAddress = "0x43758F0E292AD6A691514Aba8a183cf18219Dca2";
  const pool = await hre.ethers.getContractAt(
    [
      "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
      "function liquidity() external view returns (uint128)"
    ],
    poolAddress
  );

  const slot0 = await pool.slot0();
  const liquidity = await pool.liquidity();

  console.log(`Pool: ${poolAddress}`);
  console.log(`Current Tick: ${slot0.tick}`);
  console.log(`Active Liquidity: ${liquidity.toString()}`);
}

main().catch(console.error);
