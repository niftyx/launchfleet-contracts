// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IPoolFactory.sol";

contract Pool is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    enum PoolType {Private, BaseHolder, Public}

    mapping(address => bool) public whitelistedAddresses;

    IERC20 public token;
    uint256 public tokenTarget;

    address public weiToken;

    uint256 public multiplier;

    uint256 public startTime;
    uint256 public endTime;
    uint256 public claimTime;

    uint256 public minWei;
    uint256 public maxWei;

    PoolType poolType;

    string public meta;

    uint256 public totalOwed;
    mapping(address => uint256) public claimable;
    uint256 public weiRaised;

    address public factory;

    event PoolInitialized(
        address token,
        address weiToken,
        uint256 tokenTarget,
        uint256 multiplier,
        uint256 minWei,
        uint256 maxWei
    );

    event PoolBaseDataInitialized(
        Pool.PoolType poolType,
        uint256 startTime,
        uint256 endTime,
        uint256 claimTime,
        string meta
    );

    event MetaDataChanged(string meta);

    event PoolProgressChanged(uint256 totalOwed, uint256 weiRaised);

    constructor(
        address _factory,
        IERC20 _token,
        uint256 _tokenTarget,
        address _weiToken,
        uint256 _multiplier,
        uint256 _minWei,
        uint256 _maxWei
    ) {
        token = _token;
        tokenTarget = _tokenTarget;
        weiToken = _weiToken;
        multiplier = _multiplier;
        minWei = _minWei;
        maxWei = _maxWei;

        factory = _factory;

        emit PoolInitialized(
            address(token),
            weiToken,
            tokenTarget,
            multiplier,
            minWei,
            maxWei
        );
    }

    function setBaseData(
        PoolType _poolType,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _claimTime,
        string memory _meta
    ) external {
        require(startTime == uint256(0), "BaseData is already set!");
        poolType = _poolType;
        meta = _meta;
        startTime = _startTime;
        endTime = _endTime;
        claimTime = _claimTime;

        emit PoolBaseDataInitialized(
            poolType,
            startTime,
            endTime,
            claimTime,
            meta
        );
    }

    function setMeta(string memory _meta) external onlyOwner {
        require(
            startTime == 0 || block.timestamp < startTime,
            "Pool already started!"
        );
        meta = _meta;

        emit MetaDataChanged(meta);
    }

    function addWhitelistedAddress(address _address) external onlyOwner {
        whitelistedAddresses[_address] = true;
    }

    function addMultipleWhitelistedAddresses(address[] calldata _addresses)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < _addresses.length; i++) {
            whitelistedAddresses[_addresses[i]] = true;
        }
    }

    function removeWhitelistedAddress(address _address) external onlyOwner {
        whitelistedAddresses[_address] = false;
    }

    function claimableAmount(address user) external view returns (uint256) {
        return claimable[user].mul(multiplier);
    }

    function withdrawToken() external onlyOwner {
        require(block.timestamp > endTime, "Pool has not yet ended");
        token.transfer(
            msg.sender,
            token.balanceOf(address(this)).sub(totalOwed)
        );
    }

    function withdrawWei(uint256 amount) public payable onlyOwner {
        require(block.timestamp > endTime, "Pool has not yet ended");
        require(weiToken == address(0), "It's not eth-buy pool!");
        require(
            address(this).balance >= amount,
            "Can't withdraw more than you have."
        );
        (address feeRecipient, uint256 feePercent) =
            IPoolFactory(factory).getFeeInfo();
        uint256 fee = amount.mul(feePercent).div(1000);
        uint256 restAmount = amount.sub(fee);
        payable(feeRecipient).transfer(fee);
        payable(msg.sender).transfer(restAmount);
    }

    function withdrawWeiToken(uint256 amount) external onlyOwner {
        require(block.timestamp > endTime, "Pool has not yet ended");
        require(weiToken != address(0), "It's not token-buy pool!");
        require(
            IERC20(weiToken).balanceOf(address(this)) >= amount,
            "Can't withdraw more than you have."
        );
        (address feeRecipient, uint256 feePercent) =
            IPoolFactory(factory).getFeeInfo();
        uint256 fee = amount.mul(feePercent).div(1000);
        uint256 restAmount = amount.sub(fee);
        IERC20(weiToken).transfer(feeRecipient, fee);
        IERC20(weiToken).transfer(msg.sender, restAmount);
    }

    function claim() external {
        require(
            block.timestamp > claimTime && claimTime != 0,
            "claiming not allowed yet"
        );
        require(claimable[msg.sender] > 0, "nothing to claim");

        uint256 amount = claimable[msg.sender].mul(multiplier);

        claimable[msg.sender] = 0;
        totalOwed = totalOwed.sub(amount);

        require(token.transfer(msg.sender, amount), "failed to claim");
    }

    function checkBeforeBuy() private view {
        require(
            startTime != 0 && block.timestamp > startTime,
            "Pool has not yet started"
        );
        require(
            endTime != 0 && block.timestamp < endTime,
            "Pool already ended"
        );

        if (poolType == PoolType.Private) {
            require(
                whitelistedAddresses[msg.sender] == true,
                "you are not whitelisted"
            );
        } else if (poolType == PoolType.BaseHolder) {
            (IERC20 baseToken, uint256 baseAmount) =
                IPoolFactory(factory).getBaseInfo();
            require(
                baseToken.balanceOf(msg.sender) >= baseAmount,
                "You don't have enought TOKEN!"
            );
        }
    }

    function buyWithEth() public payable {
        require(weiToken == address(0), "It's not eth-buy pool!");
        checkBeforeBuy();
        require(msg.value >= minWei, "amount too low");
        uint256 amount = msg.value.mul(multiplier);
        require(
            totalOwed.add(amount) <= token.balanceOf(address(this)),
            "sold out"
        );

        require(
            claimable[msg.sender].add(msg.value) <= maxWei,
            "maximum purchase cap hit"
        );

        claimable[msg.sender] = claimable[msg.sender].add(msg.value);
        totalOwed = totalOwed.add(amount);
        weiRaised = weiRaised.add(msg.value);

        emit PoolProgressChanged(totalOwed, weiRaised);
    }

    function buy(uint256 weiAmount) public {
        require(weiToken != address(0), "It's not token-buy pool!");
        checkBeforeBuy();
        require(weiAmount >= minWei, "amount too low");

        uint256 amount = weiAmount.mul(multiplier);
        require(
            totalOwed.add(amount) <= token.balanceOf(address(this)),
            "sold out"
        );

        require(
            claimable[msg.sender].add(weiAmount) <= maxWei,
            "maximum purchase cap hit"
        );

        IERC20(weiToken).transferFrom(msg.sender, address(this), weiAmount);

        claimable[msg.sender] = claimable[msg.sender].add(weiAmount);
        totalOwed = totalOwed.add(amount);
        weiRaised = weiRaised.add(weiAmount);

        emit PoolProgressChanged(totalOwed, weiRaised);
    }

    fallback() external payable {
        buyWithEth();
    }

    receive() external payable {
        buyWithEth();
    }
}
