// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrossDomainMessenger} from "./CrossDomainMessenger.sol";

contract L2CrossDomainMessenger is CrossDomainMessenger {
    function version() external pure override returns (string memory) {
        return "L2CrossDomainMessenger:1.0.0";
    }
}
