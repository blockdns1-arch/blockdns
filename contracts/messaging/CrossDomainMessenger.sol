// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract CrossDomainMessenger is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    address public remoteMessenger;
    uint256 public messageNonce;
    mapping(bytes32 => bool) public relayedMessages;

    address private _xDomainMessageSender;
    bool private _initialized;

    event SentMessage(
        address indexed target,
        address indexed sender,
        address indexed remoteMessenger,
        uint256 value,
        bytes message,
        uint256 messageNonce,
        uint256 gasLimit
    );
    event RelayedMessage(
        bytes32 indexed messageHash,
        address indexed target,
        uint256 messageNonce,
        bool success
    );
    event RemoteMessengerUpdated(address remoteMessenger);

    error AlreadyInitialized();
    error ZeroAddress();
    error RemoteMessengerNotSet();
    error AlreadyRelayed(bytes32 messageHash);
    error NotRelaying();

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

    function setRemoteMessenger(address remote) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (remote == address(0)) revert ZeroAddress();
        remoteMessenger = remote;
        emit RemoteMessengerUpdated(remote);
    }

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

    function xDomainMessageSender() external view returns (address) {
        if (_xDomainMessageSender == address(0)) revert NotRelaying();
        return _xDomainMessageSender;
    }

    function version() external pure virtual returns (string memory);
}
