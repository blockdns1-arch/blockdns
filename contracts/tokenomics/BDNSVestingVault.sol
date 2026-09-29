// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BDNSVestingVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint256 public immutable start;
    uint256 public immutable cliff;
    uint256 public immutable duration;

    uint256 public totalLocked;
    uint256 public released;

    error ZeroAddress();
    error InvalidSchedule();
    error NotBeneficiary();
    error NothingToRelease();

    event TokensLocked(address indexed source, uint256 amount);
    event TokensReleased(address indexed beneficiary, uint256 amount);

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

    function fund(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidSchedule();
        totalLocked += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit TokensLocked(msg.sender, amount);
    }

    function vestedAt(uint256 time) public view returns (uint256) {
        if (time < start + cliff) return 0;
        if (time >= start + cliff + duration) return totalLocked;
        uint256 elapsed = time - (start + cliff);
        return (totalLocked * elapsed) / duration;
    }

    function releasableAmount() external view returns (uint256) {
        uint256 vested = vestedAt(block.timestamp);
        return vested > released ? vested - released : 0;
    }

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