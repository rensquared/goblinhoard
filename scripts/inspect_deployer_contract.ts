import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const provider = new ethers.JsonRpcProvider(RPC_URL);

async function main() {
  const DEPLOYER_ADDR = "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42";
  const code = await provider.getCode(DEPLOYER_ADDR);
  console.log("LaunchDeployer code length:", code.length);

  // Check storage or methods on LaunchDeployer
  // Common methods on deployer: tokenImplementation, curveImplementation, predictTokenAddress, etc.
  const commonFuncs = [
    "function tokenImplementation() external view returns (address)",
    "function curveImplementation() external view returns (address)",
    "function factory() external view returns (address)",
    "function owner() external view returns (address)",
    "function predictTokenAddress(bytes32 salt) external view returns (address)",
    "function predictAddress(bytes32 salt) external view returns (address)"
  ];

  // Inspect LaunchFactory bytecode for function selectors
  const factoryCode = await provider.getCode("0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e");
  console.log("Factory code length:", factoryCode.length);

  function extractSelectors(bytecode: string): string[] {
    const selectors = new Set<string>();
    // Look for PUSH4 0xXXXXXXXX (63 XXXXXXXX) followed by EQ (14) or DUP1 PUSH4 (8063)
    const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
    const regex = /63([0-9a-fA-F]{8})/g;
    let match;
    while ((match = regex.exec(hex)) !== null) {
      selectors.add("0x" + match[1]);
    }
    return Array.from(selectors);
  }

  const deployerSelectors = extractSelectors(code);
  console.log("LaunchDeployer selectors count:", deployerSelectors.length);
  console.log("LaunchDeployer selectors:", deployerSelectors.slice(0, 20));

  const factorySelectors = extractSelectors(factoryCode);
  console.log("Factory selectors count:", factorySelectors.length);
  console.log("Factory selectors:", factorySelectors.slice(0, 25));
}

main().catch(console.error);
