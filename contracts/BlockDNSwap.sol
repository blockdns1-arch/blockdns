// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BlockDNS Swap
/// @author BlockDNS
/// @notice Buys and sells BDNS against the chain's native token at an owner-managed rate.
/// @dev Intended for early liquidity before an AMM exists: quotes are linear at {ethPerBdn} with a
///      flat fee quoted in USD, and the contract holds an inventory of BDNS and native token, so it
///      is re-entrancy guarded and every payout is checked against the balance first. The fee is
///      priced off {bdnsUsdPrice}, which lets the owner retune the fee in dollar terms without
///      redeploying as the token price moves.
contract BlockDNSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Scale used for USD-denominated values (1e6 = $1.00).
    uint256 public constant USD_SCALE = 1e6;

    /// @notice BDNS token bought and sold by this contract.
    IERC20 public immutable bdns;

    /// @notice Address that receives the swap fee in BDNS.
    address public feeCollector;

    /// @notice Wei of native token paid per 1 BDNS (BDNS has 18 decimals).
    uint256 public ethPerBdn;

    /// @notice USD price of 1 BDNS, scaled by 1e6 (0.01 USD = 10000).
    uint256 public bdnsUsdPrice;

    /// @notice Flat swap fee in USD, scaled by 1e6 (0.05 USD = 50000).
    uint256 public swapFeeUsd;

    /// @notice The zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice A zero rate or zero USD price was supplied to {setRates}.
    error ZeroRate();

    /// @notice A zero swap fee was supplied where a positive one is required.
    error ZeroFee();

    /// @notice The contract does not hold enough BDNS or native token to fill the swap.
    error InsufficientLiquidity();

    /// @notice The swap amount is zero, below the fee, or would round to zero output.
    error InvalidAmount();

    /// @notice An intermediate multiplication overflowed.
    error Overflow();

    /// @notice Accepts native token sent directly to fund {swapBdnsToEth} payouts.
    receive() external payable {}

    /// @notice Emitted on ETH -> BDNS; `bdnsOut` is the net amount the user receives.
    event SwappedEthForBdns(address indexed user, uint256 ethIn, uint256 bdnsOut, uint256 fee);

    /// @notice Emitted on BDNS -> ETH; `ethOut` is the net amount the user receives.
    event SwappedBdnsForEth(address indexed user, uint256 bdnsIn, uint256 ethOut, uint256 fee);

    /// @notice Emitted when the rate or USD price changes.
    event RatesUpdated(uint256 ethPerBdn, uint256 bdnsUsdPrice);

    /// @notice Emitted when the USD swap fee changes.
    event SwapFeeUpdated(uint256 swapFeeUsd);

    /// @notice Emitted when the fee recipient changes.
    event FeeCollectorUpdated(address feeCollector);

    /// @param _bdns BDNS token address; must be non-zero.
    /// @param _feeCollector Initial fee recipient; must be non-zero.
    /// @param _ethPerBdn Wei of native token per BDNS; must be non-zero.
    /// @param _bdnsUsdPrice USD price of BDNS scaled by 1e6; must be non-zero.
    /// @param _swapFeeUsd Flat swap fee in USD scaled by 1e6.
    constructor(
        address _bdns,
        address _feeCollector,
        uint256 _ethPerBdn,
        uint256 _bdnsUsdPrice,
        uint256 _swapFeeUsd
    ) Ownable(msg.sender) {
        if (_bdns == address(0) || _feeCollector == address(0)) revert ZeroAddress();
        bdns = IERC20(_bdns);
        feeCollector = _feeCollector;
        _setRates(_ethPerBdn, _bdnsUsdPrice);
        _setSwapFeeUsd(_swapFeeUsd);
    }

    /// @notice Buys BDNS with the attached native token. The fee is taken in BDNS and sent to
    ///         {feeCollector}, so the user only needs to send ETH.
    function swapEthToBdns() external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        uint256 fee = swapFeeBdn();
        uint256 bdnsOut = _mulDiv(msg.value, 1e18, ethPerBdn);
        if (bdnsOut <= fee) revert InvalidAmount();
        uint256 userOut = bdnsOut - fee;
        if (bdns.balanceOf(address(this)) < bdnsOut) revert InsufficientLiquidity();
        bdns.safeTransfer(msg.sender, userOut);
        if (fee > 0) bdns.safeTransfer(feeCollector, fee);
        emit SwappedEthForBdns(msg.sender, msg.value, userOut, fee);
    }

    /// @notice Sells BDNS for native token. The fee is taken in BDNS and sent to {feeCollector}.
    /// @dev Caller must approve this contract for `amount` BDNS, and the contract must hold enough
    ///      native token to pay out. `amount` must exceed the fee.
    /// @param amount Gross BDNS amount to sell, fee included.
    function swapBdnsToEth(uint256 amount) external nonReentrant {
        uint256 fee = swapFeeBdn();
        if (amount <= fee) revert InvalidAmount();
        uint256 net = amount - fee;
        uint256 ethOut = _mulDiv(net, ethPerBdn, 1e18);
        if (ethOut == 0 || address(this).balance < ethOut) revert InsufficientLiquidity();
        bdns.safeTransferFrom(msg.sender, address(this), net);
        bdns.safeTransferFrom(msg.sender, feeCollector, fee);
        (bool ok, ) = payable(msg.sender).call{value: ethOut}("");
        if (!ok) revert InvalidAmount();
        emit SwappedBdnsForEth(msg.sender, amount, ethOut, fee);
    }

    /// @notice Current swap fee converted from USD into BDNS.
    /// @return Fee denominated in BDNS.
    function swapFeeBdn() public view returns (uint256) {
        return _mulDiv(swapFeeUsd, 1e18, bdnsUsdPrice);
    }

    /// @notice Quotes an ETH -> BDNS swap, net of the fee.
    /// @param ethIn Native token amount the user would send.
    /// @return BDNS the user would receive, or 0 when the input does not cover the fee.
    function previewEthToBdns(uint256 ethIn) external view returns (uint256) {
        return _mulDiv(ethIn, 1e18, ethPerBdn) > swapFeeBdn()
            ? _mulDiv(ethIn, 1e18, ethPerBdn) - swapFeeBdn()
            : 0;
    }

    /// @notice Quotes a BDNS -> ETH swap, net of the fee.
    /// @param bdnsIn Gross BDNS amount the user would sell.
    /// @return Native token the user would receive, or 0 when the input does not cover the fee.
    function previewBdnsToEth(uint256 bdnsIn) external view returns (uint256) {
        if (bdnsIn <= swapFeeBdn()) return 0;
        return _mulDiv(bdnsIn - swapFeeBdn(), ethPerBdn, 1e18);
    }

    /// @notice Updates the execution rate and the USD price used to price the fee.
    /// @param _ethPerBdn Wei of native token per BDNS; must be non-zero.
    /// @param _bdnsUsdPrice USD price of BDNS scaled by 1e6; must be non-zero.
    function setRates(uint256 _ethPerBdn, uint256 _bdnsUsdPrice) external onlyOwner {
        _setRates(_ethPerBdn, _bdnsUsdPrice);
    }

    /// @notice Updates the flat swap fee, quoted in USD scaled by 1e6.
    /// @param _swapFeeUsd New fee; 0 is allowed and disables the fee.
    function setSwapFeeUsd(uint256 _swapFeeUsd) external onlyOwner {
        _setSwapFeeUsd(_swapFeeUsd);
    }

    /// @notice Changes where the BDNS fee is sent.
    /// @param _feeCollector New fee recipient; must be non-zero.
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert ZeroAddress();
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    /// @dev Applies and announces the rate and USD price; both must stay non-zero.
    /// @param _ethPerBdn Wei of native token per BDNS.
    /// @param _bdnsUsdPrice USD price of BDNS scaled by 1e6.
    function _setRates(uint256 _ethPerBdn, uint256 _bdnsUsdPrice) internal {
        if (_ethPerBdn == 0 || _bdnsUsdPrice == 0) revert ZeroRate();
        ethPerBdn = _ethPerBdn;
        bdnsUsdPrice = _bdnsUsdPrice;
        emit RatesUpdated(_ethPerBdn, _bdnsUsdPrice);
    }

    /// @dev Applies and announces the USD-denominated swap fee.
    /// @param _swapFeeUsd Fee scaled by 1e6; 0 disables the fee.
    function _setSwapFeeUsd(uint256 _swapFeeUsd) internal {
        swapFeeUsd = _swapFeeUsd;
        emit SwapFeeUpdated(_swapFeeUsd);
    }

    /// @dev Fixed-point multiply-then-divide used by every quote.
    /// @dev Delegates to OpenZeppelin {Math-mulDiv}, which computes in 512-bit precision and reverts
    ///      with a clear error only when the result does not fit in 256 bits. That keeps quotes exact
    ///      for large inputs instead of overflowing on the intermediate `a * b`.
    /// @param a Multiplicand.
    /// @param b Multiplier.
    /// @param d Divisor.
    /// @return Result of `a * b / d` at full precision.
    function _mulDiv(uint256 a, uint256 b, uint256 d) internal pure returns (uint256) {
        if (a == 0 || b == 0) return 0;
        return Math.mulDiv(a, b, d);
    }
}