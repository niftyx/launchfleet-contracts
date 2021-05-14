pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LaunchToken is ERC20("Launchfleet", "LAUNCH"), Ownable {
    constructor() {
        _mint(msg.sender, 500000000 ether);
    }

    function burn(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }
}
