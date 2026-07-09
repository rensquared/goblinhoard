// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ISwapRouter {
    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }
    function exactOutputSingle(ExactOutputSingleParams calldata params) external returns (uint256 amountIn);
}

interface IOutlawToken is IERC20 {
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

contract HeistEngine is Ownable {
    address public immutable outlawToken;
    address public immutable weth;
    address public immutable swapRouter;
    uint24 public constant poolFee = 10000; // 1%

    address[] public rewardWallets;
    uint256 public activeWalletIndex;

    event SwapExecuted(address indexed user, uint256 amountIn, uint256 amountOut, bool isHeist);
    event HeistResult(address indexed user, uint256 outcome, uint256 baseAmount, uint256 finalAmount, uint256 bonusAmount);

    constructor(
        address _outlawToken,
        address _weth,
        address _swapRouter,
        address[] memory _rewardWallets
    ) Ownable(msg.sender) {
        outlawToken = _outlawToken;
        weth = _weth;
        swapRouter = _swapRouter;
        rewardWallets = _rewardWallets;
    }

    function updateRewardWallets(address[] calldata _rewardWallets) external onlyOwner {
        rewardWallets = _rewardWallets;
        activeWalletIndex = 0;
    }

    function getRewardWalletsCount() external view returns (uint256) {
        return rewardWallets.length;
    }

    function heistSwap(uint256 amountOut, uint256 maxAmountIn) external returns (uint256 amountInUsed) {
        // 1. Check if the output amount ends in .67 (e.g. 100.67 tokens)
        // Decimals are 18, so .67 is 67 * 10^16
        bool isHeist = (amountOut / 10**16) % 100 == 67;

        // 2. Transfer WETH from caller to this contract
        IERC20(weth).transferFrom(msg.sender, address(this), maxAmountIn);
        IERC20(weth).approve(swapRouter, maxAmountIn);

        // 3. Execute exact output swap WETH -> OUTLAW
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: weth,
            tokenOut: outlawToken,
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountOut: amountOut,
            amountInMaximum: maxAmountIn,
            sqrtPriceLimitX96: 0
        });

        // Swap returns the actual WETH spent
        amountInUsed = ISwapRouter(swapRouter).exactOutputSingle(params);

        // Refund any unused WETH back to the user
        if (maxAmountIn > amountInUsed) {
            IERC20(weth).transfer(msg.sender, maxAmountIn - amountInUsed);
        }

        emit SwapExecuted(msg.sender, amountInUsed, amountOut, isHeist);

        // 4. Resolve Heist if active
        if (isHeist) {
            // Roll dice: 0 to 99
            uint256 roll = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                block.number
            ))) % 100;

            if (roll < 30) {
                // Sheriff's Tax (30% chance): 10% Burn
                uint256 burnAmount = amountOut * 10 / 100;
                uint256 netAmount = amountOut - burnAmount;
                IOutlawToken(outlawToken).burn(burnAmount);
                IERC20(outlawToken).transfer(msg.sender, netAmount);
                emit HeistResult(msg.sender, 0, amountOut, netAmount, 0);
            } else if (roll < 70) {
                // Safe Escape (40% chance): 100% standard tokens
                IERC20(outlawToken).transfer(msg.sender, amountOut);
                emit HeistResult(msg.sender, 1, amountOut, amountOut, 0);
            } else if (roll < 90) {
                // Robin's Blessing (20% chance): +25% bonus
                uint256 bonusAmount = amountOut * 25 / 100;
                IERC20(outlawToken).transfer(msg.sender, amountOut);
                _payBonus(msg.sender, bonusAmount);
                emit HeistResult(msg.sender, 2, amountOut, amountOut + bonusAmount, bonusAmount);
            } else if (roll < 98) {
                // Hidden Stash (8% chance): +50% bonus
                uint256 bonusAmount = amountOut * 50 / 100;
                IERC20(outlawToken).transfer(msg.sender, amountOut);
                _payBonus(msg.sender, bonusAmount);
                emit HeistResult(msg.sender, 3, amountOut, amountOut + bonusAmount, bonusAmount);
            } else {
                // Legendary Heist (2% chance): +100% bonus
                uint256 bonusAmount = amountOut;
                IERC20(outlawToken).transfer(msg.sender, amountOut);
                _payBonus(msg.sender, bonusAmount);
                emit HeistResult(msg.sender, 4, amountOut, amountOut + bonusAmount, bonusAmount);
            }
        } else {
            // Normal Buy: just transfer 100% of tokens to user
            IERC20(outlawToken).transfer(msg.sender, amountOut);
        }
    }

    function _payBonus(address user, uint256 amount) internal {
        if (rewardWallets.length == 0) return;
        
        uint256 startIndex = activeWalletIndex;
        uint256 index = startIndex;
        
        while (true) {
            address wallet = rewardWallets[index];
            uint256 bal = IERC20(outlawToken).balanceOf(wallet);
            uint256 allowance = IERC20(outlawToken).allowance(wallet, address(this));
            
            uint256 spendable = bal < allowance ? bal : allowance;
            if (spendable >= amount) {
                activeWalletIndex = index;
                IERC20(outlawToken).transferFrom(wallet, user, amount);
                return;
            }
            
            index = (index + 1) % rewardWallets.length;
            if (index == startIndex) {
                address activeWallet = rewardWallets[activeWalletIndex];
                uint256 activeBal = IERC20(outlawToken).balanceOf(activeWallet);
                uint256 activeAllowance = IERC20(outlawToken).allowance(activeWallet, address(this));
                uint256 activeSpendable = activeBal < activeAllowance ? activeBal : activeAllowance;
                if (activeSpendable > 0) {
                    IERC20(outlawToken).transferFrom(activeWallet, user, activeSpendable);
                }
                return;
            }
        }
    }
}
