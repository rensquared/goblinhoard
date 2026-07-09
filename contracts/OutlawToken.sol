// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract OutlawToken is ERC20, ERC20Burnable, ERC20Permit {
    constructor() ERC20("Outlaw Capital", "OUTLAW") ERC20Permit("Outlaw Capital") {
        // Mint the entire fixed supply of 1 Billion tokens to the deployer
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }
}
