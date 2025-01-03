// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Pool.sol";

interface IPoolFactory {
    event PoolCreated(address indexed addr, address indexed creator);

    function getFeeInfo() external view returns (address, uint256);

    function getBaseInfo() external view returns (IERC20, uint256);
}
