// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSwapRouter {
    address public outlawToken;
    address public weth;

    // Reserves simulating Uniswap pool state
    uint256 public wethReserve;
    uint256 public outlawReserve;
    uint256 public constant k_scale = 1e18; // to handle precision

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

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    constructor(address _outlawToken, address _weth) {
        outlawToken = _outlawToken;
        weth = _weth;
        // Initialize reserves simulating WETH/OUTLAW pool
        // WETH: 0.018 WETH
        wethReserve = 18 * 1e15; // 0.018 WETH
        // OUTLAW: 700 Million tokens
        outlawReserve = 700_000_000 * 1e18; 
    }

    // Swaps OUTLAW -> WETH or WETH -> OUTLAW based on Exact Input
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        if (params.tokenIn == weth && params.tokenOut == outlawToken) {
            // User buys OUTLAW with WETH
            // x * y = k
            // (wethReserve + amountIn) * (outlawReserve - amountOut) = wethReserve * outlawReserve
            uint256 k = wethReserve * outlawReserve;
            uint256 newWethReserve = wethReserve + params.amountIn;
            uint256 newOutlawReserve = k / newWethReserve;
            amountOut = outlawReserve - newOutlawReserve;

            require(amountOut >= params.amountOutMinimum, "Slippage too high");

            // Execute transfers
            IERC20(weth).transferFrom(msg.sender, address(this), params.amountIn);
            IERC20(outlawToken).transfer(params.recipient, amountOut);

            // Update reserves
            wethReserve = newWethReserve;
            outlawReserve = newOutlawReserve;
        } else if (params.tokenIn == outlawToken && params.tokenOut == weth) {
            // User sells OUTLAW for WETH
            // (outlawReserve + amountIn) * (wethReserve - amountOut) = outlawReserve * wethReserve
            uint256 k = outlawReserve * wethReserve;
            uint256 newOutlawReserve = outlawReserve + params.amountIn;
            uint256 newWethReserve = k / newOutlawReserve;
            amountOut = wethReserve - newWethReserve;

            require(amountOut >= params.amountOutMinimum, "Slippage too high");

            // Execute transfers
            IERC20(outlawToken).transferFrom(msg.sender, address(this), params.amountIn);
            IERC20(weth).transfer(params.recipient, amountOut);

            // Update reserves
            wethReserve = newWethReserve;
            outlawReserve = newOutlawReserve;
        }
    }

    // Swaps WETH -> OUTLAW based on Exact Output
    function exactOutputSingle(ExactOutputSingleParams calldata params) external returns (uint256 amountIn) {
        require(params.tokenIn == weth && params.tokenOut == outlawToken, "Unsupported pair");

        // User wants exactly amountOut of OUTLAW
        // (wethReserve + amountIn) * (outlawReserve - amountOut) = wethReserve * outlawReserve
        uint256 k = wethReserve * outlawReserve;
        uint256 newOutlawReserve = outlawReserve - params.amountOut;
        uint256 newWethReserve = k / newOutlawReserve;
        amountIn = newWethReserve - wethReserve;

        require(amountIn <= params.amountInMaximum, "Excessive input WETH required");

        // Execute transfers
        IERC20(weth).transferFrom(msg.sender, address(this), amountIn);
        IERC20(outlawToken).transfer(params.recipient, params.amountOut);

        // Update reserves
        wethReserve = newWethReserve;
        outlawReserve = newOutlawReserve;
    }

    // Helper to get current price (how many OUTLAW tokens for 1 WETH)
    function getCurrentPrice() external view returns (uint256) {
        return (outlawReserve * 1e18) / wethReserve;
    }
}
