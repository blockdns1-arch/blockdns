// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrossDomainMessenger} from "./CrossDomainMessenger.sol";

/// @title L2 Cross-Domain Messenger
/// @author BlockDNS
/// @notice {CrossDomainMessenger} instance deployed on the L2 side of the pair.
/// @dev Mirrors {L1CrossDomainMessenger} but takes no native value, since the L2 side carries
///      token and message traffic rather than ETH.
contract L2CrossDomainMessenger is CrossDomainMessenger {
    /// @notice Version string reported to off-chain tooling.
    /// @return Version string.
    function version() external pure override returns (string memory) {
        return "L2CrossDomainMessenger:1.0.0";
    }
}
