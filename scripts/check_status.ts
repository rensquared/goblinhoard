import { ethers } from "ethers";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function check() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.chain.robinhood.com/");
  const curveAddr = "0x8bf021c97f5958b746E9895E306AE3C697271EF0";
  const tokenAddr = "0xD41d83f9b1dF9D15766f353B709ca0a96fb8d6c9";
  const curve = new ethers.Contract(curveAddr, [
    "function quoteReserve() view returns (uint256)",
    "function tokenReserve() view returns (uint256)"
  ], provider);
  const token = new ethers.Contract(tokenAddr, [
    "function balanceOf(address) view returns (uint256)"
  ], provider);

  const qr = await curve.quoteReserve();
  const tr = await curve.tokenReserve();
  const price = Number(qr) / Number(tr);
  const mcapEth = price * 1e9;
  const mcapUsd = mcapEth * 2500;
  console.log("Quote Reserve ETH:", ethers.formatEther(qr));
  console.log("Token Reserve:", ethers.formatUnits(tr, 18));
  console.log("Price ETH:", price.toFixed(10));
  console.log("Mcap ETH:", mcapEth.toFixed(4), "| Mcap USD ($2500/ETH):", mcapUsd.toFixed(2));

  const wallets = JSON.parse(fs.readFileSync("./wallets_hoard.json", "utf8"));
  let totalTokens = 0n;
  for (const sw of wallets.subWallets) {
    const b = await token.balanceOf(sw.address);
    totalTokens += b;
    const eth = await provider.getBalance(sw.address);
    console.log(`SW ${sw.id} (${sw.role}): ${ethers.formatUnits(b, 18)} HOARD | ${ethers.formatEther(eth)} ETH`);
  }
  console.log(`Total Tokens held by sub-wallets: ${ethers.formatUnits(totalTokens, 18)} HOARD`);

  const privKey = process.env.PRIVATE_KEY;
  if (privKey) {
    const deployer = new ethers.Wallet(privKey, provider);
    const depEth = await provider.getBalance(deployer.address);
    const depTok = await token.balanceOf(deployer.address);
    console.log(`Deployer (${deployer.address}): ${ethers.formatUnits(depTok, 18)} HOARD | ${ethers.formatEther(depEth)} ETH`);
  }

  const taxRecipient = "0x5a886dA2B621E0C5BAa55E68a0e038680F2ECf11";
  const taxEth = await provider.getBalance(taxRecipient);
  console.log(`Tax Recipient (${taxRecipient}): ${ethers.formatEther(taxEth)} ETH`);

  const feeEscrow = new ethers.Contract("0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e", [
    "function balanceOf(address) view returns (uint256)"
  ], provider);
  const pendingFees = await feeEscrow.balanceOf(taxRecipient);
  console.log(`Fee Escrow Unclaimed for Tax Recipient: ${ethers.formatEther(pendingFees)} ETH`);
}

check().catch(console.error);
