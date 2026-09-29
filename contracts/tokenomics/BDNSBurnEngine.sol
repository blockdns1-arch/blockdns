// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IBurnableERC20 is IERC20 {
    function burn(uint256 amount) external;
}

/// @title BDNS Decaying Burn Engine
/// @notice Implements the 10-year decaying auto-burn with a 500M hard cap.
///         The burn rate starts at 0.5% (50 bps) and decays linearly to 0
///         over 10 years. Once cumulative burned BDNS reaches the 500M cap,
///         the auto-burn stops entirely.
contract BDNSBurnEngine is Ownable, AccessControl {
    using SafeERC20 for IERC20;
    using SafeERC20 for IBurnableERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IBurnableERC20 public immutable burnToken;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant INITIAL_RATE_BPS = 50; // 0.5%
    uint256 public constant DECAY_DURATION = 3650 days; // 10 years
    uint256 public constant HARD_CAP = 500_000_000 ether; // 500M BDNS

    uint256 public immutable start;
    uint256 public cumulativeBurned;
    bool public stopped;

    error ZeroAddress();
    error BurnStopped();
    error ZeroAmount();
    error HardCapReached(uint256 cumulative);

    event Burned(uint256 amount, uint256 rateBps, uint256 cumulative);
    event AutoBurnStopped(uint256 cumulative);

    constructor(address _token, address _owner) Ownable(_owner) {
        if (_token == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        burnToken = IBurnableERC20(_token);
        start = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(OPERATOR_ROLE, _owner);
    }

    /// @notice Current decayed burn rate in bps at a given timestamp.
    function burnRateBpsAt(uint256 time) public view returns (uint256) {
        uint256 elapsed = time - start;
        if (elapsed >= DECAY_DURATION) return 0;
        return (INITIAL_RATE_BPS * (DECAY_DURATION - elapsed)) / DECAY_DURATION;
    }

    function burnRateBps() external view returns (uint256) {
        return burnRateBpsAt(block.timestamp);
    }

    function remainingCap() public view returns (uint256) {
        if (cumulativeBurned >= HARD_CAP) return 0;
        return HARD_CAP - cumulativeBurned;
    }

    function progressBps() external view returns (uint256) {
        return (cumulativeBurned * BPS_DENOMINATOR) / HARD_CAP;
    }

    /// @notice Auto-burn a decaying % of the contract-held BDNS balance,
    ///         capped by the 500M hard cap. Callable only by OPERATOR_ROLE.
    function burn() external onlyRole(OPERATOR_ROLE) returns (uint256) {
        if (stopped) revert BurnStopped();

        uint256 balance = burnToken.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();

        uint256 rate = burnRateBpsAt(block.timestamp);
        if (rate == 0) {
            stopped = true;
            emit AutoBurnStopped(cumulativeBurned);
            return 0;
        }

        uint256 target = (balance * rate) / BPS_DENOMINATOR;
        uint256 capLeft = remainingCap();
        if (capLeft == 0) revert HardCapReached(cumulativeBurned);

        uint256 amount = target > capLeft ? capLeft : target;
        if (amount == 0) revert ZeroAmount();

        burnToken.burn(amount);
        cumulativeBurned += amount;

        if (cumulativeBurned >= HARD_CAP) {
            stopped = true;
            emit AutoBurnStopped(cumulativeBurned);
        }
        emit Burned(amount, rate, cumulativeBurned);
        return amount;
    }

    /// @notice Burn an explicit caller-supplied amount, capped by the hard cap.
    function burnExplicit(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        if (stopped) revert BurnStopped();
        if (amount == 0) revert ZeroAmount();

        uint256 capLeft = remainingCap();
        if (capLeft == 0) revert HardCapReached(cumulativeBurned);
        if (amount > capLeft) amount = capLeft;

        burnToken.safeTransferFrom(msg.sender, address(this), amount);
        burnToken.burn(amount);
        cumulativeBurned += amount;

        if (cumulativeBurned >= HARD_CAP) {
            stopped = true;
            emit AutoBurnStopped(cumulativeBurned);
        }
        emit Burned(amount, 0, cumulativeBurned);
    }

    function pause() external onlyOwner {
        stopped = true;
        emit AutoBurnStopped(cumulativeBurned);
    }

    function resume() external onlyOwner {
        stopped = false;
    }
}
