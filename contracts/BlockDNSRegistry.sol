// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {BlockDNSPricer} from "./BlockDNSPricer.sol";

contract BlockDNSRegistry is ERC721, ERC721Enumerable, Ownable, ERC2981 {
    string public constant EXTENSION = "bdns";
    uint256 public constant MAX_NAME_LENGTH = 63;

    uint256 private _tokenIdCounter;

    BlockDNSPricer public pricer;
    string public baseURI;

    mapping(string => uint256) private _nameToTokenId;
    mapping(uint256 => string) public nameOf;
    mapping(uint256 => string) public ipfsCIDOf;
    mapping(uint256 => mapping(string => string)) public addressRecords;
    mapping(uint256 => mapping(string => string)) public customTXTRecords;

    error InvalidName();
    error NameTooShort();
    error NameTooLong();
    error NameAlreadyRegistered(string name);
    error NotDomainOwner(uint256 tokenId);
    error TokenDoesNotExist(uint256 tokenId);
    error EmptyValue();
    error ZeroAddress();

    event DomainRegistered(address indexed owner, uint256 indexed tokenId, string name);
    event IPFSRecordUpdated(uint256 indexed tokenId, string ipfsCID);
    event AddressRecordUpdated(uint256 indexed tokenId, string chain, string addr);
    event CustomTXTUpdated(uint256 indexed tokenId, string key, string value);
    event CustomTXTRemoved(uint256 indexed tokenId, string key);
    event PricerUpdated(address pricer);
    event BaseURIUpdated(string baseURI);

    constructor(address admin, string memory base) ERC721("BlockDNS Domains", "BDNSD") Ownable(admin) {
        if (admin == address(0)) revert ZeroAddress();
        baseURI = base;
        _setDefaultRoyalty(0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe, 250);
    }

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

    function setIPFSRecord(uint256 tokenId, string calldata cid) external {
        _checkDomainOwner(tokenId);
        if (bytes(cid).length == 0) revert EmptyValue();
        ipfsCIDOf[tokenId] = cid;
        emit IPFSRecordUpdated(tokenId, cid);
    }

    function setAddressRecord(uint256 tokenId, string calldata chain, string calldata addr) external {
        _checkDomainOwner(tokenId);
        if (bytes(chain).length == 0) revert EmptyValue();
        addressRecords[tokenId][chain] = addr;
        emit AddressRecordUpdated(tokenId, chain, addr);
    }

    function setCustomTXT(uint256 tokenId, string calldata key, string calldata value) external {
        _checkDomainOwner(tokenId);
        if (bytes(key).length == 0) revert EmptyValue();
        customTXTRecords[tokenId][key] = value;
        emit CustomTXTUpdated(tokenId, key, value);
    }

    function removeCustomTXT(uint256 tokenId, string calldata key) external {
        _checkDomainOwner(tokenId);
        if (bytes(key).length == 0) revert EmptyValue();
        delete customTXTRecords[tokenId][key];
        emit CustomTXTRemoved(tokenId, key);
    }

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

    function resolveName(string calldata rawName) public view returns (uint256 tokenId) {
        return _nameToTokenId[normalizeName(rawName)];
    }

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

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        return string(abi.encodePacked(baseURI, nameOf[tokenId]));
    }

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
