// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ILaunchDeployer {
    struct FeeConfig {
        address recipient;
        uint16 feeBps;
        uint16 burnBps;
        uint16 creatorTaxBps;
        uint16 referralTaxBps;
    }

    struct Socials {
        string website;
        string twitter;
        string telegram;
        string discord;
        string other;
    }

    struct LaunchParams {
        address tokenImplementation;
        address curveImplementation;
        address feeEscrow;
        address launchpadFactory;
        FeeConfig fees;
        address creator;
        address referrer;
        uint256 totalSupply;
        uint256 initialCurveSupply;
        uint256 graduationThreshold;
        bool buybackEnabled;
        uint256 minBuy;
        uint256 maxBuy;
        bytes32 salt;
        string name;
        string symbol;
        string uri;
        string description;
        Socials socials;
    }

    function predictLaunchAddresses(LaunchParams memory params) external view returns (address token, address curve);
}

contract PonsVanityMiner {
    ILaunchDeployer public immutable deployer;

    constructor(address _deployer) {
        deployer = ILaunchDeployer(_deployer);
    }

    function mineVanity(
        ILaunchDeployer.LaunchParams memory params,
        bytes2 targetPrefix,
        uint256 iterations,
        uint256 seed
    ) external view returns (bool found, bytes32 salt, address predictedToken) {
        for (uint256 i = 0; i < iterations; i++) {
            bytes32 testSalt = keccak256(abi.encodePacked(seed, i));
            params.salt = testSalt;
            (address token, ) = deployer.predictLaunchAddresses(params);
            bytes2 prefix = bytes2(bytes20(token));
            if (prefix == targetPrefix) {
                return (true, testSalt, token);
            }
        }
        return (false, bytes32(0), address(0));
    }
}
