// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IPOCERC20,
    IPOCMorphoFlashLoanCallback,
    IPOCV2Router,
    MorphoV2ArbitragePOC
} from "../src/poc/MorphoV2ArbitragePOC.sol";

contract POCMockToken is IPOCERC20 {
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        require(approved >= amount, "allowance");
        allowance[from][msg.sender] = approved - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract POCMockMorpho {
    function flashLoan(address token, uint256 assets, bytes calldata data) external {
        uint256 balanceBefore = IPOCERC20(token).balanceOf(address(this));
        require(IPOCERC20(token).transfer(msg.sender, assets), "send");
        IPOCMorphoFlashLoanCallback(msg.sender).onMorphoFlashLoan(assets, data);
        require(POCMockToken(token).transferFrom(msg.sender, address(this), assets), "repay");
        require(IPOCERC20(token).balanceOf(address(this)) == balanceBefore, "principal");
    }
}

contract POCMockV2Router is IPOCV2Router {
    uint256 public immutable numerator;
    uint256 public immutable denominator;

    constructor(uint256 numerator_, uint256 denominator_) {
        numerator = numerator_;
        denominator = denominator_;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(path.length == 2 && path[0] != path[1], "path");
        require(block.timestamp <= deadline, "deadline");

        uint256 amountOut = amountIn * numerator / denominator;
        require(amountOut >= amountOutMin, "min-out");
        require(POCMockToken(path[0]).transferFrom(msg.sender, address(this), amountIn), "take-in");
        require(IPOCERC20(path[1]).transfer(to, amountOut), "send-out");

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }
}

contract MorphoV2ArbitragePOCTest {
    uint256 private constant UNIT = 1e18;
    address private constant PROFIT_RECEIVER = address(0xBEEF);

    function testProfitableRoundTripRepaysAndPaysProfit() external {
        (
            POCMockToken loanToken,
            POCMockToken intermediateToken,
            POCMockMorpho morpho,
            POCMockV2Router firstRouter,
            POCMockV2Router secondRouter,
            MorphoV2ArbitragePOC poc
        ) = _deployProfitableRoute();

        uint256 morphoBalanceBefore = loanToken.balanceOf(address(morpho));
        uint256 profit = poc.executeArbitrage(
            _params(
                address(loanToken), address(intermediateToken), address(firstRouter), address(secondRouter), 50 * UNIT
            )
        );

        require(profit == 100 * UNIT, "wrong profit");
        require(loanToken.balanceOf(PROFIT_RECEIVER) == 100 * UNIT, "profit not paid");
        require(loanToken.balanceOf(address(morpho)) == morphoBalanceBefore, "Morpho not repaid");
        require(loanToken.balanceOf(address(poc)) == 0, "loan-token dust");
        require(intermediateToken.balanceOf(address(poc)) == 0, "intermediate dust");
    }

    function testRevertsWhenMinimumProfitIsNotMet() external {
        (
            POCMockToken loanToken,
            POCMockToken intermediateToken,
            POCMockMorpho morpho,
            POCMockV2Router firstRouter,
            POCMockV2Router secondRouter,
            MorphoV2ArbitragePOC poc
        ) = _deployProfitableRoute();

        uint256 morphoBalanceBefore = loanToken.balanceOf(address(morpho));
        MorphoV2ArbitragePOC.ArbitrageParams memory params = _params(
            address(loanToken), address(intermediateToken), address(firstRouter), address(secondRouter), 101 * UNIT
        );

        (bool ok,) = address(poc).call(abi.encodeCall(poc.executeArbitrage, (params)));
        require(!ok, "unprofitable route accepted");
        require(loanToken.balanceOf(address(morpho)) == morphoBalanceBefore, "state not reverted");
        require(loanToken.balanceOf(PROFIT_RECEIVER) == 0, "profit paid on revert");
    }

    function testRejectsRouterOutsideAllowlist() external {
        (
            POCMockToken loanToken,
            POCMockToken intermediateToken,,
            POCMockV2Router firstRouter,
            POCMockV2Router secondRouter,
            MorphoV2ArbitragePOC poc
        ) = _deployProfitableRoute();

        poc.setRouterAllowed(address(secondRouter), false);
        MorphoV2ArbitragePOC.ArbitrageParams memory params =
            _params(address(loanToken), address(intermediateToken), address(firstRouter), address(secondRouter), 1);
        (bool ok,) = address(poc).call(abi.encodeCall(poc.executeArbitrage, (params)));
        require(!ok, "unallowed router accepted");
    }

    function testRejectsFakeCallback() external {
        (,,,,, MorphoV2ArbitragePOC poc) = _deployProfitableRoute();
        (bool ok,) =
            address(poc).call(abi.encodeWithSelector(poc.onMorphoFlashLoan.selector, 1_000 * UNIT, bytes("fake")));
        require(!ok, "fake callback accepted");
    }

    function _deployProfitableRoute()
        private
        returns (
            POCMockToken loanToken,
            POCMockToken intermediateToken,
            POCMockMorpho morpho,
            POCMockV2Router firstRouter,
            POCMockV2Router secondRouter,
            MorphoV2ArbitragePOC poc
        )
    {
        loanToken = new POCMockToken();
        intermediateToken = new POCMockToken();
        morpho = new POCMockMorpho();

        // 1,000 loan tokens -> 2,000 intermediate -> 1,100 loan tokens.
        firstRouter = new POCMockV2Router(2, 1);
        secondRouter = new POCMockV2Router(55, 100);

        loanToken.mint(address(morpho), 10_000 * UNIT);
        intermediateToken.mint(address(firstRouter), 20_000 * UNIT);
        loanToken.mint(address(secondRouter), 20_000 * UNIT);

        address[] memory tokens = new address[](2);
        tokens[0] = address(loanToken);
        tokens[1] = address(intermediateToken);
        address[] memory routers = new address[](2);
        routers[0] = address(firstRouter);
        routers[1] = address(secondRouter);
        poc = new MorphoV2ArbitragePOC(address(morpho), tokens, routers);
    }

    function _params(
        address loanToken,
        address intermediateToken,
        address firstRouter,
        address secondRouter,
        uint256 minProfit
    ) private pure returns (MorphoV2ArbitragePOC.ArbitrageParams memory params) {
        params = MorphoV2ArbitragePOC.ArbitrageParams({
            loanToken: loanToken,
            intermediateToken: intermediateToken,
            firstRouter: firstRouter,
            secondRouter: secondRouter,
            loanAmount: 1_000 * UNIT,
            minIntermediateAmount: 1_900 * UNIT,
            minFinalAmount: 1_050 * UNIT,
            minProfit: minProfit,
            deadline: type(uint256).max,
            profitReceiver: PROFIT_RECEIVER
        });
    }
}
