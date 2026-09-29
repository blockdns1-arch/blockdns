// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BlockDNSPricer is Ownable {
    address public immutable bdns;
    address public immutable treasury;
    address public constant BURN_ADDRESS = address(0x000000000000000000000000000000000000dEaD);
    uint256 public constant FREE_TIER_MIN_LENGTH = 5;

    uint256 public priceTier2;
    uint256 public priceTier4;

    error ZeroAddress();

    event PremiumPaid(address indexed payer, string name, uint256 amount, uint256 burned, uint256 treasuryAmount);
    event PricesUpdated(uint256 priceTier2, uint256 priceTier4);

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

    function priceOf(string calldata name) public view returns (uint256 price) {
        uint256 len = bytes(name).length;
        if (len <= 2) {
            price = priceTier2;
        } else if (len <= 4) {
            price = priceTier4;
        }
    }

    function isPremium(string calldata name) external view returns (bool) {
        return priceOf(name) > 0;
    }

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

    function setPrices(uint256 _priceTier2, uint256 _priceTier4) external onlyOwner {
        priceTier2 = _priceTier2;
        priceTier4 = _priceTier4;
        emit PricesUpdated(_priceTier2, _priceTier4);
    }
}