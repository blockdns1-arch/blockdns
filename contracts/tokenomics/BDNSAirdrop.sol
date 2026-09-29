// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract BDNSAirdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public immutable tgeBps;
    uint256 public immutable vestingDuration;
    uint256 public immutable startTime;
    uint256 public immutable claimDeadline;
    bytes32 public merkleRoot;

    uint256 public totalDistributed;
    mapping(address => uint256) public claimed;

    error ZeroAddress();
    error InvalidConfig();
    error InvalidProof();
    error ClaimWindowClosed();
    error DeadlineNotReached();
    error NothingToClaim();

    event Claimed(address indexed user, uint256 amount, uint256 totalClaimed);
    event MerkleRootUpdated(bytes32 indexed root);

    constructor(
        address _token,
        address _owner,
        bytes32 _merkleRoot,
        uint256 _tgeBps,
        uint256 _vestingDuration,
        uint256 _startTime,
        uint256 _claimDeadline
    ) Ownable(_owner) {
        if (_token == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        if (_merkleRoot == bytes32(0)) revert InvalidConfig();
        if (_tgeBps > 10_000) revert InvalidConfig();
        if (_vestingDuration == 0) revert InvalidConfig();
        token = IERC20(_token);
        merkleRoot = _merkleRoot;
        tgeBps = _tgeBps;
        vestingDuration = _vestingDuration;
        startTime = _startTime == 0 ? block.timestamp : _startTime;
        claimDeadline = _claimDeadline;
    }

    function setMerkleRoot(bytes32 _root) external onlyOwner {
        if (_root == bytes32(0)) revert InvalidConfig();
        merkleRoot = _root;
        emit MerkleRootUpdated(_root);
    }

    function isEligible(address user, uint256 total, bytes32[] calldata proof)
        public
        view
        returns (bool)
    {
        bytes32 leaf = keccak256(abi.encodePacked(user, total));
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    function computeClaimable(uint256 total, uint256 time) public view returns (uint256) {
        uint256 tgePart = (total * tgeBps) / 10_000;
        if (time <= startTime) return tgePart;
        uint256 vested = total - tgePart;
        uint256 elapsed = time - startTime;
        if (elapsed >= vestingDuration) return total;
        return tgePart + (vested * elapsed) / vestingDuration;
    }

    function pendingClaim(address user, uint256 total, bytes32[] calldata proof)
        external
        view
        returns (uint256)
    {
        if (!isEligible(user, total, proof)) return 0;
        uint256 available = computeClaimable(total, block.timestamp);
        if (available <= claimed[user]) return 0;
        return available - claimed[user];
    }

    function claim(uint256 total, bytes32[] calldata proof)
        external
        nonReentrant
        returns (uint256)
    {
        if (claimDeadline != 0 && block.timestamp > claimDeadline) revert ClaimWindowClosed();
        if (!isEligible(msg.sender, total, proof)) revert InvalidProof();

        uint256 available = computeClaimable(total, block.timestamp);
        uint256 already = claimed[msg.sender];
        if (available <= already) revert NothingToClaim();

        uint256 amount = available - already;
        claimed[msg.sender] = available;
        totalDistributed += amount;
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount, available);
        return amount;
    }

    function withdrawUnclaimed(address to) external onlyOwner {
        if (claimDeadline == 0 || block.timestamp < claimDeadline) revert DeadlineNotReached();
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToClaim();
        token.safeTransfer(to, balance);
    }

    function recoverTokens(address _token) external onlyOwner {
        if (_token == address(token)) revert NothingToClaim();
        IERC20(_token).safeTransfer(owner(), IERC20(_token).balanceOf(address(this)));
    }
}