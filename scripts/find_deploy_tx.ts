import hre from "hardhat";

async function main() {
  const deployerAddress = "0x9325bcA0D53f5BeB1DeD01d5Cbb58025dc5fe63f";
  const expectedTokenAddress = "0xf44FF4c8aBBa9D2389eeEF58AB09b355193B0f72";
  
  const latestNonce = await hre.ethers.provider.getTransactionCount(deployerAddress, "latest");
  console.log(`Latest Nonce: ${latestNonce}`);

  let found = false;
  for (let nonce = 0; nonce < latestNonce; nonce++) {
    const computedAddr = hre.ethers.getCreateAddress({
      from: deployerAddress,
      nonce: nonce
    });
    
    if (computedAddr.toLowerCase() === expectedTokenAddress.toLowerCase()) {
      console.log(`Match! Nonce ${nonce} deployed ${expectedTokenAddress}`);
      found = true;
    }
  }

  if (!found) {
    console.log(`Could not find any transaction from ${deployerAddress} that would result in address ${expectedTokenAddress}.`);
    console.log("Printing last 10 computed contract addresses:");
    for (let nonce = Math.max(0, latestNonce - 10); nonce < latestNonce; nonce++) {
      const computedAddr = hre.ethers.getCreateAddress({
        from: deployerAddress,
        nonce: nonce
      });
      console.log(`  Nonce ${nonce} -> ${computedAddr}`);
    }
  }
}

main().catch(console.error);
