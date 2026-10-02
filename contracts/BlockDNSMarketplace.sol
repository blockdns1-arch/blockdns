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

/// @title BlockDNS Marketplace
/// @author BlockDNS
/// @notice Escrow marketplace where `.bdns` names trade for BDNS.
/// @dev Listed NFTs are custodied by this contract, so a sale cannot be blocked by a seller who
///      changes their mind after listing. The protocol fee is expressed in basis points and is
///      hard-capped at {MAX_FEE_BPS} (5%) so the owner can never raise it to an abusive level;
///      fees go to the {royaltySplitter} when one is configured, otherwise straight to {treasury}.
contract BlockDNSMarketplace is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    /// @notice Basis-point denominator used for fee math (10000 = 100%).
    uint256 public constant FEE_DENOMINATOR = 10000;

    /// @notice Highest protocol fee the owner may configure, in basis points (5%).
    uint16 public constant MAX_FEE_BPS = 500;

    /// @notice ERC-721 registry holding the domain NFTs being traded.
    IERC721 public immutable registry;

    /// @notice ERC-20 token used for settlement.
    IERC20 public immutable bdns;

    /// @notice Recipient of protocol fees when no {royaltySplitter} is set.
    address public treasury;

    /// @notice Current protocol fee in basis points; never above {MAX_FEE_BPS}.
    uint16 public feeBps;

    /// @notice Optional splitter contract that distributes fees; when unset, fees go to {treasury}.
    address public royaltySplitter;

    /// @notice An active listing.
    /// @param tokenId Domain token id being sold.
    /// @param seller Original owner, who receives the proceeds.
    /// @param price Ask price in BDNS.
    /// @param active True while the listing is live.
    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    /// @notice tokenId => listing.
    mapping(uint256 => Listing) public listings;

    /// @notice Live listing ids; kept packed so removal is cheap and enumeration is on-chain.
    uint256[] public listingIds;

    /// @dev tokenId => index inside {listingIds}, so {delist} and {buy} stay O(1).
    mapping(uint256 => uint256) private _listingIndex;

    /// @notice The zero address was supplied where a real address is required.
    error ZeroAddress();

    /// @notice A listing was created with a zero price.
    error ZeroPrice();

    /// @notice A fee above {MAX_FEE_BPS} was requested.
    error InvalidFee();

    /// @notice The token is already listed and must be delisted first.
    error AlreadyListed(uint256 tokenId);

    /// @notice The token has no live listing.
    error NotActive(uint256 tokenId);

    /// @notice Caller is not the seller of this listing.
    error NotSeller(uint256 tokenId);

    /// @notice {updatePrice} was called with the price the listing already has.
    error PriceNotChanged();

    /// @notice Emitted when a seller escrows a domain and sets an ask.
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);

    /// @notice Emitted when the seller changes the ask.
    event PriceUpdated(uint256 indexed tokenId, uint256 price);

    /// @notice Emitted when a listing is cancelled and the NFT returns to the seller.
    event Delisted(uint256 indexed tokenId, address indexed seller);

    /// @notice Emitted on settlement; `fee` is the protocol cut in BDNS.
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 fee);

    /// @notice Emitted when the protocol fee changes.
    event FeeUpdated(uint16 feeBps);

    /// @notice Emitted when the treasury changes.
    event TreasuryUpdated(address treasury);

    /// @notice Emitted when the royalty splitter is set or cleared.
    event RoyaltySplitterUpdated(address splitter);

    /// @param _registry ERC-721 registry contract.
    /// @param _bdns ERC-20 settlement token.
    /// @param _treasury Initial fee recipient.
    /// @param _feeBps Initial protocol fee in basis points; must be at most {MAX_FEE_BPS}.
    constructor(address _registry, address _bdns, address _treasury, uint16 _feeBps) Ownable(msg.sender) {
        if (_registry == address(0) || _bdns == address(0)) revert ZeroAddress();
        registry = IERC721(_registry);
        bdns = IERC20(_bdns);
        _setTreasury(_treasury);
        _setFeeBps(_feeBps);
    }

    /// @notice Escrows the caller's domain and lists it for sale.
    /// @dev The NFT is transferred into this contract, so `ownerOf` no longer reports the seller
    ///      while the listing is live.
    /// @param tokenId Domain token id to sell.
    /// @param price Ask price in BDNS; must be non-zero.
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

    /// @notice Changes the ask on a live listing.
    /// @param tokenId Domain token id.
    /// @param price New ask in BDNS; must be non-zero and different from the current price.
    function updatePrice(uint256 tokenId, uint256 price) external nonReentrant {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotActive(tokenId);
        if (l.seller != msg.sender) revert NotSeller(tokenId);
        if (price == 0) revert ZeroPrice();
        if (price == l.price) revert PriceNotChanged();
        l.price = price;
        emit PriceUpdated(tokenId, price);
    }

    /// @notice Cancels a live listing and returns the NFT to the seller.
    /// @param tokenId Domain token id.
    function delist(uint256 tokenId) external nonReentrant {
        Listing storage l = listings[tokenId];
        if (!l.active) revert NotActive(tokenId);
        if (l.seller != msg.sender) revert NotSeller(tokenId);
        _removeListing(tokenId);
        registry.safeTransferFrom(address(this), msg.sender, tokenId);
        emit Delisted(tokenId, msg.sender);
    }

    /// @notice Buys a live listing: pays the seller, routes the fee, and transfers the NFT to the buyer.
    /// @dev The listing is cleared before any external call and the whole function is
    ///      `nonReentrant`. Buyer must have approved this contract for `price` BDNS.
    /// @param tokenId Domain token id to buy.
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

    /// @notice Number of live listings.
    /// @return Size of {listingIds}.
    function listingCount() external view returns (uint256) {
        return listingIds.length;
    }

    /// @notice Paginates listing ids so front ends can page through inventory on-chain.
    /// @param start First index to read.
    /// @param end Exclusive upper bound; clamped to the number of live listings.
    /// @return ids Listing ids in `[start, end)`, empty when the range is out of bounds.
    function listingIdsAt(uint256 start, uint256 end) external view returns (uint256[] memory ids) {
        uint256 len = listingIds.length;
        if (end > len) end = len;
        if (start >= end) return new uint256[](0);
        ids = new uint256[](end - start);
        for (uint256 i = start; i < end; i++) {
            ids[i - start] = listingIds[i];
        }
    }

    /// @notice Reads a single listing.
    /// @param tokenId Domain token id.
    /// @return tokenId Echoed token id.
    /// @return seller Listing seller.
    /// @return price Ask price in BDNS.
    /// @return active Whether the listing is live.
    function getListing(uint256 tokenId)
        external
        view
        returns (uint256, address, uint256, bool)
    {
        Listing memory l = listings[tokenId];
        return (l.tokenId, l.seller, l.price, l.active);
    }

    /// @notice Accepts escrow deposits from the registry so listed NFTs can be custodied here.
    /// @return The ERC-721 receiver magic value.
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Sets the fee recipient used when no {royaltySplitter} is configured.
    /// @param _treasury New treasury; must be non-zero.
    function setTreasury(address _treasury) external onlyOwner {
        _setTreasury(_treasury);
    }

    /// @notice Updates the protocol fee.
    /// @param _feeBps New fee in basis points; must not exceed {MAX_FEE_BPS}.
    function setFeeBps(uint16 _feeBps) external onlyOwner {
        _setFeeBps(_feeBps);
    }

    /// @notice Routes fees through a splitter contract that calls `split()` on every sale.
    /// @param _splitter Splitter address, or the zero address to send fees to {treasury}.
    function setRoyaltySplitter(address _splitter) external onlyOwner {
        royaltySplitter = _splitter;
        emit RoyaltySplitterUpdated(_splitter);
    }

    /// @dev Applies and announces a new treasury.
    /// @param _treasury New treasury; must be non-zero.
    function _setTreasury(address _treasury) internal {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @dev Applies and announces a new fee, enforcing the {MAX_FEE_BPS} ceiling.
    /// @param _feeBps New fee in basis points.
    function _setFeeBps(uint16 _feeBps) internal {
        if (_feeBps > MAX_FEE_BPS) revert InvalidFee();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    /// @dev Deletes a listing and swaps the removed id with the last one, keeping {listingIds} packed.
    ///      `_listingIndex` is rewritten for the moved entry so lookups stay correct.
    /// @param tokenId Domain token id whose listing is being closed.
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