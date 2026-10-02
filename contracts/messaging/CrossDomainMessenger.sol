// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CrossDomainMessenger
/// @author BlockDNS
/// @notice Minimal cross-domain message transport shared by the L1 and L2 messengers.
/// @dev Sending is fully off-chain: {sendMessage} only emits an event, and a {RELAYER_ROLE}
///      operator picks it up and re-submits it with {relayMessage} on the destination chain. Each
///      message is hashed over `(this, remoteMessenger, target, sender, message, nonce)` and marked
///      relayed, so the same payload cannot be replayed. Replay protection is rolled back when the
///      target call fails, which lets a failed message be retried after the target is fixed.
///      Contracts authenticate the caller through {xDomainMessageSender} during the relay window,
///      which is what makes this safe to call with arbitrary calldata.
abstract contract CrossDomainMessenger is AccessControl {
    /// @notice Role allowed to submit inbound messages on the destination chain.
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    /// @notice Messenger address on the paired chain.
    address public remoteMessenger;

    /// @notice Monotonic counter of outbound messages, used as the replay-protection nonce.
    uint256 public messageNonce;

    /// @dev messageHash => whether it has been successfully executed on this chain.
    mapping(bytes32 => bool) public relayedMessages;

    /// @dev Sender address visible to the target while a message is being executed.
    address private _xDomainMessageSender;

    /// @dev Guards {initialize} against being called twice.
    bool private _initialized;

    /// @notice Emitted on the source chain; off-chain relays watch for this event.
    event SentMessage(
        address indexed target,
        address indexed sender,
        address indexed remoteMessenger,
        uint256 value,
        bytes message,
        uint256 messageNonce,
        uint256 gasLimit
    );

    /// @notice Emitted on the destination chain after a message executes; `success` reports the outcome.
    event RelayedMessage(
        bytes32 indexed messageHash,
        address indexed target,
        uint256 messageNonce,
        bool success
    );

    /// @notice Emitted when the paired messenger address changes.
    event RemoteMessengerUpdated(address remoteMessenger);

    /// @notice {initialize} has already run.
    error AlreadyInitialized();

    /// @notice The zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice {relayMessage} was called before {remoteMessenger} was configured.
    error RemoteMessengerNotSet();

    /// @notice This exact message has already been relayed successfully.
    error AlreadyRelayed(bytes32 messageHash);

    /// @notice {xDomainMessageSender} was read outside a relay.
    error NotRelaying();

    /// @notice One-time setup: grants roles and optionally sets the paired messenger.
    /// @dev Kept external rather than in a constructor so the same bytecode can be deployed on both
    ///      chains and initialized separately.
    /// @param admin Address receiving admin and relayer roles.
    /// @param remote Paired messenger; may be zero to set it later.
    function initialize(address admin, address remote) external {
        if (_initialized) revert AlreadyInitialized();
        if (admin == address(0)) revert ZeroAddress();
        _initialized = true;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
        if (remote != address(0)) {
            remoteMessenger = remote;
            emit RemoteMessengerUpdated(remote);
        }
    }

    /// @notice Points this messenger at the messenger on the paired chain.
    /// @param remote New remote messenger; must be non-zero.
    function setRemoteMessenger(address remote) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (remote == address(0)) revert ZeroAddress();
        remoteMessenger = remote;
        emit RemoteMessengerUpdated(remote);
    }

    /// @notice Announces an outbound message. Execution happens off-chain via {relayMessage}.
    /// @dev No state is written beyond the nonce, so this is a pure log and stays cheap. The relayer
    ///      needs `gasLimit` and `msg.value` from the event to reproduce the call.
    /// @param target Contract to call on the destination chain.
    /// @param message ABI-encoded calldata to execute there.
    /// @param gasLimit Gas to forward on the destination; 0 means "all remaining gas".
    /// @return nonce Nonce assigned to this message.
    function sendMessage(address target, bytes calldata message, uint256 gasLimit)
        external
        payable
        returns (uint256 nonce)
    {
        if (target == address(0)) revert ZeroAddress();
        nonce = messageNonce;
        unchecked {
            messageNonce = nonce + 1;
        }
        emit SentMessage(target, msg.sender, remoteMessenger, msg.value, message, nonce, gasLimit);
    }

    /// @notice Executes an inbound message on this chain. Callable only by {RELAYER_ROLE}.
    /// @dev Marks the message relayed before the external call, and clears that mark if the call
    ///      fails so the message stays retryable. Reverts if the message was already relayed.
    /// @param target Contract to call here.
    /// @param sender Original sender on the source chain.
    /// @param message ABI-encoded calldata to execute.
    /// @param nonce Nonce from the source-chain {SentMessage} event.
    /// @param gasLimit Gas to forward; 0 means "all remaining gas".
    function relayMessage(
        address target,
        address sender,
        bytes calldata message,
        uint256 nonce,
        uint256 gasLimit
    ) external payable onlyRole(RELAYER_ROLE) {
        if (remoteMessenger == address(0)) revert RemoteMessengerNotSet();
        bytes32 messageHash =
            keccak256(abi.encode(address(this), remoteMessenger, target, sender, message, nonce));
        if (relayedMessages[messageHash]) revert AlreadyRelayed(messageHash);
        relayedMessages[messageHash] = true;
        _xDomainMessageSender = sender;
        uint256 gas = gasLimit == 0 ? gasleft() : gasLimit;
        (bool success, ) = target.call{value: msg.value, gas: gas}(message);
        _xDomainMessageSender = address(0);
        emit RelayedMessage(messageHash, target, nonce, success);
        if (!success) {
            delete relayedMessages[messageHash];
        }
    }

    /// @notice Authenticates the cross-domain caller while a relayed message is executing.
    /// @dev Only valid inside {relayMessage}; reverts outside it, so contracts can safely compare it
    ///      against an allowlist to accept remote calls.
    /// @return Address that sent the message on the paired chain.
    function xDomainMessageSender() external view returns (address) {
        if (_xDomainMessageSender == address(0)) revert NotRelaying();
        return _xDomainMessageSender;
    }

    /// @notice Human-readable contract version, for off-chain tooling.
    /// @return Version string.
    function version() external pure virtual returns (string memory);
}
