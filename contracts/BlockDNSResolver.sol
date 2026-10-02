// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BlockDNSRegistry} from "./BlockDNSRegistry.sol";

/// @title BlockDNS Resolver
/// @author BlockDNS
/// @notice Read-only facade over {BlockDNSRegistry} that wallets, dapps and the HTTP gateway call.
/// @dev Every function resolves the name to a token id first and reverts with {NameNotFound}
///      instead of returning empty data, so callers never have to guess whether a zero result means
///      "unregistered" or "not set yet". Results are read straight from chain storage, so resolving
///      a name needs no trusted intermediary.
contract BlockDNSResolver is Ownable {
    /// @notice Registry that holds the names and their records.
    BlockDNSRegistry public registry;

    /// @notice Everything a client needs to serve a name.
    /// @param owner Current owner of the domain NFT.
    /// @param tokenId Domain token id.
    /// @param name Normalized name.
    /// @param ipfsCID Content pointer currently published for the name.
    struct ResolvedName {
        address owner;
        uint256 tokenId;
        string name;
        string ipfsCID;
    }

    /// @notice The name has never been registered.
    error NameNotFound(string name);

    /// @notice The zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice Emitted when the resolver is pointed at a different registry.
    event RegistryUpdated(address registry);

    /// @param admin Address that receives resolver ownership.
    /// @param _registry Registry to resolve against; must be non-zero.
    constructor(address admin, address _registry) Ownable(admin) {
        if (_registry == address(0)) revert ZeroAddress();
        registry = BlockDNSRegistry(_registry);
    }

    /// @notice Points the resolver at a different registry.
    /// @param _registry New registry address; must be non-zero.
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = BlockDNSRegistry(_registry);
        emit RegistryUpdated(_registry);
    }

    /// @notice Token id of a registered name.
    /// @param name Name to resolve; normalized before lookup.
    /// @return tokenId Token id of the domain.
    function resolveTokenId(string calldata name) public view returns (uint256 tokenId) {
        tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
    }

    /// @notice Owner of a name, derived from the domain NFT.
    /// @param name Name to resolve.
    /// @return owner Address currently holding the domain token.
    function ownerOfName(string calldata name) external view returns (address owner) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        owner = registry.ownerOf(tokenId);
    }

    /// @notice Content pointer published for a name.
    /// @param name Name to resolve.
    /// @return cid IPFS CID stored for the domain.
    function resolveIPFS(string calldata name) external view returns (string memory cid) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        cid = registry.ipfsCIDOf(tokenId);
    }

    /// @notice Wallet address registered for a chain key.
    /// @param name Name to resolve.
    /// @param chain Chain key, e.g. `eth`, `btc` or `sol`.
    /// @return addr Stored address, or an empty string when the record is unset.
    function resolveAddress(string calldata name, string calldata chain) external view returns (string memory addr) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        addr = registry.addressRecords(tokenId, chain);
    }

    /// @notice Custom TXT record registered for a name.
    /// @param name Name to resolve.
    /// @param key TXT key to read.
    /// @return value Stored value, or an empty string when the record is unset.
    function resolveTXT(string calldata name, string calldata key) external view returns (string memory value) {
        uint256 tokenId = registry.resolveName(name);
        if (tokenId == 0) revert NameNotFound(name);
        value = registry.customTXTRecords(tokenId, key);
    }

    /// @notice Resolves owner, token id, name and CID in a single call, so a gateway can answer
    ///         one request instead of four.
    /// @param name Name to resolve.
    /// @return resolved The packed result.
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