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

    /// @notice Role allowed to trigger burns; the owner holds it at deployment.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice BDNS token burned by this engine; must expose `burn(uint256)`.
    IBurnableERC20 public immutable burnToken;

    /// @notice Basis-point denominator used for the decaying rate.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Burn rate at `start`, in basis points (0.5% of the held balance).
    uint256 public constant INITIAL_RATE_BPS = 50;

    /// @notice Time over which the rate decays linearly to zero (10 years).
    uint256 public constant DECAY_DURATION = 3650 days;

    /// @notice Lifetime ceiling on BDNS destroyed by this engine.
    uint256 public constant HARD_CAP = 500_000_000 ether;

    /// @notice Timestamp the decay curve is measured from.
    uint256 public immutable start;

    /// @notice Lifetime BDNS destroyed by this engine.
    uint256 public cumulativeBurned;

    /// @notice Whether the engine is halted; once the rate hits 0 the engine stops itself.
    bool public stopped;

    /// @notice A zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice The engine has been paused or has fully decayed.
    error BurnStopped();

    /// @notice Nothing was available to burn.
    error ZeroAmount();

    /// @notice {HARD_CAP} has been reached and no further supply can be destroyed.
    error HardCapReached(uint256 cumulative);

    /// @notice Emitted on every burn; `rateBps` is 0 for explicit burns.
    event Burned(uint256 amount, uint256 rateBps, uint256 cumulative);

    /// @notice Emitted when the engine halts, either by reaching the cap, fully decaying, or a pause.
    event AutoBurnStopped(uint256 cumulative);

    /// @param _token Burnable BDNS token; must be non-zero.
    /// @param _owner Owner and initial operator; must be non-zero.
    constructor(address _token, address _owner) Ownable(_owner) {
        if (_token == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        burnToken = IBurnableERC20(_token);
        start = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(OPERATOR_ROLE, _owner);
    }

    /// @notice Decayed burn rate at an arbitrary timestamp.
    /// @param time Timestamp to evaluate; earlier than {start} is treated as the start rate.
    /// @return rateBps Rate in basis points, reaching 0 after {DECAY_DURATION}.
    function burnRateBpsAt(uint256 time) public view returns (uint256) {
        uint256 elapsed = time - start;
        if (elapsed >= DECAY_DURATION) return 0;
        return (INITIAL_RATE_BPS * (DECAY_DURATION - elapsed)) / DECAY_DURATION;
    }

/// @notice Decayed burn rate as of the current block.
    /// @return Rate in basis points.
    function burnRateBps() external view returns (uint256) {
        return burnRateBpsAt(block.timestamp);
    }

    /// @notice Destroyable supply left before the hard cap.
    /// @return Remaining allowance under {HARD_CAP}, or 0 once reached.
    function remainingCap() public view returns (uint256) {
        if (cumulativeBurned >= HARD_CAP) return 0;
        return HARD_CAP - cumulativeBurned;
    }

    /// @notice Progress toward the hard cap.
    /// @return Cumulative burned as basis points of {HARD_CAP}.
    function progressBps() external view returns (uint256) {
        return (cumulativeBurned * BPS_DENOMINATOR) / HARD_CAP;
    }

    /// @notice Burns the decayed share of the BDNS held by this contract.
    /// @dev Only burns tokens this contract already holds, and only up to {HARD_CAP}. Once the rate
    ///      decays to zero the engine halts itself permanently and reverts on later calls.
    /// @return amount BDNS destroyed.
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

/// @notice Burns an explicit amount pulled from the caller.
    /// @dev Used for ecosystem burns outside the decay curve. The amount is clamped to the remaining
    ///      {HARD_CAP}, and the engine halts itself once the cap is reached.
    /// @param amount BDNS to destroy, pulled from the caller with `transferFrom`.
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

/// @notice Halts the engine. Cannot be undone except by {resume}.
    function pause() external onlyOwner {
        stopped = true;
        emit AutoBurnStopped(cumulativeBurned);
    }

    /// @notice Restarts a paused engine. Rate decay and cap accounting are unaffected.
    function resume() external onlyOwner {
        stopped = false;
    }
}
