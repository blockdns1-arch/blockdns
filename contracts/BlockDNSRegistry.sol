// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {BlockDNSPricer} from "./BlockDNSPricer.sol";

/// @title BlockDNS Registry
/// @author BlockDNS
/// @notice ERC-721 registry that turns a `.bdns` name into a non-expiring NFT.
/// @dev A name is normalized (lowercase, `a-z0-9-`, no leading/trailing hyphen, 1..{MAX_NAME_LENGTH} chars)
///      before it is hashed into the lookup table, so `Example` and `example` are the same name.
///      Each name can be minted exactly once; the token itself is what proves ownership, which is why
///      there is no renewal or expiry path. Resolvers read `resolveName` + `ipfsCIDOf` to serve content,
///      and wallets read `addressRecords` / `customTXTRecords` for the records attached to the name.
contract BlockDNSRegistry is ERC721, ERC721Enumerable, Ownable, ERC2981 {
    /// @notice TLD served by the BlockDNS gateway for this registry.
    string public constant EXTENSION = "bdns";

    /// @notice Maximum length of a name label, matching the DNS label limit.
    uint256 public constant MAX_NAME_LENGTH = 63;

    /// @dev Monotonic token counter; token ids start at 1 so that 0 can mean "unregistered".
    uint256 private _tokenIdCounter;

    /// @notice Optional pricing contract consulted on every {registerDomain} call.
    BlockDNSPricer public pricer;

    /// @notice Prefix used to build {tokenURI}; the name is appended to it.
    string public baseURI;

    /// @dev Normalized name => token id. A value of 0 means the name is free.
    mapping(string => uint256) private _nameToTokenId;

    /// @notice Token id => normalized name.
    mapping(uint256 => string) public nameOf;

    /// @notice Token id => IPFS CID that the gateway serves for this name.
    mapping(uint256 => string) public ipfsCIDOf;

    /// @notice Token id => chain key (e.g. `eth`, `btc`, `sol`) => address record.
    mapping(uint256 => mapping(string => string)) public addressRecords;

    /// @notice Token id => TXT key => value, for protocol metadata that is not DNS-specific.
    mapping(uint256 => mapping(string => string)) public customTXTRecords;

    /// @notice A character outside `a-z0-9-` was used in the name.
    error InvalidName();

    /// @notice The name was empty.
    error NameTooShort();

    /// @notice The name exceeded {MAX_NAME_LENGTH} characters.
    error NameTooLong();

    /// @notice The name has already been minted and can never be minted again.
    error NameAlreadyRegistered(string name);

    /// @notice Caller is not the owner of the domain token.
    error NotDomainOwner(uint256 tokenId);

    /// @notice The token id has never been minted.
    error TokenDoesNotExist(uint256 tokenId);

    /// @notice A record was written with an empty value.
    error EmptyValue();

    /// @notice The zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice Emitted when a new name is minted.
    event DomainRegistered(address indexed owner, uint256 indexed tokenId, string name);

    /// @notice Emitted when the content pointer of a domain changes.
    event IPFSRecordUpdated(uint256 indexed tokenId, string ipfsCID);

    /// @notice Emitted when an address record is set for a chain key.
    event AddressRecordUpdated(uint256 indexed tokenId, string chain, string addr);

    /// @notice Emitted when a custom TXT record is written.
    event CustomTXTUpdated(uint256 indexed tokenId, string key, string value);

    /// @notice Emitted when a custom TXT record is cleared.
    event CustomTXTRemoved(uint256 indexed tokenId, string key);

    /// @notice Emitted when the pricing contract is attached or replaced.
    event PricerUpdated(address pricer);

    /// @notice Emitted when the metadata base URI changes.
    event BaseURIUpdated(string baseURI);

    /// @param admin Address that receives protocol ownership.
    /// @param base Initial {baseURI} prefix for token metadata.
    constructor(address admin, string memory base) ERC721("BlockDNS Domains", "BDNSD") Ownable(admin) {
        if (admin == address(0)) revert ZeroAddress();
        baseURI = base;
        _setDefaultRoyalty(0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe, 250);
    }

    /// @notice Mints the normalized form of `rawName` to the caller and returns its token id.
    /// @dev When a {pricer} is configured and the name has a price, payment is collected and split
    ///      before the token is minted. Names at or above the pricer free tier cost nothing.
    /// @param rawName Name as typed by the user; normalized before storage.
    /// @return tokenId Id of the freshly minted domain NFT.
    function registerDomain(string calldata rawName) external returns (uint256 tokenId) {
        string memory name = normalizeName(rawName);
        if (_nameToTokenId[name] != 0) revert NameAlreadyRegistered(name);
        if (address(pricer) != address(0) && pricer.priceOf(name) > 0) {
            pricer.payAndSplit(msg.sender, name);
        }
        tokenId = ++_tokenIdCounter;
        _nameToTokenId[name] = tokenId;
        nameOf[tokenId] = name;
        _safeMint(msg.sender, tokenId);
        emit DomainRegistered(msg.sender, tokenId, name);
    }

    /// @notice Points the domain at an IPFS CID. Only the domain owner may call this.
    /// @param tokenId Domain token id.
    /// @param cid IPFS CID (or any content pointer the gateway can fetch) served for the name.
    function setIPFSRecord(uint256 tokenId, string calldata cid) external {
        _checkDomainOwner(tokenId);
        if (bytes(cid).length == 0) revert EmptyValue();
        ipfsCIDOf[tokenId] = cid;
        emit IPFSRecordUpdated(tokenId, cid);
    }

    /// @notice Stores a wallet address for a chain key on the domain (e.g. `eth`, `btc`, `sol`).
    /// @dev Only the domain owner may write records; gateways read them without an RPC round trip.
    /// @param tokenId Domain token id.
    /// @param chain Chain key the address belongs to.
    /// @param addr Address value stored for that chain.
    function setAddressRecord(uint256 tokenId, string calldata chain, string calldata addr) external {
        _checkDomainOwner(tokenId);
        if (bytes(chain).length == 0) revert EmptyValue();
        addressRecords[tokenId][chain] = addr;
        emit AddressRecordUpdated(tokenId, chain, addr);
    }

    /// @notice Writes a custom TXT-style record on the domain.
    /// @param tokenId Domain token id.
    /// @param key Record key; must be non-empty.
    /// @param value Record value.
    function setCustomTXT(uint256 tokenId, string calldata key, string calldata value) external {
        _checkDomainOwner(tokenId);
        if (bytes(key).length == 0) revert EmptyValue();
        customTXTRecords[tokenId][key] = value;
        emit CustomTXTUpdated(tokenId, key, value);
    }

    /// @notice Clears a custom TXT record previously set with {setCustomTXT}.
    /// @param tokenId Domain token id.
    /// @param key Record key to remove.
    function removeCustomTXT(uint256 tokenId, string calldata key) external {
        _checkDomainOwner(tokenId);
        if (bytes(key).length == 0) revert EmptyValue();
        delete customTXTRecords[tokenId][key];
        emit CustomTXTRemoved(tokenId, key);
    }

    /// @notice Validates and canonicalizes a name so lookups are case-insensitive.
    /// @dev Uppercase ASCII is lowercased; `a-z`, `0-9` and `-` are kept; anything else reverts.
    ///      A hyphen may not sit at either end of the label.
    /// @param rawName Name as supplied by the caller.
    /// @return normalized Canonical form used as the storage key.
    function normalizeName(string calldata rawName) public pure returns (string memory normalized) {
        bytes memory input = bytes(rawName);
        uint256 len = input.length;
        if (len == 0) revert NameTooShort();
        if (len > MAX_NAME_LENGTH) revert NameTooLong();
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            uint8 c = uint8(input[i]);
            if (c >= 0x41 && c <= 0x5A) {
                out[i] = bytes1(c + 0x20);
            } else if ((c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39) || c == 0x2D) {
                out[i] = input[i];
            } else {
                revert InvalidName();
            }
            if ((i == 0 || i == len - 1) && uint8(out[i]) == 0x2D) revert InvalidName();
        }
        return string(out);
    }

    /// @notice Looks up the token id of a name; this is the gateway's read path.
    /// @param rawName Name to resolve; normalized before the lookup.
    /// @return tokenId Token id of the domain, or 0 when the name is not registered.
    function resolveName(string calldata rawName) public view returns (uint256 tokenId) {
        return _nameToTokenId[normalizeName(rawName)];
    }

    /// @notice Convenience check for callers that only need availability.
    /// @param rawName Name to test.
    /// @return True when the name is already taken.
    function isRegistered(string calldata rawName) external view returns (bool) {
        return resolveName(rawName) != 0;
    }

    function setPricer(address _pricer) external onlyOwner {
        if (_pricer == address(0)) revert ZeroAddress();
        pricer = BlockDNSPricer(_pricer);
        emit PricerUpdated(_pricer);
    }

    function setBaseURI(string memory base) external onlyOwner {
        baseURI = base;
        emit BaseURIUpdated(base);
    }

    /// @notice Metadata URI of a domain NFT, composed as `{baseURI}{name}`.
    /// @param tokenId Domain token id.
    /// @return Metadata URI string.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        return string(abi.encodePacked(baseURI, nameOf[tokenId]));
    }

    /// @dev Reverts unless `msg.sender` owns the domain, so every record write is owner-gated.
    /// @param tokenId Domain token id to check.
    function _checkDomainOwner(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) != msg.sender) revert NotDomainOwner(tokenId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        virtual
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        virtual
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
