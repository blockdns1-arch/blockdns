// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title BlockDNS Pricer
/// @author BlockDNS
/// @notice Prices short, scarce `.bdns` names in BDNS and splits every payment between a burn and
///         the protocol treasury.
/// @dev Scarcity is length-based: names of {FREE_TIER_MIN_LENGTH} characters or more are free to
///      register, 3–4 characters cost {priceTier4} and 1–2 characters cost {priceTier2}. Half of
///      every premium is sent to the burn address and the other half to {treasury}, so demand
///      shrinks supply instead of only inflating the treasury.
contract BlockDNSPricer is Ownable {
    /// @notice BDNS token accepted for premium names.
    address public immutable bdns;

    /// @notice Recipient of the treasury half of every premium.
    address public immutable treasury;

    /// @notice Burn sink that permanently removes half of every premium payment.
    address public constant BURN_ADDRESS = address(0x000000000000000000000000000000000000dEaD);

    /// @notice Names at least this long register for free.
    uint256 public constant FREE_TIER_MIN_LENGTH = 5;

    /// @notice Price in BDNS for names of 1–2 characters.
    uint256 public priceTier2;

    /// @notice Price in BDNS for names of 3–4 characters.
    uint256 public priceTier4;

    /// @notice A zero address was supplied to the constructor.
    error ZeroAddress();

    /// @notice Emitted on each premium payment; `burned` and `treasuryAmount` always sum to `amount`.
    event PremiumPaid(address indexed payer, string name, uint256 amount, uint256 burned, uint256 treasuryAmount);

    /// @notice Emitted when both tiers are updated.
    event PricesUpdated(uint256 priceTier2, uint256 priceTier4);

    /// @param _owner Address allowed to update prices.
    /// @param _bdns BDNS token address; must be non-zero.
    /// @param _treasury Treasury address that receives half of each premium; must be non-zero.
    /// @param _priceTier2 Price for 1–2 character names.
    /// @param _priceTier4 Price for 3–4 character names.
    constructor(
        address _owner,
        address _bdns,
        address _treasury,
        uint256 _priceTier2,
        uint256 _priceTier4
    ) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_bdns == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        bdns = _bdns;
        treasury = _treasury;
        priceTier2 = _priceTier2;
        priceTier4 = _priceTier4;
    }

    /// @notice Price of a name, in BDNS. Zero means it is free.
    /// @param name Name to quote; only its length matters.
    /// @return price Tier price, or 0 for names of {FREE_TIER_MIN_LENGTH} characters or more.
    function priceOf(string calldata name) public view returns (uint256 price) {
        uint256 len = bytes(name).length;
        if (len <= 2) {
            price = priceTier2;
        } else if (len <= 4) {
            price = priceTier4;
        }
    }

    /// @notice Whether a name carries a premium.
    /// @param name Name to test.
    /// @return True when {priceOf} returns a non-zero price.
    function isPremium(string calldata name) external view returns (bool) {
        return priceOf(name) > 0;
    }

    /// @notice Collects the premium for `name` from `payer` and splits it burn/treasury.
    /// @dev Called by the registry during {registerDomain}; pulls BDNS with `transferFrom`, so the
    ///      payer must have approved this contract. Free names are a no-op.
    /// @param payer Address whose BDNS allowance is spent.
    /// @param name Name being registered.
    function payAndSplit(address payer, string calldata name) external {
        uint256 price = priceOf(name);
        if (price == 0) return;
        IERC20(bdns).transferFrom(payer, address(this), price);
        uint256 burnAmount = price / 2;
        uint256 treasuryAmount = price - burnAmount;
        IERC20(bdns).transfer(BURN_ADDRESS, burnAmount);
        IERC20(bdns).transfer(treasury, treasuryAmount);
        emit PremiumPaid(payer, name, price, burnAmount, treasuryAmount);
    }

    /// @notice Updates both premium tiers; set a tier to 0 to make that length free.
    /// @param _priceTier2 New price for 1–2 character names.
    /// @param _priceTier4 New price for 3–4 character names.
    function setPrices(uint256 _priceTier2, uint256 _priceTier4) external onlyOwner {
        priceTier2 = _priceTier2;
        priceTier4 = _priceTier4;
        emit PricesUpdated(_priceTier2, _priceTier4);
    }
}