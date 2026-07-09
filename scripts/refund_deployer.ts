import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer address (Recipient): ${deployer.address}`);

  const walletsPath = path.resolve("./wallets.json");
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  const founder1 = wallets.founder[0];
  console.log(`Founder Wallet 1 address: ${founder1.address}`);

  const WETH_ADDRESS = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

  // 1. Instantiate Founder Wallet 1 Signer
  const founderSigner = new hre.ethers.Wallet(founder1.privateKey, hre.ethers.provider);

  const weth = await hre.ethers.getContractAt(
    [
      "function balanceOf(address src) external view returns (uint)",
      "function withdraw(uint wad) external"
    ],
    WETH_ADDRESS,
    founderSigner
  );

  // 2. Check WETH balance
  const wethBal = await weth.balanceOf(founder1.address);
  console.log(`Founder WETH balance: ${hre.ethers.formatEther(wethBal)} WETH`);

  if (wethBal > 0n) {
    // 3. Unwrap WETH -> ETH
    console.log("Unwrapping WETH into native ETH...");
    const withdrawTx = await weth.withdraw(wethBal);
    await withdrawTx.wait();
    console.log("WETH unwrapped successfully.");
  } else {
    console.log("No WETH to unwrap.");
  }

  // 4. Query total native ETH balance in Founder Wallet 1
  const ethBal = await hre.ethers.provider.getBalance(founder1.address);
  console.log(`Founder total native ETH balance: ${hre.ethers.formatEther(ethBal)} ETH`);

  if (ethBal > 0n) {
    // 5. Send entire balance minus gas back to deployer
    console.log("Sending entire native ETH balance back to deployer...");
    const feeData = await hre.ethers.provider.getFeeData();
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || hre.ethers.parseUnits("0.001", "gwei");
    const maxFeePerGas = (feeData.maxFeePerGas || hre.ethers.parseUnits("0.03", "gwei")) * 2n;
    const gasLimit = 21000n;
    const gasCost = gasLimit * maxFeePerGas;

    if (ethBal <= gasCost) {
      console.log("Founder balance is too small to cover gas cost. Cannot send transfer.");
      return;
    }

    const sendAmount = ethBal - gasCost;
    console.log(`Transferring ${hre.ethers.formatEther(sendAmount)} ETH back to deployer...`);
    const tx = await founderSigner.sendTransaction({
      to: deployer.address,
      value: sendAmount,
      gasLimit: gasLimit,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    });
    const receipt = await tx.wait();
    console.log("Transfer complete!");
    console.log(`Transaction Hash: ${receipt?.hash}`);
  } else {
    console.log("No native ETH balance to refund.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
