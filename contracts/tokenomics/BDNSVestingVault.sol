// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BDNS Vesting Vault
/// @author BlockDNS
/// @notice Holds BDNS for a single beneficiary and unlocks it linearly after a cliff.
/// @dev The standard cliff schedule used for team and contributor allocations: nothing is vested
///      until `start + cliff`, then the whole escrow unlocks linearly over {duration}. Only the
///      {beneficiary} can pull tokens out, and only the amount already vested, so the schedule
///      cannot be front-run by the owner and each call releases exactly what time has earned.
contract BDNSVestingVault is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Token escrowed and released.
    IERC20 public immutable token;

    /// @notice The only address allowed to call {release}.
    address public immutable beneficiary;

    /// @notice Timestamp vesting begins counting; defaults to deployment time when zero.
    uint256 public immutable start;

    /// @notice Delay after {start} before any vesting occurs.
    uint256 public immutable cliff;

    /// @notice Time over which the escrow unlocks once the cliff has passed.
    uint256 public immutable duration;

    /// @notice Total BDNS deposited through {fund}.
    uint256 public totalLocked;

    /// @notice Amount already released to {beneficiary}.
    uint256 public released;

    /// @notice A zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice A zero duration or zero funding amount was supplied.
    error InvalidSchedule();

    /// @notice Caller is not {beneficiary}.
    error NotBeneficiary();

    /// @notice Nothing has vested yet, or everything is already released.
    error NothingToRelease();

    /// @notice Emitted when the owner funds the vault.
    event TokensLocked(address indexed source, uint256 amount);

    /// @notice Emitted on each withdrawal of vested tokens.
    event TokensReleased(address indexed beneficiary, uint256 amount);

    /// @param _owner Vault owner; may fund the escrow.
    /// @param _token Token to escrow; must be non-zero.
    /// @param _beneficiary Address that receives the vesting; must be non-zero.
    /// @param _start Vesting start; zero means the deployment block.
    /// @param _cliff Seconds after {start} before vesting begins.
    /// @param _duration Seconds over which the escrow unlocks; must be non-zero.
    constructor(
        address _owner,
        address _token,
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration
    ) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_token == address(0)) revert ZeroAddress();
        if (_beneficiary == address(0)) revert ZeroAddress();
        if (_duration == 0) revert InvalidSchedule();
        token = IERC20(_token);
        beneficiary = _beneficiary;
        start = _start == 0 ? block.timestamp : _start;
        cliff = _cliff;
        duration = _duration;
    }

    /// @notice Adds BDNS to the escrow, extending the total that will vest.
    /// @dev The owner must approve this contract. Funding is additive and lengthens the schedule
    ///      for the beneficiary rather than paying anything out.
    /// @param amount BDNS to escrow; must be non-zero.
    function fund(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidSchedule();
        totalLocked += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit TokensLocked(msg.sender, amount);
    }

    /// @notice Token amount vested by an arbitrary timestamp, assuming the full escrow was funded.
    /// @param time Timestamp to evaluate.
    /// @return Cumulative vested amount at `time`.
    function vestedAt(uint256 time) public view returns (uint256) {
        if (time < start + cliff) return 0;
        if (time >= start + cliff + duration) return totalLocked;
        uint256 elapsed = time - (start + cliff);
        return (totalLocked * elapsed) / duration;
    }

    /// @notice Vested tokens not yet claimed as of the current block.
    /// @return releasable Amount the next {release} would transfer.
    function releasableAmount() external view returns (uint256) {
        uint256 vested = vestedAt(block.timestamp);
        return vested > released ? vested - released : 0;
    }

    /// @notice Claims the vested balance. Callable only by {beneficiary}.
    /// @return amount Transferred to the beneficiary.
    function release() external returns (uint256) {
        if (msg.sender != beneficiary) revert NotBeneficiary();
        uint256 vested = vestedAt(block.timestamp);
        uint256 amount = vested > released ? vested - released : 0;
        if (amount == 0) revert NothingToRelease();
        released += amount;
        token.safeTransfer(beneficiary, amount);
        emit TokensReleased(beneficiary, amount);
        return amount;
    }
}