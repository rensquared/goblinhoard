// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract OutlawToken is ERC20, ERC20Burnable, ERC20Permit {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {
        // Mint the entire fixed supply of 1 Billion tokens to the deployer
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }
}
