// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BDNSRoyaltySplitter is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public constant SPLIT_DENOMINATOR = 10_000;
    uint256 public constant MAX_SHARE_BPS = 5_000;

    address public treasury;
    address public developerFund;
    address public liquidityFund;
    address public marketingFund;
    address public auditFund;

    uint16 public treasuryBps = 3600;
    uint16 public developerBps = 2200;
    uint16 public liquidityBps = 1800;
    uint16 public marketingBps = 1400;
    uint16 public auditBps = 1000;

    uint256 public totalDistributed;

    error ZeroAddress();
    error InvalidSplit();
    error ZeroAmount();
    error NotDebtor();

    event Split(uint256 amount, uint256 toTreasury, uint256 toDeveloper, uint256 toLiquidity, uint256 toMarketing, uint256 toAudit);
    event DestinationUpdated(bytes32 indexed slot, address destination);
    event SharesUpdated(uint16 treasuryBps, uint16 developerBps, uint16 liquidityBps, uint16 marketingBps, uint16 auditBps);

    constructor(address _token, address _owner) Ownable(_owner) {
        if (_token == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        token = IERC20(_token);
    }

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

    function split() external {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        _distribute(balance);
    }

    function split(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _distribute(amount);
    }

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
