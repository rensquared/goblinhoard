import { ethers } from "hardhat";

async function main() {
  const FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
  const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
  const token = ethers.getAddress("0x45A31fAa51a5d87489119621ddB65968AB709442".toLowerCase());
  
  const factoryObj = await ethers.getContractAt(
    ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"],
    FACTORY
  );
  
  const poolAddress = await factoryObj.getPool(token, WETH, 10000);
  console.log(`Pool Address: ${poolAddress}`);
  
  if (poolAddress !== ethers.ZeroAddress) {
    const pool = await ethers.getContractAt(
      ["function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"],
      poolAddress
    );
    try {
      const slot0 = await pool.slot0();
      console.log(`Slot0 Tick: ${slot0.tick}`);
      console.log(`SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
    } catch (err: any) {
      console.log(`Pool not initialized: ${err.message}`);
    }
  }
}

main().catch(console.error);
