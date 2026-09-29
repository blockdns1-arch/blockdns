// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRoyaltySplitter {
    function split() external;
}

contract BlockDNSMarketplace is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint16 public constant MAX_FEE_BPS = 500; // 5%

    IERC721 public immutable registry;
    IERC20 public immutable bdns;
    address public treasury;
    uint16 public feeBps;
    address public royaltySplitter;

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    uint256[] public listingIds;
    mapping(uint256 => uint256) private _listingIndex;

    error ZeroAddress();
    error ZeroPrice();
    error InvalidFee();
    error AlreadyListed(uint256 tokenId);
    error NotActive(uint256 tokenId);
    error NotSeller(uint256 tokenId);
    error PriceNotChanged();

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event PriceUpdated(uint256 indexed tokenId, uint256 price);
    event Delisted(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 fee);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);
    event RoyaltySplitterUpdated(address splitter);

    constructor(address _registry, address _bdns, address _treasury, uint16 _feeBps) Ownable(msg.sender) {
        if (_registry == address(0) || _bdns == address(0)) revert ZeroAddress();
        registry = IERC721(_registry);
        bdns = IERC20(_bdns);
        _setTreasury(_treasury);
        _setFeeBps(_feeBps);
    }

    function list(uint256 tokenId, uint256 price) external nonReentrant {
        if (registry.ownerOf(tokenId) != msg.sender) revert NotSeller(tokenId);
        if (price == 0) revert ZeroPrice();
        if (listings[tokenId].active) revert AlreadyListed(tokenId);

        registry.safeTransferFrom(msg.sender, address(this), tokenId);

        listings[tokenId] = Listing(tokenId, msg.sender, price, true);
        _listingIndex[tokenId] = listingIds.length;
        listingIds.push(tokenId);
        emit Listed(tokenId, msg.sender, price);
    }

    function updatePrice(uint256 tokenId, uint256 price) external nonReentrant {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotActive(tokenId);
        if (l.seller != msg.sender) revert NotSeller(tokenId);
        if (price == 0) revert ZeroPrice();
        if (price == l.price) revert PriceNotChanged();
        l.price = price;
        emit PriceUpdated(tokenId, price);
    }

    function delist(uint256 tokenId) external nonReentrant {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotActive(tokenId);
        if (l.seller != msg.sender) revert NotSeller(tokenId);
        _removeListing(tokenId);
        registry.safeTransferFrom(address(this), msg.sender, tokenId);
        emit Delisted(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external nonReentrant {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotActive(tokenId);

        address seller = l.seller;
        uint256 price = l.price;
        uint256 fee = (price * feeBps) / FEE_DENOMINATOR;
        uint256 net = price - fee;

        _removeListing(tokenId);

        if (net > 0) bdns.safeTransferFrom(msg.sender, seller, net);
        if (fee > 0) {
            address splitter = royaltySplitter;
            if (splitter != address(0)) {
                bdns.safeTransferFrom(msg.sender, splitter, fee);
                IRoyaltySplitter(splitter).split();
            } else {
                bdns.safeTransferFrom(msg.sender, treasury, fee);
            }
        }
        registry.safeTransferFrom(address(this), msg.sender, tokenId);

        emit Sold(tokenId, seller, msg.sender, price, fee);
    }

    function listingCount() external view returns (uint256) {
        return listingIds.length;
    }

    function listingIdsAt(uint256 start, uint256 end) external view returns (uint256[] memory ids) {
        uint256 len = listingIds.length;
        if (end > len) end = len;
        if (start >= end) return new uint256[](0);
        ids = new uint256[](end - start);
        for (uint256 i = start; i < end; i++) {
            ids[i - start] = listingIds[i];
        }
    }

    function getListing(uint256 tokenId)
        external
        view
        returns (uint256, address, uint256, bool)
    {
        Listing memory l = listings[tokenId];
        return (l.tokenId, l.seller, l.price, l.active);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function setTreasury(address _treasury) external onlyOwner {
        _setTreasury(_treasury);
    }

    function setFeeBps(uint16 _feeBps) external onlyOwner {
        _setFeeBps(_feeBps);
    }

    function setRoyaltySplitter(address _splitter) external onlyOwner {
        royaltySplitter = _splitter;
        emit RoyaltySplitterUpdated(_splitter);
    }

    function _setTreasury(address _treasury) internal {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function _setFeeBps(uint16 _feeBps) internal {
        if (_feeBps > MAX_FEE_BPS) revert InvalidFee();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function _removeListing(uint256 tokenId) internal {
        uint256 idx = _listingIndex[tokenId];
        uint256 lastTokenId = listingIds[listingIds.length - 1];
        listingIds[idx] = lastTokenId;
        _listingIndex[lastTokenId] = idx;
        listingIds.pop();
        delete listings[tokenId];
        delete _listingIndex[tokenId];
    }
}