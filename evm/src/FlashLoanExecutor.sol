// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
}

interface IMorpho {
    function flashLoan(address token, uint256 assets, bytes calldata data) external;
}

interface IMorphoFlashLoanCallback {
    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external;
}

/// @notice Minimal, zero-protocol-fee Morpho flash-loan executor.
/// @dev Deploy the same bytecode on each EVM chain with a chain-local Morpho address.
///      This contract intentionally has no DEX or arbitrary-call execution path yet.
contract FlashLoanExecutor is IMorphoFlashLoanCallback {
    error Unauthorized();
    error Paused();
    error ProviderNotAllowed();
    error TokenNotAllowed();
    error InvalidProvider();
    error InvalidAmount();
    error RepaymentInvariant();
    error TokenTransferFailed();
    error TokenApprovalFailed();

    address public immutable owner;
    address public immutable morpho;
    bool public paused;
    bool private loanActive;
    address private activeToken;
    uint256 private activeAssets;
    mapping(address token => bool allowed) public allowedToken;

    event FlashLoanExecuted(address indexed token, uint256 assets);
    event TokenAllowanceUpdated(address indexed token, bool allowed);
    event PauseUpdated(bool paused);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address morpho_, address[] memory initialTokens) {
        if (morpho_ == address(0)) revert InvalidProvider();
        owner = msg.sender;
        morpho = morpho_;
        for (uint256 i; i < initialTokens.length; ++i) {
            if (initialTokens[i] == address(0)) revert TokenNotAllowed();
            allowedToken[initialTokens[i]] = true;
            emit TokenAllowanceUpdated(initialTokens[i], true);
        }
    }

    /// @notice Borrow and immediately execute the callback with no custom venue logic.
    function flashLoan(address token, uint256 assets) external onlyOwner {
        if (paused) revert Paused();
        if (!allowedToken[token]) revert TokenNotAllowed();
        if (assets == 0) revert InvalidAmount();
        if (loanActive) revert RepaymentInvariant();
        loanActive = true;
        activeToken = token;
        activeAssets = assets;
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IMorpho(morpho).flashLoan(token, assets, abi.encode(token, assets));
        if (loanActive) revert RepaymentInvariant();
        if (IERC20(token).balanceOf(address(this)) != balanceBefore) revert RepaymentInvariant();
    }

    /// @inheritdoc IMorphoFlashLoanCallback
    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external {
        if (msg.sender != morpho) revert ProviderNotAllowed();
        (address token, uint256 expectedAssets) = abi.decode(data, (address, uint256));
        if (!loanActive || token != activeToken || assets != activeAssets) revert RepaymentInvariant();
        if (!allowedToken[token] || expectedAssets != assets) revert RepaymentInvariant();

        // Reserved callback slot. No DEX or arbitrary external calls are performed.
        if (IERC20(token).balanceOf(address(this)) < assets) revert RepaymentInvariant();
        // Morpho pulls the exact principal after this callback returns.
        if (!IERC20(token).approve(morpho, assets)) revert TokenApprovalFailed();
        loanActive = false;
        activeToken = address(0);
        activeAssets = 0;
        emit FlashLoanExecuted(token, assets);
    }

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert TokenNotAllowed();
        allowedToken[token] = allowed;
        emit TokenAllowanceUpdated(token, allowed);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseUpdated(value);
    }

    /// @dev Recover tokens accidentally sent to the executor; owner-only and never called by callback.
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0) || !IERC20(token).transfer(to, amount)) revert TokenTransferFailed();
    }
}
