// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BlockDNSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant USD_SCALE = 1e6;

    IERC20 public immutable bdns;
    address public feeCollector;

    // wei of native token paid per 1 BDNS (18-decimals BDNS = 1e18 wei)
    uint256 public ethPerBdn;
    // USD price of 1 BDNS, scaled by 1e6 (e.g. 0.01 USD -> 10000)
    uint256 public bdnsUsdPrice;
    // flat swap fee in USD, scaled by 1e6 (0.05 USD -> 50000)
    uint256 public swapFeeUsd;

    error ZeroAddress();
    error ZeroRate();
    error ZeroFee();
    error InsufficientLiquidity();
    error InvalidAmount();
    error Overflow();

    receive() external payable {}

    event SwappedEthForBdns(address indexed user, uint256 ethIn, uint256 bdnsOut, uint256 fee);
    event SwappedBdnsForEth(address indexed user, uint256 bdnsIn, uint256 ethOut, uint256 fee);
    event RatesUpdated(uint256 ethPerBdn, uint256 bdnsUsdPrice);
    event SwapFeeUpdated(uint256 swapFeeUsd);
    event FeeCollectorUpdated(address feeCollector);

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

    /// Buy BDNS with native ETH. Fee is deducted in BDNS and sent to the owner.
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

    /// Sell BDNS for native ETH. Fee is charged flat and sent to the owner.
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

    /// Current swap fee expressed in BDNS (derived from the USD price).
    function swapFeeBdn() public view returns (uint256) {
        return _mulDiv(swapFeeUsd, 1e18, bdnsUsdPrice);
    }

    /// Preview how many BDNS a user receives for `ethIn` (after fee).
    function previewEthToBdns(uint256 ethIn) external view returns (uint256) {
        return _mulDiv(ethIn, 1e18, ethPerBdn) > swapFeeBdn()
            ? _mulDiv(ethIn, 1e18, ethPerBdn) - swapFeeBdn()
            : 0;
    }

    /// Preview how much ETH a user receives for `bdnsIn` (after fee).
    function previewBdnsToEth(uint256 bdnsIn) external view returns (uint256) {
        if (bdnsIn <= swapFeeBdn()) return 0;
        return _mulDiv(bdnsIn - swapFeeBdn(), ethPerBdn, 1e18);
    }

    function setRates(uint256 _ethPerBdn, uint256 _bdnsUsdPrice) external onlyOwner {
        _setRates(_ethPerBdn, _bdnsUsdPrice);
    }

    function setSwapFeeUsd(uint256 _swapFeeUsd) external onlyOwner {
        _setSwapFeeUsd(_swapFeeUsd);
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert ZeroAddress();
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    function _setRates(uint256 _ethPerBdn, uint256 _bdnsUsdPrice) internal {
        if (_ethPerBdn == 0 || _bdnsUsdPrice == 0) revert ZeroRate();
        ethPerBdn = _ethPerBdn;
        bdnsUsdPrice = _bdnsUsdPrice;
        emit RatesUpdated(_ethPerBdn, _bdnsUsdPrice);
    }

    function _setSwapFeeUsd(uint256 _swapFeeUsd) internal {
        swapFeeUsd = _swapFeeUsd;
        emit SwapFeeUpdated(_swapFeeUsd);
    }

    function _mulDiv(uint256 a, uint256 b, uint256 d) internal pure returns (uint256) {
        if (a == 0 || b == 0) return 0;
        return (a * b) / d;
    }
}