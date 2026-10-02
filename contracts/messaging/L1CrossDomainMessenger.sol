// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrossDomainMessenger} from "./CrossDomainMessenger.sol";

/// @title L1 Cross-Domain Messenger
/// @author BlockDNS
/// @notice {CrossDomainMessenger} instance deployed on the L1 side of the pair.
/// @dev Behaviour is entirely inherited; this contract exists so the deployment artifact and its
///      `version()` clearly identify which chain they belong to. It accepts native value because
///      relaying a message can carry ETH to a target on the same chain.
contract L1CrossDomainMessenger is CrossDomainMessenger {
    /// @notice Accepts native value so relayers can forward ETH with a message.
    receive() external payable {}

    /// @notice Version string reported to off-chain tooling.
    /// @return Version string.
    function version() external pure override returns (string memory) {
        return "L1CrossDomainMessenger:1.0.0";
    }
}
