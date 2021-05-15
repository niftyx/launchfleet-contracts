const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { expect } = chai;
const {
  ether,
  time,
  expectEvent,
  expectRevert,
} = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const {
  advanceBlock,
  advanceTime,
  advanceTimeAndBlock,
} = require("./helpers/utilsTest");

chai.use(solidity);

describe("PoolFactory", function () {
  let poolFactory;
  let baseToken;
  let testToken;
  let testWeiToken;

  let owner,
    testUser1,
    testUser2,
    testUser3,
    testUser4,
    testUser5,
    feeRecipient,
    feeRecipientAddress;

  let tokenPool;
  let privatePool, publicPool, basePool;

  let feePercent = new web3.utils.BN("5"); // 0.5%
  let baseAmount = ether("100");

  let tokenTarget = ether("10000");
  let multiplier = new web3.utils.BN("1000"); // 1ether = 1000 token
  let minWei = ether("0.1");
  let maxWei = ether("4.1");
  let startTime, endTime, claimTime;
  let poolDuration = 3600; // 1 hour from start
  let claimDuration = 600; // 10 mins after end
  let NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
  let poolMeta = "https://";

  before(async function () {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    testUser1 = accounts[1];
    testUser2 = accounts[2];
    testUser3 = accounts[3];
    testUser4 = accounts[4];
    testUser5 = accounts[5];
    feeRecipient = accounts[6];
    feeRecipientAddress = feeRecipient.address;

    upgrades.silenceWarnings();

    TestTokenFactory = await ethers.getContractFactory("TestToken");
    testToken = await TestTokenFactory.deploy();
    testWeiToken = await TestTokenFactory.deploy();
    baseToken = await TestTokenFactory.deploy();

    PoolFactoryFactory = await ethers.getContractFactory("PoolFactory");
    poolFactory = await upgrades.deployProxy(PoolFactoryFactory, [
      baseToken.address,
      baseAmount.toString(),
      feeRecipientAddress,
      feePercent.toString(),
    ]);
  });

  describe("Check Fee and BaseInfo of PoolFactory", function () {
    it("Check Fee Info", async function () {
      const [_feeRecipient, _feePercent] = await poolFactory.getFeeInfo();
      expect(_feeRecipient).to.equal(feeRecipientAddress);
      expect(_feePercent.toString()).to.equal(feePercent.toString());
    });
    it("Check Base Info", async function () {
      const [_baseToken, _baseAmount] = await poolFactory.getBaseInfo();
      expect(_baseToken).to.equal(baseToken.address);
      expect(_baseAmount.toString()).to.equal(baseAmount.toString());
    });
    it("Try to change fee info", async function () {
      let contract = poolFactory.connect(owner);
      await contract.updateFeeInfo(testUser1.address, baseAmount.toString());
      const [_feeRecipient, _feePercent] = await poolFactory.getFeeInfo();
      expect(_feeRecipient).to.equal(testUser1.address);
      expect(_feePercent.toString()).to.equal(baseAmount.toString());
      await contract.updateFeeInfo(feeRecipientAddress, feePercent.toString());
    });
    it("Try to change baseInfo info", async function () {
      let contract = poolFactory.connect(owner);
      await contract.updateBaseInfo(testToken.address, feePercent.toString());
      const [_baseToken, _baseAmount] = await poolFactory.getBaseInfo();
      expect(_baseToken).to.equal(testToken.address);
      expect(_baseAmount.toString()).to.equal(feePercent.toString());
      await contract.updateBaseInfo(baseToken.address, baseAmount.toString());
    });
    it("Try to change fee info from another account", async function () {
      let contract = poolFactory.connect(testUser1);
      await expect(
        contract.updateFeeInfo(feeRecipientAddress, feePercent.toString())
      ).to.be.revertedWith("caller is not the owner");
    });
    it("Try to change fee info from another account", async function () {
      let contract = poolFactory.connect(testUser1);
      await expect(
        contract.updateBaseInfo(baseToken.address, baseAmount.toString())
      ).to.be.revertedWith("caller is not the owner");
    });
  });

  describe("Send Token to TestUsers", function () {
    it("Send Base Token to TestUsers", async function () {
      baseToken.transfer(testUser1.address, ether("10000").toString());
      baseToken.transfer(testUser2.address, ether("10000").toString());
      baseToken.transfer(testUser3.address, ether("10000").toString());
      baseToken.transfer(testUser4.address, ether("10000").toString());
      // baseToken.transfer(testUser5.address, ether("10000").toString());
    });
    it("Send Test Token to TestUsers", async function () {
      testToken.transfer(testUser1.address, ether("10000").toString());
      testToken.transfer(testUser2.address, ether("10000").toString());
      testToken.transfer(testUser3.address, ether("10000").toString());
      testToken.transfer(testUser4.address, ether("10000").toString());
      testToken.transfer(testUser5.address, ether("10000").toString());
    });
    it("Send TestWei Token to TestUsers", async function () {
      testWeiToken.transfer(testUser1.address, ether("10000").toString());
      testWeiToken.transfer(testUser2.address, ether("10000").toString());
      testWeiToken.transfer(testUser3.address, ether("10000").toString());
      testWeiToken.transfer(testUser4.address, ether("10000").toString());
      testWeiToken.transfer(testUser5.address, ether("10000").toString());
    });
  });

  describe("Create Private Eth Pool and Check All", function () {
    it("Create private Eth pool and check config fields", async function () {
      const block = await web3.eth.getBlock("latest");
      startTime = block.timestamp + 1000;
      endTime = startTime + poolDuration;
      claimTime = endTime + claimDuration;

      await testToken.approve(poolFactory.address, tokenTarget.toString());

      const transaction = await poolFactory.createPool(
        testToken.address,
        tokenTarget.toString(),
        multiplier.toString(),
        NULL_ADDRESS,
        minWei.toString(),
        maxWei.toString(),
        0, // private
        startTime,
        endTime,
        claimTime,
        poolMeta
      );

      const createdAddress = await poolFactory.pools(0);
      privatePool = await ethers.getContractAt("Pool", createdAddress);

      expect(transaction)
        .to.emit(poolFactory, "PoolCreated")
        .withArgs(createdAddress, owner.address);
      expect(transaction).to.emit(privatePool, "PoolInitialized").withArgs(
        testToken.address,
        NULL_ADDRESS,
        tokenTarget.toString(),
        multiplier.toString(),

        minWei.toString(),
        maxWei.toString()
      );
      expect(transaction)
        .to.emit(privatePool, "PoolBaseDataInitialized")
        .withArgs(0, startTime, endTime, claimTime, poolMeta);

      const tokenBalance = await testToken.balanceOf(privatePool.address);
      expect(tokenBalance.toString()).to.equal(tokenTarget.toString());
    });

    it("Try to setBaseData", async function () {
      await expect(
        privatePool.setBaseData(0, startTime, endTime, claimTime, poolMeta)
      ).to.be.revertedWith("BaseData is already set!");
    });

    it("Check setMeta", async function () {
      await privatePool.setMeta(poolMeta);
      const contract = privatePool.connect(testUser1);
      await expect(contract.setMeta("https://")).to.be.revertedWith(
        "caller is not the owner"
      );
    });

    it("Add whitelist", async function () {
      await privatePool.addWhitelistedAddress(testUser1.address);
      await privatePool.addMultipleWhitelistedAddresses([
        testUser2.address,
        testUser3.address,
        testUser4.address,
      ]);
      await privatePool.removeWhitelistedAddress(testUser3.address);

      const contract = privatePool.connect(testUser1);
      await expect(
        contract.addWhitelistedAddress(testUser3.address)
      ).to.be.revertedWith("caller is not the owner");
      await expect(
        contract.addMultipleWhitelistedAddresses([testUser3.address])
      ).to.be.revertedWith("caller is not the owner");
    });

    it("Try buying", async function () {
      const contract = privatePool.connect(testUser1);

      await expect(
        contract.buyWithEth({ value: ether("1").toString() })
      ).to.be.revertedWith("Pool has not yet started");

      await expect(contract.buy(ether("1").toString())).to.be.revertedWith(
        "It's not token-buy pool!"
      );
    });

    it("Advance Time to start Pool and buy", async function () {
      const contract = privatePool.connect(testUser1);
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = startTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
      await contract.buyWithEth({ value: ether("3").toString() });

      const claimableAmount = await contract.claimableAmount(testUser1.address);
      expect(claimableAmount.toString()).to.equal(
        ether("3").mul(multiplier).toString()
      );
    });

    it("Try to setMeta", async function () {
      await expect(privatePool.setMeta(poolMeta)).to.be.revertedWith(
        "Pool already started!"
      );
    });

    it("Try to buy from not-whitelisted address", async function () {
      const contract = privatePool.connect(testUser3);
      await expect(
        contract.buyWithEth({ value: ether("1").toString() })
      ).to.be.revertedWith("you are not whitelisted");
    });

    it("Try to buy with low amount", async function () {
      const contract = privatePool.connect(testUser1);
      await expect(
        contract.buyWithEth({ value: ether("0.01").toString() })
      ).to.be.revertedWith("amount too low");
    });

    it("Hit purchase cap hit", async function () {
      const contract = privatePool.connect(testUser1);
      await expect(
        contract.buyWithEth({ value: ether("5").toString() })
      ).to.be.revertedWith("maximum purchase cap hit");
    });
    it("Hit sold out", async function () {
      const contract = privatePool.connect(testUser2);
      contract.buyWithEth({ value: ether("4").toString() });

      const contract1 = privatePool.connect(testUser4);
      await expect(
        contract1.buyWithEth({ value: ether("4").toString() })
      ).to.be.revertedWith("sold out");
    });

    it("Try to withdraw before endTime", async function () {
      await expect(privatePool.withdrawToken()).to.be.revertedWith(
        "Pool has not yet ended"
      );
      await expect(
        privatePool.withdrawWei(ether("100").toString())
      ).to.be.revertedWith("Pool has not yet ended");
      await expect(
        privatePool.withdrawWeiToken(ether("100").toString())
      ).to.be.revertedWith("Pool has not yet ended");
    });

    it("Advance time to endTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = endTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Try to buy after it's finished", async function () {
      const contract = privatePool.connect(testUser1);
      await expect(
        contract.buyWithEth({ value: ether("1").toString() })
      ).to.be.revertedWith("Pool already ended");
    });

    it("Try to claim before claimTime", async function () {
      const contract = privatePool.connect(testUser1);
      await expect(contract.claim()).to.be.revertedWith(
        "claiming not allowed yet"
      );
    });

    it("Advance time to claimTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = claimTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Try to claim with non-buy account", async function () {
      const contract = privatePool.connect(owner);
      await expect(contract.claim()).to.be.revertedWith("nothing to claim");
    });

    it("Claim and check event", async function () {
      const contract = privatePool.connect(testUser1);
      const transaction = await contract.claim();
      expect(transaction)
        .to.emit(testToken, "Transfer")
        .withArgs(
          privatePool.address,
          testUser1.address,
          ether("3000").toString()
        );
    });

    it("Claim from all users", async function () {
      await privatePool.connect(testUser2).claim();
    });

    it("Withdraw and check fee is correct", async function () {
      const restToken = await testToken.balanceOf(privatePool.address);
      const transaction = await privatePool.withdrawToken();

      expect(transaction)
        .to.emit(testToken, "Transfer")
        .withArgs(privatePool.address, owner.address, restToken.toString());

      await expect(
        privatePool.withdrawWeiToken(ether("30").toString())
      ).to.be.revertedWith("It's not token-buy pool!");

      await expect(
        privatePool.withdrawWei(ether("10").toString())
      ).to.be.revertedWith("Can't withdraw more than you have.");

      const ethBalance = await web3.eth.getBalance(privatePool.address);

      const recipientBalance = await web3.eth.getBalance(feeRecipientAddress);

      await privatePool.withdrawWei(ethBalance.toString());

      const newRecipientBalance = await web3.eth.getBalance(
        feeRecipientAddress
      );

      const receiptBalanceDif = new web3.utils.BN(
        newRecipientBalance.toString()
      ).sub(new web3.utils.BN(recipientBalance.toString()));

      expect(receiptBalanceDif.toString()).to.equal(
        new web3.utils.BN(ethBalance.toString())
          .mul(feePercent)
          .div(new web3.utils.BN("1000"))
          .toString()
      );
    });
  });

  describe("Create Public Eth Pool and check the flow", function () {
    it("Create Public Eth pool and check config fields", async function () {
      const block = await web3.eth.getBlock("latest");
      startTime = block.timestamp + 1000;
      endTime = startTime + poolDuration;
      claimTime = endTime + claimDuration;

      await testToken.approve(poolFactory.address, tokenTarget.toString());

      const transaction = await poolFactory.createPool(
        testToken.address,
        tokenTarget.toString(),
        multiplier.toString(),
        NULL_ADDRESS,
        minWei.toString(),
        maxWei.toString(),
        2, // public
        startTime,
        endTime,
        claimTime,
        poolMeta
      );

      const createdAddress = await poolFactory.pools(1);
      publicPool = await ethers.getContractAt("Pool", createdAddress);

      expect(transaction)
        .to.emit(poolFactory, "PoolCreated")
        .withArgs(createdAddress, owner.address);
      expect(transaction).to.emit(publicPool, "PoolInitialized").withArgs(
        testToken.address,
        NULL_ADDRESS,
        tokenTarget.toString(),
        multiplier.toString(),

        minWei.toString(),
        maxWei.toString()
      );
      expect(transaction)
        .to.emit(publicPool, "PoolBaseDataInitialized")
        .withArgs(2, startTime, endTime, claimTime, poolMeta);

      const tokenBalance = await testToken.balanceOf(publicPool.address);
      expect(tokenBalance.toString()).to.equal(tokenTarget.toString());
    });

    it("Advance Time to start Pool and buy", async function () {
      const contract = publicPool.connect(testUser1);
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = startTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
      await contract.buyWithEth({ value: ether("3").toString() });

      const contract1 = publicPool.connect(testUser2);
      await contract1.buyWithEth({ value: ether("1").toString() });

      const contract2 = publicPool.connect(testUser3);
      await contract2.buyWithEth({ value: ether("1").toString() });

      const contract3 = publicPool.connect(testUser4);
      await contract3.buyWithEth({ value: ether("1").toString() });
    });

    it("Advance time to endTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = endTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Advance time to claimTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = claimTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Claim from all users", async function () {
      await publicPool.connect(testUser2).claim();
      await publicPool.connect(testUser1).claim();
      await publicPool.connect(testUser3).claim();
      await publicPool.connect(testUser4).claim();
    });

    it("Withdraw and check fee is correct", async function () {
      const restToken = await testToken.balanceOf(publicPool.address);
      const transaction = await publicPool.withdrawToken();

      expect(transaction)
        .to.emit(testToken, "Transfer")
        .withArgs(publicPool.address, owner.address, restToken.toString());

      const ethBalance = await web3.eth.getBalance(publicPool.address);

      const recipientBalance = await web3.eth.getBalance(feeRecipientAddress);

      await publicPool.withdrawWei(ethBalance.toString());

      const newRecipientBalance = await web3.eth.getBalance(
        feeRecipientAddress
      );

      const receiptBalanceDif = new web3.utils.BN(
        newRecipientBalance.toString()
      ).sub(new web3.utils.BN(recipientBalance.toString()));

      expect(receiptBalanceDif.toString()).to.equal(
        new web3.utils.BN(ethBalance.toString())
          .mul(feePercent)
          .div(new web3.utils.BN("1000"))
          .toString()
      );
    });
  });

  describe("Create Token Base Eth Pool and check the flow", function () {
    it("Create Token Base Eth pool and check config fields", async function () {
      const block = await web3.eth.getBlock("latest");
      startTime = block.timestamp + 1000;
      endTime = startTime + poolDuration;
      claimTime = endTime + claimDuration;

      await testToken.approve(poolFactory.address, tokenTarget.toString());

      const transaction = await poolFactory.createPool(
        testToken.address,
        tokenTarget.toString(),
        multiplier.toString(),
        NULL_ADDRESS,
        minWei.toString(),
        maxWei.toString(),
        1, // token base
        startTime,
        endTime,
        claimTime,
        poolMeta
      );

      const createdAddress = await poolFactory.pools(2);
      basePool = await ethers.getContractAt("Pool", createdAddress);

      expect(transaction)
        .to.emit(poolFactory, "PoolCreated")
        .withArgs(createdAddress, owner.address);
      expect(transaction).to.emit(basePool, "PoolInitialized").withArgs(
        testToken.address,
        NULL_ADDRESS,
        tokenTarget.toString(),
        multiplier.toString(),

        minWei.toString(),
        maxWei.toString()
      );
      expect(transaction)
        .to.emit(basePool, "PoolBaseDataInitialized")
        .withArgs(1, startTime, endTime, claimTime, poolMeta);

      const tokenBalance = await testToken.balanceOf(basePool.address);
      expect(tokenBalance.toString()).to.equal(tokenTarget.toString());
    });

    it("Advance Time to start Pool and buy", async function () {
      const contract = basePool.connect(testUser1);
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = startTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
      await contract.buyWithEth({ value: ether("3").toString() });

      const contract1 = basePool.connect(testUser2);
      await contract1.buyWithEth({ value: ether("1").toString() });

      const contract2 = basePool.connect(testUser3);
      await contract2.buyWithEth({ value: ether("1").toString() });

      const contract3 = basePool.connect(testUser4);
      await contract3.buyWithEth({ value: ether("1").toString() });

      const contract4 = basePool.connect(testUser5);
      await expect(
        contract4.buyWithEth({ value: ether("1").toString() })
      ).to.be.revertedWith("");
    });

    it("Advance time to endTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = endTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Advance time to claimTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = claimTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Claim from all users", async function () {
      await basePool.connect(testUser2).claim();
      await basePool.connect(testUser1).claim();
      await basePool.connect(testUser3).claim();
      await basePool.connect(testUser4).claim();
    });

    it("Withdraw and check fee is correct", async function () {
      const restToken = await testToken.balanceOf(basePool.address);
      const transaction = await basePool.withdrawToken();

      expect(transaction)
        .to.emit(testToken, "Transfer")
        .withArgs(basePool.address, owner.address, restToken.toString());

      const ethBalance = await web3.eth.getBalance(basePool.address);

      const recipientBalance = await web3.eth.getBalance(feeRecipientAddress);

      await basePool.withdrawWei(ethBalance.toString());

      const newRecipientBalance = await web3.eth.getBalance(
        feeRecipientAddress
      );

      const receiptBalanceDif = new web3.utils.BN(
        newRecipientBalance.toString()
      ).sub(new web3.utils.BN(recipientBalance.toString()));

      expect(receiptBalanceDif.toString()).to.equal(
        new web3.utils.BN(ethBalance.toString())
          .mul(feePercent)
          .div(new web3.utils.BN("1000"))
          .toString()
      );
    });
  });

  describe("Create Public Token-Buy Pool and check the flow", function () {
    it("Create Public Token-Buy pool and check config fields", async function () {
      const block = await web3.eth.getBlock("latest");
      startTime = block.timestamp + 1000;
      endTime = startTime + poolDuration;
      claimTime = endTime + claimDuration;

      await testToken.approve(poolFactory.address, tokenTarget.toString());

      const transaction = await poolFactory.createPool(
        testToken.address,
        tokenTarget.toString(),
        multiplier.toString(),
        testWeiToken.address,
        minWei.toString(),
        maxWei.toString(),
        2, // public
        startTime,
        endTime,
        claimTime,
        poolMeta
      );

      const createdAddress = await poolFactory.pools(3);
      tokenPool = await ethers.getContractAt("Pool", createdAddress);

      expect(transaction)
        .to.emit(poolFactory, "PoolCreated")
        .withArgs(createdAddress, owner.address);
      expect(transaction)
        .to.emit(tokenPool, "PoolInitialized")
        .withArgs(
          testToken.address,
          testWeiToken.address,
          tokenTarget.toString(),
          multiplier.toString(),
          minWei.toString(),
          maxWei.toString()
        );
      expect(transaction)
        .to.emit(tokenPool, "PoolBaseDataInitialized")
        .withArgs(2, startTime, endTime, claimTime, poolMeta);

      const tokenBalance = await testToken.balanceOf(tokenPool.address);
      expect(tokenBalance.toString()).to.equal(tokenTarget.toString());
    });

    it("Advance Time to start Pool and buy", async function () {
      const contract = tokenPool.connect(testUser1);
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = startTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
      await expect(
        contract.buyWithEth({ value: ether("3").toString() })
      ).to.be.revertedWith("It's not eth-buy pool!");

      await testWeiToken
        .connect(testUser1)
        .approve(tokenPool.address, ether("1000").toString());
      await testWeiToken
        .connect(testUser2)
        .approve(tokenPool.address, ether("1000").toString());
      await testWeiToken
        .connect(testUser3)
        .approve(tokenPool.address, ether("1000").toString());

      await contract.buy(ether("2").toString());
      await tokenPool.connect(testUser2).buy(ether("2").toString());
      await tokenPool.connect(testUser3).buy(ether("2").toString());
    });

    it("Advance time to endTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = endTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Advance time to claimTime of pool", async function () {
      const block = await web3.eth.getBlock("latest");
      const timeToAdvance = claimTime - block.timestamp + 1;
      await advanceTime(timeToAdvance);
    });

    it("Claim from all users", async function () {
      await tokenPool.connect(testUser2).claim();
      await tokenPool.connect(testUser1).claim();
      await tokenPool.connect(testUser3).claim();
    });

    it("Withdraw and check fee is correct", async function () {
      const restToken = await testToken.balanceOf(tokenPool.address);
      const transaction = await tokenPool.withdrawToken();

      expect(transaction)
        .to.emit(testToken, "Transfer")
        .withArgs(tokenPool.address, owner.address, restToken.toString());

      const weiBalance = await testWeiToken.balanceOf(tokenPool.address);

      const recipientBalance = await testWeiToken.balanceOf(
        feeRecipientAddress
      );

      await expect(
        tokenPool.withdrawWei(weiBalance.toString())
      ).to.be.revertedWith("It's not eth-buy pool!");

      const weiToken = await tokenPool.weiToken();

      await tokenPool.withdrawWeiToken(weiBalance.toString());

      const newRecipientBalance = await testWeiToken.balanceOf(
        feeRecipientAddress
      );

      const receiptBalanceDif = new web3.utils.BN(
        newRecipientBalance.toString()
      ).sub(new web3.utils.BN(recipientBalance.toString()));

      expect(receiptBalanceDif.toString()).to.equal(
        new web3.utils.BN(weiBalance.toString())
          .mul(feePercent)
          .div(new web3.utils.BN("1000"))
          .toString()
      );
    });
  });
});
