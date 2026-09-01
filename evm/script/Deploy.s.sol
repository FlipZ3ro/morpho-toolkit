// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FlashLoanExecutor} from "../src/FlashLoanExecutor.sol";

interface Vm {
    function envAddress(string calldata) external returns (address);
    function envAddress(string calldata, string calldata) external returns (address[] memory);
    function envOr(string calldata, address) external returns (address);
    function envExists(string calldata) external returns (bool);
    function envUint(string calldata) external returns (uint256);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
}

/// Deploy the same executor bytecode to one chain at a time.
/// Required env: MORPHO_ADDRESS, TOKEN_ADDRESS, PRIVATE_KEY.
/// Preferred token env: TOKEN_ADDRESSES as a comma-separated list of any length.
/// Legacy fallback: TOKEN_ADDRESS plus optional TOKEN_ADDRESS_2/TOKEN_ADDRESS_3.
contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (FlashLoanExecutor executor) {
        address morpho = vm.envAddress("MORPHO_ADDRESS");
        uint256 key = vm.envUint("PRIVATE_KEY");
        require(morpho != address(0), "missing provider");
        address[] memory tokens;
        if (vm.envExists("TOKEN_ADDRESSES")) {
            tokens = vm.envAddress("TOKEN_ADDRESSES", ",");
        } else {
            address token = vm.envAddress("TOKEN_ADDRESS");
            address token2 = vm.envOr("TOKEN_ADDRESS_2", address(0));
            address token3 = vm.envOr("TOKEN_ADDRESS_3", address(0));
            uint256 tokenCount = 1;
            if (token2 != address(0)) tokenCount++;
            if (token3 != address(0)) tokenCount++;
            tokens = new address[](tokenCount);
            tokens[0] = token;
            if (token2 != address(0)) tokens[1] = token2;
            if (token3 != address(0)) tokens[tokenCount - 1] = token3;
        }
        require(tokens.length != 0, "missing token allowlist");
        vm.startBroadcast(key);
        executor = new FlashLoanExecutor(morpho, tokens);
        vm.stopBroadcast();
    }
}
