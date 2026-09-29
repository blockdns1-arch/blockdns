// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CrossDomainMessenger} from "./CrossDomainMessenger.sol";

contract L1CrossDomainMessenger is CrossDomainMessenger {
    receive() external payable {}

    function version() external pure override returns (string memory) {
        return "L1CrossDomainMessenger:1.0.0";
    }
}
