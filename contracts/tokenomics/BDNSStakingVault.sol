// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BDNSStakingVault is Ownable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

    struct Tranche {
        uint128 amount;
        uint64 end;
    }

    IERC20 public immutable token;
    uint256 public immutable totalEmission;
    uint256 public immutable emissionStart;

    Tranche[] private _tranches;
    uint256 public released;
    address public rewardsRecipient;

    error ZeroAddress();
    error InvalidSchedule();
    error NotConfigured();
    error LockNotSatisfied();
    error NothingAccrued();
    error Unauthorized();

    event ScheduleAccepted(uint256 totalEmission, uint256 trancheCount);
    event RewardsRecipientSet(address indexed recipient);
    event EmissionReleased(address indexed to, uint256 amount, uint256 periodIndex);
    event ExcessRecovered(address indexed to, uint256 amount);

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

    function trancheCount() external view returns (uint256) {
        return _tranches.length;
    }

    function trancheAt(uint256 index) external view returns (Tranche memory) {
        return _tranches[index];
    }

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

    function accruedEmission() external view returns (uint256) {
        return accruedEmissionAt(block.timestamp);
    }

    function pendingRelease() public view returns (uint256) {
        uint256 accrued = accruedEmissionAt(block.timestamp);
        return accrued > released ? accrued - released : 0;
    }

    function isLocked() public view returns (bool) {
        return token.balanceOf(address(this)) + released >= totalEmission;
    }

    function periodIndexAt(uint256 time) public view returns (uint256) {
        uint256 length = _tranches.length;
        if (length == 0 || time <= emissionStart) return 0;
        for (uint256 i = length; i > 0; i--) {
            if (_tranches[i - 1].end <= time) return i - 1;
        }
        return 0;
    }

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

    function setRewardsRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        rewardsRecipient = _recipient;
        emit RewardsRecipientSet(_recipient);
    }

    function recoverExcess() external onlyOwner returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        if (balance <= totalEmission) revert LockNotSatisfied();
        uint256 excess = balance - totalEmission;
        token.safeTransfer(owner(), excess);
        emit ExcessRecovered(owner(), excess);
        return excess;
    }

    function recoverTokens(address _token) external onlyOwner {
        if (_token == address(token)) revert LockNotSatisfied();
        IERC20(_token).safeTransfer(owner(), IERC20(_token).balanceOf(address(this)));
    }
}