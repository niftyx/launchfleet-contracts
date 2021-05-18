// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Pool.sol";
import "./IPoolFactory.sol";

contract PoolFactory is Initializable, OwnableUpgradeable, IPoolFactory {
    uint256 public poolsCount;
    address[] public pools;
    mapping(address => bool) public isPool;

    // usds for launch holder participants
    IERC20 public baseToken;
    uint256 public baseAmount;

    // fee
    address public feeRecipient;
    uint256 public feePercent; // 10: 1%, 15: 1.5%

    function initialize(
        IERC20 _baseToken,
        uint256 _baseAmount,
        address _feeRecipient,
        uint256 _feePercent
    ) external initializer {
        require(_baseAmount > 0, "BaseAmount should be greater than 0!");
        OwnableUpgradeable.__Ownable_init();
        baseToken = _baseToken;
        baseAmount = _baseAmount;
        feePercent = _feePercent;
        feeRecipient = _feeRecipient;
    }

    function updateFeeInfo(address _feeRecipient, uint256 _feePercent)
        external
        onlyOwner
    {
        feePercent = _feePercent;
        feeRecipient = _feeRecipient;
    }

    function updateBaseInfo(IERC20 _baseToken, uint256 _baseAmount)
        external
        onlyOwner
    {
        require(_baseAmount > 0, "BaseAmount should be greater than 0!");
        baseToken = _baseToken;
        baseAmount = _baseAmount;
    }

    function getFeeInfo() external view override returns (address, uint256) {
        return (feeRecipient, feePercent);
    }

    function getBaseInfo() external view override returns (IERC20, uint256) {
        return (baseToken, baseAmount);
    }

    function createPool(
        IERC20 token,
        uint256 tokenTarget,
        uint256 multiplier,
        address weiToken,
        uint256 minWei,
        uint256 maxWei,
        Pool.PoolType poolType,
        uint256 startTime,
        uint256 endTime,
        uint256 claimTime,
        string memory meta
    ) external returns (address) {
        require(tokenTarget > 0, "Token target can't be zero!");
        require(multiplier > 0, "Multiplier can't be zero!");
        require(minWei > 0, "minWei can't be zero!");
        require(maxWei > 0, "maxWei can't be zero!");
        require(minWei < maxWei, "minWei should be less than maxWei");
        require(startTime > block.timestamp, "You can't set past time!");
        require(startTime < endTime, "EndTime can't be earlier than startTime");
        require(endTime < claimTime, "ClaimTime can't be earlier than endTime");

        Pool pool =
            new Pool(
                address(this),
                token,
                tokenTarget,
                weiToken,
                multiplier,
                minWei,
                maxWei
            );

        pool.setBaseData(poolType, startTime, endTime, claimTime, meta);

        token.transferFrom(msg.sender, address(pool), tokenTarget);

        pools.push(address(pool));
        isPool[address(pool)] = true;

        pool.transferOwnership(msg.sender);

        poolsCount = poolsCount + 1;

        emit PoolCreated(address(pool), msg.sender);

        return address(pool);
    }
}
