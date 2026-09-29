// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BlockDNSRegistry} from "./BlockDNSRegistry.sol";

contract BlockDNSResolver is Ownable {
    BlockDNSRegistry public registry;

    struct ResolvedName {
        address owner;
        uint256 tokenId;
        string name;
        string ipfsCID;
    }

    error NameNotFound(string name);
    error ZeroAddress();

    event RegistryUpdated(address registry);

    constructor(address admin, address _registry) Ownable(admin) {
        if (_registry == address(0)) revert ZeroAddress();
        registry = BlockDNSRegistry(_registry);
    }

    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = BlockDNSRegistry(_registry);
        emit RegistryUpdated(_registry);
    }

    function resolveTokenId(string calldata name) public view returns (uint256 tokenId) {
        tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
    }

    function ownerOfName(string calldata name) external view returns (address owner) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        owner = registry.ownerOf(tokenId);
    }

    function resolveIPFS(string calldata name) external view returns (string memory cid) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        cid = registry.ipfsCIDOf(tokenId);
    }

    function resolveAddress(string calldata name, string calldata chain) external view returns (string memory addr) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        addr = registry.addressRecords(tokenId, chain);
    }

    function resolveTXT(string calldata name, string calldata key) external view returns (string memory value) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        value = registry.customTXTRecords(tokenId, key);
    }

    function resolveAll(string calldata name) external view returns (ResolvedName memory resolved) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        resolved = ResolvedName({
            owner: registry.ownerOf(tokenId),
            tokenId: tokenId,
            name: registry.nameOf(tokenId),
            ipfsCID: registry.ipfsCIDOf(tokenId)
        });
    }
}