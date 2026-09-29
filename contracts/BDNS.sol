// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract BDNS is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant CONSENSUS_ROLE = keccak256("CONSENSUS_ROLE");

    uint256 public immutable cap;
    uint256 public immutable minValidatorStake;
    uint64 public immutable unbondingPeriod;

    uint256 public totalMinted;
    uint256 public totalStaked;

    struct Validator {
        uint256 staked;
        uint256 unbonding;
        uint64 unbondingReadyAt;
        bool active;
    }

    mapping(address => Validator) private _validators;
    address[] public validatorRegistry;

    error InvalidConfig();
    error ZeroAmount();
    error CapExceeded(uint256 requested, uint256 remainingCap);
    error InsufficientStake(uint256 available, uint256 requested);
    error UnbondingNotReady(uint64 readyAt);
    error NothingToUnbond();
    error NotActiveValidator();

    event Minted(address indexed to, uint256 amount);
    event BridgeBurned(address indexed account, uint256 amount);
    event ValidatorStaked(address indexed validator, uint256 amount, uint256 totalStake);
    event UnbondingStarted(address indexed validator, uint256 amount, uint64 readyAt);
    event UnbondingCompleted(address indexed validator, uint256 amount);
    event ValidatorSlashed(address indexed validator, uint256 amount, uint256 remainingStake);

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

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        uint256 remaining = cap - totalMinted;
        if (amount > remaining) revert CapExceeded(amount, remaining);
        totalMinted += amount;
        _mint(to, amount);
        emit Minted(to, amount);
    }

    function bridgeBurn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        _burn(from, amount);
        emit BridgeBurned(from, amount);
    }

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

    function mintValidatorReward(address validator, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        uint256 remaining = cap - totalMinted;
        if (amount > remaining) revert CapExceeded(amount, remaining);
        totalMinted += amount;
        _mint(validator, amount);
        emit Minted(validator, amount);
    }

    function remainingCap() external view returns (uint256) {
        return cap - totalMinted;
    }

    function getValidator(address validator)
        external
        view
        returns (uint256 staked, uint256 unbonding, uint64 unbondingReadyAt, bool active)
    {
        Validator storage v = _validators[validator];
        return (v.staked, v.unbonding, v.unbondingReadyAt, v.active);
    }

    function validatorCount() external view returns (uint256) {
        return validatorRegistry.length;
    }
}
