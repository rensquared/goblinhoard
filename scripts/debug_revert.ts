import { ethers } from "ethers";

const RPC_URL = "https://rpc.mainnet.chain.robinhood.com/";
const p = new ethers.JsonRpcProvider(RPC_URL);

async function main() {
  const tx = await p.getTransaction("0xdd4a44f2c18012ce608157fb2a83c1b92d655922dc6d37a40c43bd9c258d2456");
  console.log("Tx From:", tx?.from);
  console.log("Tx To:", tx?.to);
  console.log("Tx Value:", tx?.value.toString());
  console.log("Tx Data:", tx?.data);

  const curveIface = new ethers.Interface([
    "function buy(uint256 amountIn, uint256 minTokensOut, address recipient) payable returns (uint256)"
  ]);

  const buyAmount = ethers.parseEther("0.0003");
  const data = curveIface.encodeFunctionData("buy", [
    buyAmount,
    0n,
    "0x3BC9eeCd22b3EB009d3873c3a166A23b2eCC46fb"
  ]);

  try {
    const res = await p.call({
      from: "0x3BC9eeCd22b3EB009d3873c3a166A23b2eCC46fb",
      to: "0x2Bbb8084946dD88bC3c27Ea806a30c600A41606a",
      value: buyAmount,
      data: data,
      gasLimit: 300000
    });
    console.log("🎉 eth_call SUCCEEDED! Return data:", res);
    const decoded = curveIface.decodeFunctionResult("buy", res);
    console.log("Tokens to receive:", ethers.formatUnits(decoded[0], 18), "GTEST");
  } catch (err: any) {
    console.log("Revert error message:", err.message);
    console.log("Revert data:", err.data);
  }
}

main().catch(console.error);
