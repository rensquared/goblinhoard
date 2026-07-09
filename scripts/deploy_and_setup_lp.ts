import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

// EIP-2612 Permit Signing Helper
async function getPermitSignature(
  wallet: ethers.Wallet,
  tokenAddress: string,
  tokenName: string,
  spenderAddress: string,
  value: bigint,
  deadline: number,
  chainId: number
): Promise<ethers.Signature> {
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

  // We query the nonce from the contract
  const tokenContract = await hre.ethers.getContractAt("OutlawToken", tokenAddress);
  const nonce = await tokenContract.nonces(wallet.address);

  const message = {
    owner: wallet.address,
    spender: spenderAddress,
    value: value,
    nonce: nonce,
    deadline: deadline,
  };

  const sigString = await wallet.signTypedData(domain, types, message);
  return ethers.Signature.from(sigString);
}

function getSqrtPriceX96ForTick(tick: number): bigint {
  const ratio = Math.pow(1.0001, tick / 2);
  const q96 = BigInt(2) ** BigInt(96);
  const ratioFixed = Math.floor(ratio * 1_000_000_000);
  return (BigInt(ratioFixed) * q96) / BigInt(1_000_000_000);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = Number(hre.network.config.chainId || 4663);
  console.log(`Deploying on chain ID: ${chainId} from account: ${deployer.address}`);

  // 1. Read wallets.json
  const walletsPath = path.resolve("./wallets.json");
  if (!fs.existsSync(walletsPath)) {
    throw new Error("wallets.json not found! Run generate_wallets.ts first.");
  }
  const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf8"));
  
  const rewardAddresses = wallets.reward.map((w: any) => w.address);
  const founderAddresses = wallets.founder.map((w: any) => w.address);

  // 2. Deploy OutlawToken
  console.log("Deploying OutlawToken...");
  const OutlawToken = await hre.ethers.getContractFactory("OutlawToken");
  const token = await OutlawToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`OutlawToken deployed at: ${tokenAddress}`);

  // Uniswap V3 contract addresses on Robinhood Chain
  const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
  const NFPM = "0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3";
  const FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA";
  const ROUTER = "0xCaf681a66D020601342297493863E78C959E5cb2";

  // 3. Deploy HeistEngine
  console.log("Deploying HeistEngine...");
  const HeistEngine = await hre.ethers.getContractFactory("HeistEngine");
  const engine = await HeistEngine.deploy(tokenAddress, WETH, ROUTER, rewardAddresses);
  await engine.waitForDeployment();
  const engineAddress = await engine.getAddress();
  console.log(`HeistEngine deployed at: ${engineAddress}`);

  // 4. Distribute OUTLAW tokens to 20 reward wallets (10M each) and 10 founder wallets (10M each)
  console.log("Distributing OUTLAW supply to reward and founder wallets...");
  const decimals = await token.decimals();
  const distributeAmount = 10_000_000n * 10n ** BigInt(decimals);

  // Send to 20 reward wallets
  for (let i = 0; i < 20; i++) {
    const tx = await token.transfer(rewardAddresses[i], distributeAmount);
    await tx.wait();
    console.log(`  Sent 10M OUTLAW to reward wallet ${i + 1}: ${rewardAddresses[i]}`);
  }

  // Send to 10 founder wallets
  for (let i = 0; i < 10; i++) {
    const tx = await token.transfer(founderAddresses[i], distributeAmount);
    await tx.wait();
    console.log(`  Sent 10M OUTLAW to founder wallet ${i + 1}: ${founderAddresses[i]}`);
  }



  // 6. Submit permits offline for the 20 reward wallets to authorize the HeistEngine
  console.log("Signing and submitting EIP-2612 Permits for reward wallets...");
  const deadline = Math.floor(Date.now() / 1000) + 31536000; // 1 year expiry
  const maxAllowance = hre.ethers.MaxUint256;
  const tokenName = await token.name();

  for (let i = 0; i < 20; i++) {
    const walletData = wallets.reward[i];
    const wallet = new hre.ethers.Wallet(walletData.privateKey, hre.ethers.provider);
    
    const sig = await getPermitSignature(
      wallet,
      tokenAddress,
      tokenName,
      engineAddress,
      maxAllowance,
      deadline,
      chainId
    );

    // Deployer account broadcasts the permit transactions gaslessly on behalf of the wallets
    const tx = await token.permit(
      wallet.address,
      engineAddress,
      maxAllowance,
      deadline,
      sig.v,
      sig.r,
      sig.s
    );
    await tx.wait();
    console.log(`  Permit submitted for reward wallet ${i + 1}: ${wallet.address}`);
  }

  // 7. Create & Initialize Uniswap V3 Pool
  console.log("Creating and initializing Uniswap V3 Pool...");
  const factoryContract = await hre.ethers.getContractAt(
    ["function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)"],
    FACTORY
  );

  // Sort tokens to determine token0 and token1
  const [token0, token1] = tokenAddress.toLowerCase() < WETH.toLowerCase()
    ? [tokenAddress, WETH]
    : [WETH, tokenAddress];
  const isOutlawToken0 = tokenAddress.toLowerCase() < WETH.toLowerCase();

  let tickLower: number;
  let tickUpper: number;
  let initialPriceTick: number;

  if (isOutlawToken0) {
    // OUTLAW is token0
    // Price = WETH/OUTLAW. Target price = 1.148e-9 WETH per OUTLAW.
    // tick = ln(1.148e-9) / ln(1.0001) = -205862. Rounded to spacing = -205800.
    initialPriceTick = -205800;
    // LP position range is ABOVE the starting price tick, close to it
    tickLower = -205600;
    tickUpper = -201800;
  } else {
    // OUTLAW is token1
    // Price = OUTLAW/WETH. Target price = 871,080,139 OUTLAW per WETH.
    // tick = ln(871.08M) / ln(1.0001) = 205862. Rounded to spacing = 205800.
    initialPriceTick = 205800;
    // LP position range is BELOW the starting price tick, close to it
    tickLower = 201800;
    tickUpper = 205600;
  }

  // Check if pool already exists
  const factoryObj = await hre.ethers.getContractAt(
    ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"],
    FACTORY
  );
  let poolAddress = await factoryObj.getPool(tokenAddress, WETH, 10000);
  
  if (poolAddress === hre.ethers.ZeroAddress) {
    const createTx = await factoryContract.createPool(tokenAddress, WETH, 10000);
    const receipt = await createTx.wait();
    // Fetch pool address from logs or view
    poolAddress = await factoryObj.getPool(tokenAddress, WETH, 10000);
  }
  console.log(`Uniswap V3 Pool Address: ${poolAddress}`);



  // Initialize pool price
  const poolContract = await hre.ethers.getContractAt(
    [
      "function initialize(uint160 sqrtPriceX96) external",
      "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
    ],
    poolAddress
  );

  let initialized = false;
  try {
    const slot0 = await poolContract.slot0();
    if (slot0.sqrtPriceX96 > 0n) {
      initialized = true;
    }
  } catch {}

  if (!initialized) {
    const sqrtPriceX96 = getSqrtPriceX96ForTick(initialPriceTick);
    const initTx = await poolContract.initialize(sqrtPriceX96);
    await initTx.wait();
    console.log(`Pool initialized at tick: ${initialPriceTick}`);
  } else {
    console.log("Pool already initialized.");
  }

  // 8. Deposit 700 Million OUTLAW tokens into the pool (LP) via NonfungiblePositionManager
  console.log("Depositing OUTLAW tokens into LP (Uniswap V3 Positions)...");
  const lpSupply = 700_000_000n * 10n ** BigInt(decimals);
  
  // Approve position manager
  const approveTx = await token.approve(NFPM, lpSupply);
  await approveTx.wait();

  const nfpmContract = await hre.ethers.getContractAt(
    [
      "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) calldata params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
    ],
    NFPM
  );

  const mintParams = {
    token0: token0,
    token1: token1,
    fee: 10000,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: isOutlawToken0 ? lpSupply : 0n,
    amount1Desired: isOutlawToken0 ? 0n : lpSupply,
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: founderAddresses[0], // LP NFT minted directly to founder wallet 1
    deadline: Math.floor(Date.now() / 1000) + 3600
  };

  const mintTx = await nfpmContract.mint(mintParams);
  const mintReceipt = await mintTx.wait();
  console.log(`LP minted and NFT sent directly to Founder Wallet 1: ${founderAddresses[0]}`);

  console.log("Deployment and setup complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
