// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BdnBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant USD_SCALE = 1e6;

    IERC20 public immutable bdns;
    address public feeCollector;

    // USD price of 1 BDNS, scaled 1e6 (0.01 USD -> 10000)
    uint256 public bdnsUsdPrice;
    // flat bridge fee in USD, scaled 1e6 (0.10 USD -> 100000)
    uint256 public bridgeFeeUsd;

    // net BDNS a user has locked in the bridge (after fee)
    mapping(address => uint256) public ledger;
    uint256 public totalLocked;

    error ZeroAddress();
    error ZeroRate();
    error NotEnoughLocked();
    error InvalidAmount();

    event Deposited(address indexed user, uint256 amount, uint256 fee);
    event Withdrawn(address indexed user, uint256 amount);
    event BridgeFeeUpdated(uint256 bridgeFeeUsd);
    event BdnsUsdPriceUpdated(uint256 bdnsUsdPrice);
    event FeeCollectorUpdated(address feeCollector);

    constructor(
        address _bdns,
        address _feeCollector,
        uint256 _bdnsUsdPrice,
        uint256 _bridgeFeeUsd
    ) Ownable(msg.sender) {
        if (_bdns == address(0) || _feeCollector == address(0)) revert ZeroAddress();
        bdns = IERC20(_bdns);
        feeCollector = _feeCollector;
        _setBdnsUsdPrice(_bdnsUsdPrice);
        _setBridgeFeeUsd(_bridgeFeeUsd);
    }

    /// Lock BDNS in the bridge (L1 -> L2 direction). Fee in BDNS -> owner.
    function deposit(uint256 amount) external nonReentrant {
        uint256 fee = bridgeFeeBdn();
        if (amount <= fee) revert InvalidAmount();
        uint256 net = amount - fee;
        bdns.safeTransferFrom(msg.sender, address(this), net);
        bdns.safeTransferFrom(msg.sender, feeCollector, fee);
        ledger[msg.sender] += net;
        totalLocked += net;
        emit Deposited(msg.sender, net, fee);
    }

    /// Claim BDNS back (L2 -> L1 direction) from the user's ledger.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0 || ledger[msg.sender] < amount) revert NotEnoughLocked();
        ledger[msg.sender] -= amount;
        totalLocked -= amount;
        bdns.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function bridgeFeeBdn() public view returns (uint256) {
        return (bridgeFeeUsd * 1e18) / bdnsUsdPrice;
    }

    function setBridgeFeeUsd(uint256 _bridgeFeeUsd) external onlyOwner {
        _setBridgeFeeUsd(_bridgeFeeUsd);
    }

    function setBdnsUsdPrice(uint256 _bdnsUsdPrice) external onlyOwner {
        _setBdnsUsdPrice(_bdnsUsdPrice);
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert ZeroAddress();
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    function _setBridgeFeeUsd(uint256 _bridgeFeeUsd) internal {
        bridgeFeeUsd = _bridgeFeeUsd;
        emit BridgeFeeUpdated(_bridgeFeeUsd);
    }

    function _setBdnsUsdPrice(uint256 _bdnsUsdPrice) internal {
        if (_bdnsUsdPrice == 0) revert ZeroRate();
        bdnsUsdPrice = _bdnsUsdPrice;
        emit BdnsUsdPriceUpdated(_bdnsUsdPrice);
    }
}