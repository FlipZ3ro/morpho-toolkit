// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal swap ABIs for the adapters planned around MorphoAtomicArbPOC.
/// @dev These interfaces do not make a router safe. The adapter must still validate
///      router, selector, tokens, recipient, amount, slippage and deadline.

interface IDexV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

/// @notice Uniswap V3 SwapRouter and Sushi V3 SwapRouter ABI (deadline in each struct).
interface IDexV3SwapRouterLegacy {
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

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

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

    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn);
    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn);
}

/// @notice Uniswap SwapRouter02 V3 ABI (deadline is not part of these structs).
interface IDexV3SwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactOutputParams {
        bytes path;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn);
    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn);
}

interface IDexUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface ISushiRedSnwapper {
    function snwap(
        address tokenIn,
        uint256 amountIn,
        address recipient,
        address tokenOut,
        uint256 amountOutMin,
        address executor,
        bytes calldata executorData
    ) external payable returns (uint256 amountOut);
}

/// @notice Aerodrome and current Velodrome router ABI.
interface IDexAeroRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, Route[] calldata routes) external view returns (uint256[] memory amounts);
}

interface IDexBalancerV2Vault {
    enum SwapKind {
        GIVEN_IN,
        GIVEN_OUT
    }

    struct SingleSwap {
        bytes32 poolId;
        SwapKind kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }

    struct BatchSwapStep {
        bytes32 poolId;
        uint256 assetInIndex;
        uint256 assetOutIndex;
        uint256 amount;
        bytes userData;
    }

    function swap(SingleSwap calldata singleSwap, FundManagement calldata funds, uint256 limit, uint256 deadline)
        external
        payable
        returns (uint256 amountCalculated);

    function batchSwap(
        SwapKind kind,
        BatchSwapStep[] calldata swaps,
        address[] calldata assets,
        FundManagement calldata funds,
        int256[] calldata limits,
        uint256 deadline
    ) external payable returns (int256[] memory assetDeltas);
}

interface IDexCurveRouterNg {
    function exchange(
        address[11] calldata route,
        uint256[5][5] calldata swapParams,
        uint256 amount,
        uint256 minDy,
        address[5] calldata pools,
        address receiver
    ) external payable returns (uint256 amountOut);

    function get_dy(
        address[11] calldata route,
        uint256[5][5] calldata swapParams,
        uint256 amount,
        address[5] calldata pools
    ) external view returns (uint256 amountOut);
}

interface IDexCurveStablePool {
    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external payable;
    function exchange_underlying(int128 i, int128 j, uint256 dx, uint256 minDy) external payable;
}

interface IDexCurveCryptoPool {
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy) external payable;
    function exchange_underlying(uint256 i, uint256 j, uint256 dx, uint256 minDy) external payable;
}
