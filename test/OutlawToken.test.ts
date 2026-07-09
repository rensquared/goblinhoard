import { expect } from "chai";
import hre from "hardhat";
import { Signer, Signature } from "ethers";

// EIP-2612 Permit Signing Helper
async function getPermitSignature(
  signer: Signer,
  token: any,
  spender: string,
  value: bigint,
  deadline: number
): Promise<Signature> {
  const [ownerAddress, tokenAddress, chainId, tokenName] = await Promise.all([
    signer.getAddress(),
    token.getAddress(),
    hre.network.config.chainId || 31337,
    token.name(),
  ]);

  const nonces = await token.nonces(ownerAddress);

  const domain = {
    name: tokenName,
    version: "1",
    chainId: chainId,
    verifyingContract: tokenAddress,
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    owner: ownerAddress,
    spender: spender,
    value: value,
    nonce: nonces,
    deadline: deadline,
  };

  const sigString = await signer.signTypedData(domain, types, message);
  return Signature.from(sigString);
}

describe("Outlaw Capital Heist Engine MVP Tests", function () {
  let deployer: any;
  let user: any;
  let rewardWallets: any[] = [];
  let rewardAddresses: string[] = [];
  
  let outlawToken: any;
  let mockWETH: any;
  let mockSwapRouter: any;
  let heistEngine: any;

  beforeEach(async function () {
    // 1. Get signers
    const signers = await hre.ethers.getSigners();
    deployer = signers[0];
    user = signers[1];

    // Generate 20 local wallets for the reward pool (simulated rewardWallets)
    rewardWallets = [];
    rewardAddresses = [];
    for (let i = 0; i < 20; i++) {
      const wallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
      rewardWallets.push(wallet);
      rewardAddresses.push(wallet.address);
    }

    // 2. Deploy OUTLAW token
    const OutlawToken = await hre.ethers.getContractFactory("OutlawToken");
    outlawToken = await OutlawToken.deploy();
    await outlawToken.waitForDeployment();

    // 3. Deploy mock WETH
    const MockWETH = await hre.ethers.getContractFactory("MockWETH");
    mockWETH = await MockWETH.deploy();
    await mockWETH.waitForDeployment();

    // 4. Deploy mock SwapRouter
    const MockSwapRouter = await hre.ethers.getContractFactory("MockSwapRouter");
    mockSwapRouter = await MockSwapRouter.deploy(
      await outlawToken.getAddress(),
      await mockWETH.getAddress()
    );
    await mockSwapRouter.waitForDeployment();

    // 5. Deploy HeistEngine
    const HeistEngine = await hre.ethers.getContractFactory("HeistEngine");
    heistEngine = await HeistEngine.deploy(
      await outlawToken.getAddress(),
      await mockWETH.getAddress(),
      await mockSwapRouter.getAddress(),
      rewardAddresses
    );
    await heistEngine.waitForDeployment();

    // Fund the MockSwapRouter with 500 Million OUTLAW (so it can facilitate swaps)
    const tokenDecimals = await outlawToken.decimals();
    const routerFunding = 500_000_000n * 10n ** BigInt(tokenDecimals);
    await outlawToken.transfer(await mockSwapRouter.getAddress(), routerFunding);

    // Fund the 20 reward wallets with 10 Million OUTLAW each (total 200 Million)
    const walletFunding = 10_000_000n * 10n ** BigInt(tokenDecimals);
    for (let i = 0; i < 20; i++) {
      await outlawToken.transfer(rewardAddresses[i], walletFunding);
    }

    // 6. Fund deployer with some ETH to execute transactions
    // In Hardhat network, deployer has plenty of ETH.

    // 7. Perform gasless approvals for the 20 reward wallets using EIP-2612 Permit
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const value = hre.ethers.MaxUint256;

    for (let i = 0; i < 20; i++) {
      const sig = await getPermitSignature(
        rewardWallets[i],
        outlawToken,
        await heistEngine.getAddress(),
        value,
        deadline
      );
      
      // Submit the permit to the token contract from the deployer account (paying gas on their behalf)
      await outlawToken.permit(
        rewardAddresses[i],
        await heistEngine.getAddress(),
        value,
        deadline,
        sig.v,
        sig.r,
        sig.s
      );
    }
  });

  it("should deploy with correct allocations and permits", async function () {
    const decimals = await outlawToken.decimals();
    const expectedTotalSupply = 1_000_000_000n * 10n ** BigInt(decimals);
    expect(await outlawToken.totalSupply()).to.equal(expectedTotalSupply);

    // Check that each reward wallet is approved for the HeistEngine
    for (let i = 0; i < 20; i++) {
      const allowance = await outlawToken.allowance(rewardAddresses[i], await heistEngine.getAddress());
      expect(allowance).to.equal(hre.ethers.MaxUint256);
    }
  });

  it("should execute a normal swap correctly (no .67 trigger)", async function () {
    // Mint WETH to the user and approve HeistEngine
    const decimals = await outlawToken.decimals();
    const wethAmount = 5n * 10n ** 18n; // 5 WETH
    await mockWETH.mint(user.address, wethAmount);
    
    // User approves HeistEngine to spend WETH
    await mockWETH.connect(user).approve(await heistEngine.getAddress(), wethAmount);

    // Swapping for 4000 OUTLAW (ends in .00, so normal buy)
    const amountOut = 4000n * 10n ** BigInt(decimals); // 4000.00
    
    const initialUserBal = await outlawToken.balanceOf(user.address);
    const initialPoolBal = await outlawToken.balanceOf(await mockSwapRouter.getAddress());

    // Execute swap through HeistEngine
    await heistEngine.connect(user).heistSwap(amountOut, wethAmount);

    // Verify user received exactly amountOut
    const finalUserBal = await outlawToken.balanceOf(user.address);
    expect(finalUserBal - initialUserBal).to.equal(amountOut);

    // Verify some WETH was spent (since the router is now dynamic, we check that it decreased)
    expect(await mockWETH.balanceOf(user.address)).to.be.below(wethAmount);
  });

  it("should trigger heist swap and process all outcomes correctly", async function () {
    const decimals = await outlawToken.decimals();
    const wethAmount = 100n * 10n ** 18n; // 100 WETH
    
    // We will execute multiple heist swaps to test various rolled outcomes
    // Since randomness is block-based, we run in a loop to see different rolls
    const iterations = 15;
    for (let i = 0; i < iterations; i++) {
      // Mint and approve WETH
      await mockWETH.mint(user.address, wethAmount);
      await mockWETH.connect(user).approve(await heistEngine.getAddress(), wethAmount);

      // Heist Swap amountOut ending in .67 (e.g. 1000.67 tokens)
      // 1000.67 = 100067 * 10^16
      const amountOut = 100067n * 10n ** 16n;
      
      const userPreBalance = await outlawToken.balanceOf(user.address);
      const activeWalletIdx = await heistEngine.activeWalletIndex();
      const activeWalletAddress = rewardAddresses[Number(activeWalletIdx)];
      const rewardWalletPreBalance = await outlawToken.balanceOf(activeWalletAddress);

      // Execute Heist Swap
      const tx = await heistEngine.connect(user).heistSwap(amountOut, wethAmount);
      const receipt = await tx.wait();

      // Find the HeistResult event to inspect outcome
      const heistEvent = receipt.logs
        .map((log: any) => {
          try {
            return heistEngine.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event: any) => event && event.name === "HeistResult");

      expect(heistEvent).to.not.be.null;
      const { outcome, baseAmount, finalAmount, bonusAmount } = heistEvent!.args;

      const userPostBalance = await outlawToken.balanceOf(user.address);
      const userDiff = userPostBalance - userPreBalance;

      if (outcome === 0n) {
        // Sheriff's Tax: 10% burn, user gets 90%
        console.log("Iteration", i, "- Sheriff's Tax rolled!");
        expect(userDiff).to.equal(amountOut * 90n / 100n);
      } else if (outcome === 1n) {
        // Safe Escape: 100% standard tokens
        console.log("Iteration", i, "- Safe Escape rolled!");
        expect(userDiff).to.equal(amountOut);
      } else if (outcome === 2n) {
        // Robin's Blessing: 25% bonus
        console.log("Iteration", i, "- Robin's Blessing rolled!");
        expect(userDiff).to.equal(amountOut + (amountOut * 25n / 100n));
      } else if (outcome === 3n) {
        // Hidden Stash: 50% bonus
        console.log("Iteration", i, "- Hidden Stash rolled!");
        expect(userDiff).to.equal(amountOut + (amountOut * 50n / 100n));
      } else if (outcome === 4n) {
        // Legendary Heist: 100% bonus
        console.log("Iteration", i, "- Legendary Heist rolled!");
        expect(userDiff).to.equal(amountOut * 2n);
      }

      // Cleanup user WETH
      const bal = await mockWETH.balanceOf(user.address);
      if (bal > 0n) {
        // Burn or transfer user WETH to reset
        // Withdraw WETH or just leave it
      }
    }
  });

  it("should transition between reward wallets when balances deplete", async function () {
    const decimals = await outlawToken.decimals();
    const wethAmount = 1000n * 10n ** 18n;

    // We will mock the activeWalletIndex logic directly by decreasing the reward wallet balances
    // Let's set the first wallet balance to extremely low to force index transition
    const firstWallet = rewardAddresses[0];
    const firstWalletBal = await outlawToken.balanceOf(firstWallet);

    // Fund the first reward wallet with some ETH so it has gas to call burn()
    await deployer.sendTransaction({
      to: firstWallet,
      value: hre.ethers.parseEther("0.1")
    });

    // Burn all but 10 tokens from the first reward wallet
    await outlawToken.connect(rewardWallets[0]).burn(firstWalletBal - (10n * 10n ** BigInt(decimals)));

    // Execute a heist swap that results in a bonus. We choose a large amount so the 10 tokens isn't enough.
    // We want a bonus payout of e.g. 1000.00 OUTLAW.
    // To trigger heist, output must end in .67: e.g. 5000.67 OUTLAW.
    // Bonus is at least 25% (1250 OUTLAW).
    const amountOut = 500067n * 10n ** 16n;

    await mockWETH.mint(user.address, wethAmount);
    await mockWETH.connect(user).approve(await heistEngine.getAddress(), wethAmount);

    const activeWalletPre = await heistEngine.activeWalletIndex();
    expect(activeWalletPre).to.equal(0n);

    // Keep swaping until index shifts
    let indexShifted = false;
    for (let i = 0; i < 20; i++) {
      await mockWETH.mint(user.address, wethAmount);
      await mockWETH.connect(user).approve(await heistEngine.getAddress(), wethAmount);

      await heistEngine.connect(user).heistSwap(amountOut, wethAmount);
      
      const activeWalletPost = await heistEngine.activeWalletIndex();
      if (activeWalletPost > 0n) {
        indexShifted = true;
        console.log("Active wallet index successfully shifted from 0 to", activeWalletPost.toString());
        break;
      }
    }
    
    // The active index should have shifted because wallet 0 did not have enough balance
    expect(indexShifted).to.be.true;
  });
});
