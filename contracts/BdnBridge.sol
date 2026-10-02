// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BDNS Bridge
/// @author BlockDNS
/// @notice Escrows BDNS on one chain so the paired chain can credit an equivalent balance, and pays
///         withdrawals back out of the same escrow.
/// @dev This side of the bridge is a simple locked ledger: {deposit} takes BDNS plus a flat fee and
///      credits the caller's {ledger}, {withdraw} pays BDNS back out of escrow against that credit.
///      The fee is quoted in USD and converted through {bdnsUsdPrice}, so it stays stable as the token
///      price moves. Whoever settles on the paired chain burns the escrowed supply, which is what
///      keeps total BDNS constant across the two deployments.
contract BdnBridge is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Scale used for USD-denominated values (1e6 = $1.00).
    uint256 public constant USD_SCALE = 1e6;

    /// @notice BDNS token escrowed by this bridge.
    IERC20 public immutable bdns;

    /// @notice Address that receives the bridge fee.
    address public feeCollector;

    /// @notice USD price of 1 BDNS, scaled by 1e6 (0.01 USD = 10000).
    uint256 public bdnsUsdPrice;

    /// @notice Flat bridge fee in USD, scaled by 1e6 (0.10 USD = 100000).
    uint256 public bridgeFeeUsd;

    /// @notice Net BDNS credited to each depositor, after the fee, and not yet withdrawn.
    mapping(address => uint256) public ledger;

    /// @notice Total BDNS currently held in escrow backing outstanding ledger credits.
    uint256 public totalLocked;

    /// @notice The zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice A zero USD price was supplied, which would make the fee unquotable.
    error ZeroRate();

    /// @notice The caller tried to withdraw more than their ledger credit.
    error NotEnoughLocked();

    /// @notice The amount was zero, or did not exceed the fee.
    error InvalidAmount();

    /// @notice Emitted on deposit; `amount` is the net BDNS credited after `fee`.
    event Deposited(address indexed user, uint256 amount, uint256 fee);

    /// @notice Emitted when escrowed BDNS is paid back to a depositor.
    event Withdrawn(address indexed user, uint256 amount);

    /// @notice Emitted when the USD bridge fee changes.
    event BridgeFeeUpdated(uint256 bridgeFeeUsd);

    /// @notice Emitted when the USD price used for fee conversion changes.
    event BdnsUsdPriceUpdated(uint256 bdnsUsdPrice);

    /// @notice Emitted when the fee recipient changes.
    event FeeCollectorUpdated(address feeCollector);

    /// @param _bdns BDNS token address; must be non-zero.
    /// @param _feeCollector Initial fee recipient; must be non-zero.
    /// @param _bdnsUsdPrice USD price of BDNS scaled by 1e6; must be non-zero.
    /// @param _bridgeFeeUsd Flat bridge fee in USD scaled by 1e6.
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

    /// @notice Locks BDNS in escrow (L1 -> L2 direction) and credits the caller's {ledger}.
    /// @dev Caller must approve this contract for `amount` BDNS. The fee is taken in the same call
    ///      and forwarded to {feeCollector}; only the net amount is credited.
    /// @param amount Gross BDNS to deposit, fee included; must exceed the fee.
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

    /// @notice Claims escrowed BDNS back (L2 -> L1 direction) against the caller's {ledger}.
    /// @param amount BDNS to release; must be non-zero and within the ledger credit.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0 || ledger[msg.sender] < amount) revert NotEnoughLocked();
        ledger[msg.sender] -= amount;
        totalLocked -= amount;
        bdns.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Current bridge fee converted from USD into BDNS.
    /// @return Fee denominated in BDNS.
    function bridgeFeeBdn() public view returns (uint256) {
        return (bridgeFeeUsd * 1e18) / bdnsUsdPrice;
    }

    /// @notice Updates the flat bridge fee, quoted in USD scaled by 1e6.
    /// @param _bridgeFeeUsd New fee; 0 is allowed and disables the fee.
    function setBridgeFeeUsd(uint256 _bridgeFeeUsd) external onlyOwner {
        _setBridgeFeeUsd(_bridgeFeeUsd);
    }

    /// @notice Updates the USD price used to convert the fee into BDNS.
    /// @param _bdnsUsdPrice USD price of BDNS scaled by 1e6; must be non-zero.
    function setBdnsUsdPrice(uint256 _bdnsUsdPrice) external onlyOwner {
        _setBdnsUsdPrice(_bdnsUsdPrice);
    }

    /// @notice Changes where the BDNS fee is sent.
    /// @param _feeCollector New fee recipient; must be non-zero.
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert ZeroAddress();
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    /// @dev Applies and announces the USD-denominated bridge fee.
    /// @param _bridgeFeeUsd Fee scaled by 1e6; 0 disables the fee.
    function _setBridgeFeeUsd(uint256 _bridgeFeeUsd) internal {
        bridgeFeeUsd = _bridgeFeeUsd;
        emit BridgeFeeUpdated(_bridgeFeeUsd);
    }

    /// @dev Applies and announces the USD price backing {bridgeFeeBdn}; must stay non-zero.
    /// @param _bdnsUsdPrice USD price of BDNS scaled by 1e6.
    function _setBdnsUsdPrice(uint256 _bdnsUsdPrice) internal {
        if (_bdnsUsdPrice == 0) revert ZeroRate();
        bdnsUsdPrice = _bdnsUsdPrice;
        emit BdnsUsdPriceUpdated(_bdnsUsdPrice);
    }
}