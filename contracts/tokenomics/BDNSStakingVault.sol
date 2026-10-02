// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BDNS Staking Vault
/// @author BlockDNS
/// @notice Holds a locked BDNS emission and releases it linearly to staking rewards over time.
/// @dev The vault never decides the price of anything: it only enforces *when* emission is allowed.
///      A schedule of {Tranche} boundaries is fixed at construction and validated to be strictly
///      increasing, emission accrues continuously between boundaries, and a release is refused
///      unless the vault already holds the entire {totalEmission} (`isLocked`). That means rewards
///      can never be paid from future emissions — the tokens must be in escrow first.
contract BDNSStakingVault is Ownable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Role allowed to trigger emission releases, kept separate from vault ownership.
    bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

    /// @notice One step of the emission schedule.
    /// @param amount BDNS emitted during this step.
    /// @param end Timestamp at which this step's emission is fully accrued.
    struct Tranche {
        uint128 amount;
        uint64 end;
    }

    /// @notice Token escrowed and released by this vault.
    IERC20 public immutable token;

    /// @notice Sum of all tranche amounts; the full emission that must be escrowed up front.
    uint256 public immutable totalEmission;

    /// @notice Timestamp the schedule was created; emission accrues linearly from here.
    uint256 public immutable emissionStart;

    /// @dev Immutable emission schedule, validated at construction.
    Tranche[] private _tranches;

    /// @notice Emission already paid out to {rewardsRecipient}.
    uint256 public released;

    /// @notice Address that receives released emission.
    address public rewardsRecipient;

    /// @notice A zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice The schedule was empty, had a zero tranche, or had non-increasing boundaries.
    error InvalidSchedule();

    /// @notice A release was attempted before {rewardsRecipient} was configured.
    error NotConfigured();

    /// @notice The vault does not hold the full emission, or a recovery target is invalid.
    error LockNotSatisfied();

    /// @notice Nothing has accrued since the last release.
    error NothingAccrued();

    /// @notice Caller lacks {RELEASER_ROLE}.
    error Unauthorized();

    /// @notice Emitted once at construction with the accepted schedule.
    event ScheduleAccepted(uint256 totalEmission, uint256 trancheCount);

    /// @notice Emitted when the emission recipient is set.
    event RewardsRecipientSet(address indexed recipient);

    /// @notice Emitted on each release, with the schedule period it covers.
    event EmissionReleased(address indexed to, uint256 amount, uint256 periodIndex);

    /// @notice Emitted when escrowed tokens above the emission are returned to the owner.
    event ExcessRecovered(address indexed to, uint256 amount);

    /// @param _owner Vault owner and admin; may recover excess and unrelated tokens.
    /// @param _token Token to escrow; must be non-zero.
    /// @param _schedule Strictly increasing {Tranche} list describing the emission curve.
    constructor(
        address _owner,
        address _token,
        Tranche[] memory _schedule
    ) Ownable(_owner) AccessControl() {
        if (_token == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        token = IERC20(_token);
        emissionStart = block.timestamp;

        uint256 sum;
        uint256 scheduleLength = _schedule.length;
        if (scheduleLength == 0) revert InvalidSchedule();
        uint256 previousEnd;
        for (uint256 i = 0; i < scheduleLength; i++) {
            Tranche memory t = _schedule[i];
            if (t.amount == 0) revert InvalidSchedule();
            if (t.end <= previousEnd) revert InvalidSchedule();
            previousEnd = t.end;
            sum += t.amount;
            _tranches.push(t);
        }
        totalEmission = sum;
        if (sum == 0) revert InvalidSchedule();
        emit ScheduleAccepted(sum, scheduleLength);
    }

    /// @notice Number of steps in the emission schedule.
    /// @return Size of the schedule.
    function trancheCount() external view returns (uint256) {
        return _tranches.length;
    }

    /// @notice Reads one schedule step.
    /// @param index Step index.
    /// @return The {Tranche} at that index.
    function trancheAt(uint256 index) external view returns (Tranche memory) {
        return _tranches[index];
    }

    /// @notice Emission accrued by an arbitrary timestamp, linearly interpolated inside the current step.
    /// @param time Timestamp to evaluate.
    /// @return Cumulative emission accrued from {emissionStart} up to `time`.
    function accruedEmissionAt(uint256 time) public view returns (uint256) {
        uint256 length = _tranches.length;
        if (length == 0 || time <= emissionStart) return 0;

        uint256 cumulative;
        for (uint256 i = 0; i < length; i++) {
            Tranche memory t = _tranches[i];
            if (t.end <= time) {
                cumulative += t.amount;
                continue;
            }
            if (i == 0) {
                uint256 spanFirst = t.end - emissionStart;
                return (t.amount * (time - emissionStart)) / spanFirst;
            }
            Tranche memory prev = _tranches[i - 1];
            uint256 span = t.end - prev.end;
            uint256 into = time - prev.end;
            return cumulative + (t.amount * into) / span;
        }
        return cumulative;
    }

    /// @notice Emission accrued as of the current block.
    /// @return {accruedEmissionAt} evaluated at `block.timestamp`.
    function accruedEmission() external view returns (uint256) {
        return accruedEmissionAt(block.timestamp);
    }

    /// @notice Accrued emission that has not been paid out yet.
    /// @return releasable Amount the next {release} would transfer.
    function pendingRelease() public view returns (uint256) {
        uint256 accrued = accruedEmissionAt(block.timestamp);
        return accrued > released ? accrued - released : 0;
    }

    /// @notice Whether the vault holds enough tokens to cover the entire remaining emission.
    /// @return True when the escrow is fully funded.
    function isLocked() public view returns (bool) {
        return token.balanceOf(address(this)) + released >= totalEmission;
    }

    /// @notice Schedule step covering a timestamp.
    /// @param time Timestamp to evaluate.
    /// @return periodIndex Index of the step in progress, or 0 before the first boundary.
    function periodIndexAt(uint256 time) public view returns (uint256) {
        uint256 length = _tranches.length;
        if (length == 0 || time <= emissionStart) return 0;
        for (uint256 i = length; i > 0; i--) {
            if (_tranches[i - 1].end <= time) return i - 1;
        }
        return 0;
    }

    /// @notice Pays the accrued emission to {rewardsRecipient}.
    /// @dev Requires {RELEASER_ROLE}, a configured recipient, a fully funded escrow, and a non-zero
    ///      pending amount. Idempotent per emission: anything already released is subtracted.
    /// @return amount Transferred to the recipient.
    function release() external nonReentrant returns (uint256) {
        if (!hasRole(RELEASER_ROLE, msg.sender)) revert Unauthorized();
        address recipient = rewardsRecipient;
        if (recipient == address(0)) revert NotConfigured();
        if (!isLocked()) revert LockNotSatisfied();

        uint256 amount = pendingRelease();
        if (amount == 0) revert NothingAccrued();

        released += amount;
        token.safeTransfer(recipient, amount);
        emit EmissionReleased(recipient, amount, periodIndexAt(block.timestamp));
        return amount;
    }

    /// @notice Sets where released emission is sent.
    /// @param _recipient Emission recipient; must be non-zero.
    function setRewardsRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        rewardsRecipient = _recipient;
        emit RewardsRecipientSet(_recipient);
    }

    /// @notice Returns tokens held above the emission schedule to the owner.
    /// @dev Refuses while the escrow is under-funded, so rewards can never be shortchanged by a
    ///      recovery call.
    /// @return excess Amount returned to the owner.
    function recoverExcess() external onlyOwner returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        if (balance <= totalEmission) revert LockNotSatisfied();
        uint256 excess = balance - totalEmission;
        token.safeTransfer(owner(), excess);
        emit ExcessRecovered(owner(), excess);
        return excess;
    }

    /// @notice Recovers an unrelated token accidentally sent to the vault.
    /// @dev The emission token is explicitly rejected so the escrow cannot be drained this way.
    /// @param _token Token to sweep; must not be the emission token.
    function recoverTokens(address _token) external onlyOwner {
        if (_token == address(token)) revert LockNotSatisfied();
        IERC20(_token).safeTransfer(owner(), IERC20(_token).balanceOf(address(this)));
    }
}