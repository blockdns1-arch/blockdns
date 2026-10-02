// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BDNS Royalty Splitter
/// @author BlockDNS
/// @notice Distributes protocol revenue from marketplace fees across five destinations.
/// @dev The marketplace calls {split} right after forwarding its fee, so fees are pushed on-chain
///      rather than left for anyone to sweep later. Shares are in basis points and must sum to
///      exactly 10000, and no single destination may exceed {MAX_SHARE_BPS} (50%), which keeps the
///      split from being captured by one address. Remainder from rounding goes to the audit fund so
///      no dust is stranded in the contract.
contract BDNSRoyaltySplitter is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Token that gets distributed.
    IERC20 public immutable token;

    /// @notice Basis-point denominator (10000 = 100%).
    uint256 public constant SPLIT_DENOMINATOR = 10_000;

    /// @notice Ceiling for any single destination share, in basis points (50%).
    uint256 public constant MAX_SHARE_BPS = 5_000;

    /// @notice Share of revenue for protocol operations.
    address public treasury;

    /// @notice Share of revenue for core development.
    address public developerFund;

    /// @notice Share of revenue for liquidity provision.
    address public liquidityFund;

    /// @notice Share of revenue for growth and marketing.
    address public marketingFund;

    /// @notice Share of revenue for security work; also absorbs rounding dust.
    address public auditFund;

    /// @notice Treasury share in basis points.
    uint16 public treasuryBps = 3600;

    /// @notice Developer share in basis points.
    uint16 public developerBps = 2200;

    /// @notice Liquidity share in basis points.
    uint16 public liquidityBps = 1800;

    /// @notice Marketing share in basis points.
    uint16 public marketingBps = 1400;

    /// @notice Audit share in basis points.
    uint16 public auditBps = 1000;

    /// @notice Lifetime total distributed across all splits.
    uint256 public totalDistributed;

    /// @notice A zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice Shares do not sum to {SPLIT_DENOMINATOR}, or one exceeds {MAX_SHARE_BPS}.
    error InvalidSplit();

    /// @notice A zero amount was supplied, or destinations are not configured yet.
    error ZeroAmount();

    /// @notice Reserved for callers that are not the configured fee source.
    error NotDebtor();

    /// @notice Emitted on every distribution, with the amount sent to each destination.
    event Split(uint256 amount, uint256 toTreasury, uint256 toDeveloper, uint256 toLiquidity, uint256 toMarketing, uint256 toAudit);

    /// @notice Emitted when one destination address changes; `slot` identifies which one.
    event DestinationUpdated(bytes32 indexed slot, address destination);

    /// @notice Emitted when the shares change.
    event SharesUpdated(uint16 treasuryBps, uint16 developerBps, uint16 liquidityBps, uint16 marketingBps, uint16 auditBps);

    /// @param _token Token to distribute; must be non-zero.
    /// @param _owner Owner allowed to set destinations and shares; must be non-zero.
    constructor(address _token, address _owner) Ownable(_owner) {
        if (_token == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        token = IERC20(_token);
    }

    /// @notice Sets all five fee destinations at once.
    /// @dev All five must be non-zero, which is what stops a split from burning fees to address(0).
    /// @param _treasury Treasury destination.
    /// @param _developer Developer destination.
    /// @param _liquidity Liquidity destination.
    /// @param _marketing Marketing destination.
    /// @param _audit Audit destination.
    function setDestinations(
        address _treasury,
        address _developer,
        address _liquidity,
        address _marketing,
        address _audit
    ) external onlyOwner {
        if (_treasury == address(0) || _developer == address(0) || _liquidity == address(0) || _marketing == address(0) || _audit == address(0)) revert ZeroAddress();
        treasury = _treasury;
        developerFund = _developer;
        liquidityFund = _liquidity;
        marketingFund = _marketing;
        auditFund = _audit;
        emit DestinationUpdated(keccak256("treasury"), _treasury);
        emit DestinationUpdated(keccak256("developer"), _developer);
        emit DestinationUpdated(keccak256("liquidity"), _liquidity);
        emit DestinationUpdated(keccak256("marketing"), _marketing);
        emit DestinationUpdated(keccak256("audit"), _audit);
    }

    /// @notice Updates the revenue shares.
    /// @dev Shares must total exactly {SPLIT_DENOMINATOR} and no share may exceed
    ///      {MAX_SHARE_BPS}, so a single destination can never take the whole revenue.
    /// @param _treasuryBps Treasury share in basis points.
    /// @param _developerBps Developer share in basis points.
    /// @param _liquidityBps Liquidity share in basis points.
    /// @param _marketingBps Marketing share in basis points.
    /// @param _auditBps Audit share in basis points.
    function setShares(
        uint16 _treasuryBps,
        uint16 _developerBps,
        uint16 _liquidityBps,
        uint16 _marketingBps,
        uint16 _auditBps
    ) external onlyOwner {
        uint256 total = uint256(_treasuryBps) + _developerBps + _liquidityBps + _marketingBps + _auditBps;
        if (total != SPLIT_DENOMINATOR) revert InvalidSplit();
        if (_treasuryBps > MAX_SHARE_BPS || _developerBps > MAX_SHARE_BPS || _liquidityBps > MAX_SHARE_BPS || _marketingBps > MAX_SHARE_BPS || _auditBps > MAX_SHARE_BPS) revert InvalidSplit();
        treasuryBps = _treasuryBps;
        developerBps = _developerBps;
        liquidityBps = _liquidityBps;
        marketingBps = _marketingBps;
        auditBps = _auditBps;
        emit SharesUpdated(_treasuryBps, _developerBps, _liquidityBps, _marketingBps, _auditBps);
    }

/// @notice Splits the full balance held by this contract.
    /// @dev This is the entry point the marketplace uses after sending its fee.
    function split() external {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        _distribute(balance);
    }

    /// @notice Splits a specific amount, for callers paying in directly.
    /// @param amount Amount to distribute; must be non-zero.
    function split(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _distribute(amount);
    }

    /// @dev Pays each destination its share and books the distribution.
    /// @dev The audit fund receives whatever remains after the first four shares are rounded down,
    ///      so the sum of transfers always equals `amount` exactly.
    /// @param amount Amount to distribute.
    function _distribute(uint256 amount) internal {
        uint256 toTreasury = (amount * treasuryBps) / SPLIT_DENOMINATOR;
        uint256 toDeveloper = (amount * developerBps) / SPLIT_DENOMINATOR;
        uint256 toLiquidity = (amount * liquidityBps) / SPLIT_DENOMINATOR;
        uint256 toMarketing = (amount * marketingBps) / SPLIT_DENOMINATOR;
        uint256 toAudit = amount - toTreasury - toDeveloper - toLiquidity - toMarketing;

        token.safeTransfer(treasury, toTreasury);
        token.safeTransfer(developerFund, toDeveloper);
        token.safeTransfer(liquidityFund, toLiquidity);
        token.safeTransfer(marketingFund, toMarketing);
        token.safeTransfer(auditFund, toAudit);

        totalDistributed += amount;
        emit Split(amount, toTreasury, toDeveloper, toLiquidity, toMarketing, toAudit);
    }
}
