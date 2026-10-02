// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BDNS
/// @author BlockDNS
/// @notice Protocol token for BlockDNS: a capped, burnable ERC-20 with permit support that also
///         escrows the validator stake used to secure name resolution.
/// @dev Three roles split responsibilities: `MINTER_ROLE` issues supply (respecting {cap}),
///      `BURNER_ROLE` burns tokens locked in the bridge, and `CONSENSUS_ROLE` slashes misbehaving
///      validators. A validator becomes {Validator-active} once its stake reaches
///      {minValidatorStake}; withdrawals are unbonded for {unbondingPeriod} before they can be
///      claimed, so stake cannot be pulled out during a challenge window.
contract BDNS is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    /// @notice Role allowed to issue new BDNS.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Role allowed to burn tokens (used by the bridge escrow).
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Role allowed to slash validators.
    bytes32 public constant CONSENSUS_ROLE = keccak256("CONSENSUS_ROLE");

    /// @notice Hard supply ceiling; minting reverts once `totalMinted` reaches it.
    uint256 public immutable cap;

    /// @notice Stake required for an address to count as an active validator.
    uint256 public immutable minValidatorStake;

    /// @notice Delay between {beginUnbonding} and {completeUnbonding}, in seconds.
    uint64 public immutable unbondingPeriod;

    /// @notice Lifetime amount of BDNS issued through {mint} and {mintValidatorReward}.
    uint256 public totalMinted;

    /// @notice BDNS currently held as validator stake inside this contract.
    uint256 public totalStaked;

    /// @notice Per-validator stake bookkeeping.
    /// @param staked Active stake backing this validator.
    /// @param unbonding Amount in the unbonding queue, not yet claimable.
    /// @param unbondingReadyAt Timestamp at which {completeUnbonding} becomes callable.
    /// @param active True while `staked >= minValidatorStake`.
    struct Validator {
        uint256 staked;
        uint256 unbonding;
        uint64 unbondingReadyAt;
        bool active;
    }

    /// @dev Validator stake and unbonding state.
    mapping(address => Validator) private _validators;

    /// @notice Addresses that have ever staked, in first-stake order.
    address[] public validatorRegistry;

    /// @notice A zero cap or zero admin was supplied to the constructor.
    error InvalidConfig();

    /// @notice A zero amount was supplied where a positive one is required.
    error ZeroAmount();

    /// @notice Minting would push `totalMinted` past {cap}.
    error CapExceeded(uint256 requested, uint256 remainingCap);

    /// @notice The validator does not have enough stake for the requested operation.
    error InsufficientStake(uint256 available, uint256 requested);

    /// @notice {completeUnbonding} was called before the unbonding period elapsed.
    error UnbondingNotReady(uint64 readyAt);

    /// @notice {completeUnbonding} was called with nothing unbonding.
    error NothingToUnbond();

    /// @notice Slashing targeted an address that is not an active validator.
    error NotActiveValidator();

    /// @notice Emitted whenever BDNS is issued, including validator rewards.
    event Minted(address indexed to, uint256 amount);

    /// @notice Emitted when the bridge burns escrowed BDNS.
    event BridgeBurned(address indexed account, uint256 amount);

    /// @notice Emitted on {stake}, with the validator's resulting stake.
    event ValidatorStaked(address indexed validator, uint256 amount, uint256 totalStake);

    /// @notice Emitted on {beginUnbonding}, with the timestamp the funds unlock at.
    event UnbondingStarted(address indexed validator, uint256 amount, uint64 readyAt);

    /// @notice Emitted when unbonded BDNS is returned to the validator.
    event UnbondingCompleted(address indexed validator, uint256 amount);

    /// @notice Emitted when a validator is slashed; `amount` is the penalty actually applied.
    event ValidatorSlashed(address indexed validator, uint256 amount, uint256 remainingStake);

    /// @param _cap Total supply ceiling (deploy default is 1B BDNS).
    /// @param _admin Address that receives the admin, minter, burner and consensus roles.
    constructor(uint256 _cap, address _admin) ERC20("BlockDNS", "BDNS") ERC20Permit("BlockDNS") {
        if (_cap == 0 || _admin == address(0)) revert InvalidConfig();
        cap = _cap;
        minValidatorStake = 32_000 ether;
        unbondingPeriod = 7 days;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
        _grantRole(BURNER_ROLE, _admin);
        _grantRole(CONSENSUS_ROLE, _admin);
    }

    /// @notice Issues BDNS, up to the remaining {cap}.
    /// @param to Recipient of the newly minted tokens.
    /// @param amount Amount to mint; must be non-zero and within the cap.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        uint256 remaining = cap - totalMinted;
        if (amount > remaining) revert CapExceeded(amount, remaining);
        totalMinted += amount;
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// @notice Burns BDNS held in the bridge escrow, backing an L1 withdrawal.
    /// @param from Escrow address whose balance is burned.
    /// @param amount Amount to burn; must be non-zero.
    function bridgeBurn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        _burn(from, amount);
        emit BridgeBurned(from, amount);
    }

    /// @notice Escrows BDNS as validator stake and marks the caller active once the minimum is met.
    /// @param amount Amount of BDNS to stake; must be non-zero.
    function stake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Validator storage v = _validators[msg.sender];
        bool firstStake = v.staked == 0 && v.unbonding == 0;
        v.staked += amount;
        v.active = v.staked >= minValidatorStake;
        totalStaked += amount;
        if (firstStake) validatorRegistry.push(msg.sender);
        _transfer(msg.sender, address(this), amount);
        emit ValidatorStaked(msg.sender, amount, v.staked);
    }

    /// @notice Moves part of the caller's active stake into the unbonding queue.
    /// @dev Funds stay in this contract until {unbondingPeriod} has passed, so stake cannot
    ///      disappear during a challenge window.
    /// @param amount Stake to unbond; must be non-zero and no larger than the current stake.
    function beginUnbonding(uint256 amount) external {
        Validator storage v = _validators[msg.sender];
        if (amount == 0 || amount > v.staked) revert InsufficientStake(v.staked, amount);
        v.staked -= amount;
        v.unbonding += amount;
        v.active = v.staked >= minValidatorStake;
        totalStaked -= amount;
        v.unbondingReadyAt = uint64(block.timestamp + unbondingPeriod);
        emit UnbondingStarted(msg.sender, amount, v.unbondingReadyAt);
    }

    /// @notice Claims unbonded BDNS once the unbonding period has elapsed.
    function completeUnbonding() external {
        Validator storage v = _validators[msg.sender];
        if (v.unbonding == 0) revert NothingToUnbond();
        if (block.timestamp < v.unbondingReadyAt) revert UnbondingNotReady(v.unbondingReadyAt);
        uint256 amount = v.unbonding;
        v.unbonding = 0;
        v.unbondingReadyAt = 0;
        v.active = v.staked >= minValidatorStake;
        _transfer(address(this), msg.sender, amount);
        emit UnbondingCompleted(msg.sender, amount);
    }

    /// @notice Slashes a misbehaving validator, burning the penalty and ejecting it below the minimum.
    /// @dev The penalty is capped at the validator's remaining stake so a slash can never over-burn.
    /// @param validator Validator to penalize; must currently be active.
    /// @param amount Requested penalty; the amount actually burned may be smaller.
    function slash(address validator, uint256 amount) external onlyRole(CONSENSUS_ROLE) {
        if (amount == 0) revert ZeroAmount();
        Validator storage v = _validators[validator];
        if (!v.active) revert NotActiveValidator();
        uint256 penalty = amount > v.staked ? v.staked : amount;
        v.staked -= penalty;
        v.active = v.staked >= minValidatorStake;
        totalStaked -= penalty;
        _burn(address(this), penalty);
        emit ValidatorSlashed(validator, penalty, v.staked);
    }

    /// @notice Issues a staking reward to a validator; counts against {cap} like any other mint.
    /// @param validator Validator receiving the reward.
    /// @param amount Reward amount; must be non-zero and within the remaining cap.
    function mintValidatorReward(address validator, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        uint256 remaining = cap - totalMinted;
        if (amount > remaining) revert CapExceeded(amount, remaining);
        totalMinted += amount;
        _mint(validator, amount);
        emit Minted(validator, amount);
    }

    /// @notice Supply headroom left before the hard cap is reached.
    /// @return Remaining BDNS that can still be minted.
    function remainingCap() external view returns (uint256) {
        return cap - totalMinted;
    }

    /// @notice Reads a validator's full staking state in a single call.
    /// @param validator Address to inspect.
    /// @return staked Active stake.
    /// @return unbonding Amount waiting out {unbondingPeriod}.
    /// @return unbondingReadyAt Timestamp the unbonding unlocks at.
    /// @return active Whether the validator currently meets {minValidatorStake}.
    function getValidator(address validator)
        external
        view
        returns (uint256 staked, uint256 unbonding, uint64 unbondingReadyAt, bool active)
    {
        Validator storage v = _validators[validator];
        return (v.staked, v.unbonding, v.unbondingReadyAt, v.active);
    }

    /// @notice Number of addresses that have ever staked.
    /// @return Size of {validatorRegistry}.
    function validatorCount() external view returns (uint256) {
        return validatorRegistry.length;
    }
}
