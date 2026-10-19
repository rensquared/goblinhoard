import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const CURVE = "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a";
const FEE_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const DEPLOYER = "0x3E90d09B0aD64aDAF10E62533f4b90DD47aBD9A3";

async function main() {
  const p = new ethers.JsonRpcProvider(RPC_URL);

  const curve = new ethers.Contract(CURVE, [
    "function quoteReserve() external view returns (uint256)",
    "function tokenReserve() external view returns (uint256)",
    "function creatorTaxBalance() external view returns (uint256)"
  ], p);

  const quoteReserve = await curve.quoteReserve();
  const tokenReserve = await curve.tokenReserve();
  const curveEth = await p.getBalance(CURVE);
  const curveTaxBal = await curve.creatorTaxBalance();

  console.log("==================================================================");
  console.log("            LIVE ONCHAIN PONS V2 CURVE STATUS                     ");
  console.log("==================================================================");
  console.log(`Curve ETH Balance:         ${ethers.formatEther(curveEth)} ETH`);
  console.log(`Curve Quote Reserve:       ${ethers.formatEther(quoteReserve)} ETH`);
  console.log(`Curve Token Reserve:       ${ethers.formatUnits(tokenReserve, 18)} GTEST`);
  console.log(`Curve Creator Tax Balance: ${ethers.formatEther(curveTaxBal)} ETH`);

  // Inspect escrow selectors
  const escrowCode = await p.getCode(FEE_ESCROW);
  function extractSelectors(bytecode: string): string[] {
    const selectors = new Set<string>();
    const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
    const regex = /63([0-9a-fA-F]{8})/g;
    let match;
    while ((match = regex.exec(hex)) !== null) {
      selectors.add("0x" + match[1]);
    }
    return Array.from(selectors);
  }
  const escrowSels = extractSelectors(escrowCode);
  console.log("FeeEscrow selectors count:", escrowSels.length);
  const escrow = new ethers.Contract(FEE_ESCROW, [
    "function balanceOf(address account) external view returns (uint256)"
  ], p);
  const escrowFee = await escrow.balanceOf(DEPLOYER);
  console.log(`FeeEscrow for Deployer:  ${ethers.formatEther(escrowFee)} ETH`);
  console.log("==================================================================");
}

main().catch(console.error);
