// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title BDNS Airdrop
/// @author BlockDNS
/// @notice Merkle-distributed airdrop where each allocation unlocks partly at TGE and the rest linearly.
/// @dev Eligibility is a Merkle proof of `keccak256(abi.encodePacked(user, total))`, so the whole
///      allocation list stays off-chain and the contract never has to iterate over recipients. On top
///      of that split, `tgeBps` unlocks at genesis and the remainder accrues over {vestingDuration},
///      which keeps a single large recipient from dumping immediately. Claims are cumulative: each
///      call pays out only what has vested since the last one, so users choose their own cadence and
///      cannot claim twice for the same vesting.
contract BDNSAirdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Token distributed by this airdrop.
    IERC20 public immutable token;

    /// @notice Share of each allocation unlocked at TGE, in basis points.
    uint256 public immutable tgeBps;

    /// @notice Seconds over which the remainder of each allocation unlocks.
    uint256 public immutable vestingDuration;

    /// @notice Timestamp from which the post-TGE portion accrues; zero means deployment time.
    uint256 public immutable startTime;

    /// @notice Last timestamp claims are accepted; zero disables the deadline.
    uint256 public immutable claimDeadline;

    /// @notice Root of the eligibility Merkle tree.
    bytes32 public merkleRoot;

    /// @notice Total BDNS paid out across all claims.
    uint256 public totalDistributed;

    /// @notice Cumulative amount already claimed per address.
    mapping(address => uint256) public claimed;

    /// @notice The zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice An empty Merkle root, an out-of-range TGE share, or a zero vesting duration was supplied.
    error InvalidConfig();

    /// @notice The supplied Merkle proof does not match {merkleRoot} for this allocation.
    error InvalidProof();

    /// @notice {claimDeadline} has passed.
    error ClaimWindowClosed();

    /// @notice {withdrawUnclaimed} was called before the claim deadline.
    error DeadlineNotReached();

    /// @notice Nothing is available to claim, or the balance is already empty.
    error NothingToClaim();

    /// @notice Emitted on each claim; `totalClaimed` is the user's cumulative total.
    event Claimed(address indexed user, uint256 amount, uint256 totalClaimed);

    /// @notice Emitted when the eligibility root is replaced.
    event MerkleRootUpdated(bytes32 indexed root);

    /// @param _token Token to distribute; must be non-zero.
    /// @param _owner Owner allowed to rotate the root and recover unclaimed funds.
    /// @param _merkleRoot Root of the allocation tree; must be non-zero.
    /// @param _tgeBps Basis-point share unlocked at TGE; at most 10000.
    /// @param _vestingDuration Seconds over which the remainder unlocks; must be non-zero.
    /// @param _startTime Vesting start; zero means the deployment block.
    /// @param _claimDeadline Last claim timestamp; zero means claims never close.
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

    /// @notice Replaces the eligibility root.
    /// @dev The root must stay non-zero, so the airdrop can never be bricked into "nobody eligible".
    ///      Allocations already claimed are unaffected because {claimed} is per address.
    /// @param _root New Merkle root.
    function setMerkleRoot(bytes32 _root) external onlyOwner {
        if (_root == bytes32(0)) revert InvalidConfig();
        merkleRoot = _root;
        emit MerkleRootUpdated(_root);
    }

    /// @notice Whether a Merkle proof proves this allocation for this address.
    /// @param user Address being checked.
    /// @param total Allocation the proof is for; it is part of the leaf, so the amount is bound.
    /// @param proof Merkle path from leaf to root.
    /// @return True when the allocation is eligible.
    function isEligible(address user, uint256 total, bytes32[] calldata proof)
        public
        view
        returns (bool)
    {
        bytes32 leaf = keccak256(abi.encodePacked(user, total));
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    /// @notice Vested portion of an allocation at an arbitrary timestamp.
    /// @param total Full allocation for the recipient.
    /// @param time Timestamp to evaluate.
    /// @return Amount vested by `time`, combining the TGE share with linear accrual.
    function computeClaimable(uint256 total, uint256 time) public view returns (uint256) {
        uint256 tgePart = (total * tgeBps) / 10_000;
        if (time <= startTime) return tgePart;
        uint256 vested = total - tgePart;
        uint256 elapsed = time - startTime;
        if (elapsed >= vestingDuration) return total;
        return tgePart + (vested * elapsed) / vestingDuration;
    }

    /// @notice Amount an address could claim right now, or 0 when not eligible.
    /// @param user Address to quote for.
    /// @param total Allocation to quote against.
    /// @param proof Merkle path for `user` and `total`.
    /// @return Claimable amount net of what has already been paid.
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

    /// @notice Claims the vested portion of the caller's allocation.
    /// @dev Reverts when the deadline passed, the proof is invalid, or nothing new has vested.
    ///      Only the delta since the last claim is transferred, and `claimed` is updated before the
    ///      transfer.
    /// @param total Full allocation for the caller.
    /// @param proof Merkle path for `msg.sender` and `total`.
    /// @return amount Transferred to the caller.
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

    /// @notice Sweeps allocations nobody claimed, once the claim window has closed.
    /// @dev Requires {claimDeadline} to be set and reached, so airdrop funds cannot be pulled while
    ///      recipients still have a live claim.
    /// @param to Address that receives the unclaimed balance.
    function withdrawUnclaimed(address to) external onlyOwner {
        if (claimDeadline == 0 || block.timestamp < claimDeadline) revert DeadlineNotReached();
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToClaim();
        token.safeTransfer(to, balance);
    }

    /// @notice Recovers an unrelated token accidentally sent to the airdrop.
    /// @param _token Token to sweep; must not be the distributed token.
    function recoverTokens(address _token) external onlyOwner {
        if (_token == address(token)) revert NothingToClaim();
        IERC20(_token).safeTransfer(owner(), IERC20(_token).balanceOf(address(this)));
    }
}