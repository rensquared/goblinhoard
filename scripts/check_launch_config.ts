import { ethers } from "ethers";

const p = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com/');
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";

async function main() {
  const abi = [
    "function getLaunchConfig(uint256 id) external view returns (tuple(uint256 totalSupply, uint256 initialCurveSupply, uint256 graduationThreshold, uint256 minBuy, uint24 fee, int24 tickSpacing, bool active))",
    "function getLaunchConfig(uint8 id) external view returns (tuple(uint256 totalSupply, uint256 initialCurveSupply, uint256 graduationThreshold, uint256 minBuy, uint24 fee, int24 tickSpacing, bool active))"
  ];

  const c = new ethers.Contract(FACTORY, [
    "function getLaunchConfig(uint256) external view returns (tuple(uint256,uint256,uint256,uint256,uint24,int24,bool))"
  ], p);

  try {
    const cfg0 = await c.getLaunchConfig(0);
    console.log("Config 0:", cfg0);
  } catch (e: any) {
    console.log("Config 0 err:", e.message);
  }

  try {
    const cfg1 = await c.getLaunchConfig(1);
    console.log("Config 1:", cfg1);
  } catch (e: any) {
    console.log("Config 1 err:", e.message);
  }
}

main().catch(console.error);
