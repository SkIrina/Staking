import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Token, Token__factory, Staking, Staking__factory } from "../typechain";
import { BigNumber } from "ethers";

describe("My awesome staking contract", function () {
  let StakingToken: Token__factory;
  let stakingToken: Token;
  let RewardToken: Token__factory;
  let rewardToken: Token;
  let StakingContract: Staking__factory;
  let stakingContract: Staking;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];


  beforeEach(async function () {
    StakingToken = await ethers.getContractFactory("Token");
    stakingToken = await StakingToken.deploy("Stake token", "STK");
    RewardToken = await ethers.getContractFactory("Token");
    rewardToken = await RewardToken.deploy("Reward token", "RWD");

    StakingContract = await ethers.getContractFactory("Staking");
    stakingContract = await StakingContract.deploy(stakingToken.address, rewardToken.address);

    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    await rewardToken.transfer(stakingContract.address, ethers.utils.parseEther("100"));

  });

  describe("Stake", function () {
    it("Should emit transfer event on stakingToken contract and change balance", async function () {

      // owner approves spending by the contract
      await stakingToken.approve(stakingContract.address, ethers.utils.parseEther("100"));

      const promise = await stakingContract.stake(10);
      // owner stakes 10 STK
      expect(promise).to.emit(stakingToken, "Transfer")
        .withArgs(owner.address, stakingContract.address, 10);

      expect(promise).to.changeEtherBalance(owner, 10);
    });
  });

  describe("Unstake", function () {
    it("Should return tokens with penalty if less than lockedTime passed", async function () {
      // owner approves spending by the contract
      await stakingToken.approve(stakingContract.address, ethers.utils.parseEther("100"));

      const stake = await stakingContract.stake(10);
      // owner stakes 10 STK
      expect(stake).to.emit(stakingToken, "Transfer")
        .withArgs(owner.address, stakingContract.address, 10);

      expect(stake).to.changeEtherBalance(owner, 10);

      // act: unstake
      const unstake = await stakingContract.unstake();
      expect(unstake).to.emit(stakingToken, "Transfer")
      .withArgs(stakingContract.address, owner.address, 8);

      expect(unstake).to.changeEtherBalance(owner, 8);
    });

    it("Should return tokens if more time lockedTime passed", async function () {
      // owner approves spending by the contract
      await stakingToken.approve(stakingContract.address, ethers.utils.parseEther("100"));

      const stake = await stakingContract.stake(10);
      // owner stakes 10 STK
      expect(stake).to.emit(stakingToken, "Transfer")
        .withArgs(owner.address, stakingContract.address, 10);

      expect(stake).to.changeEtherBalance(owner, 10);

      // emulate time passed, lockedTime = 1200
      await ethers.provider.send("evm_increaseTime", [2000]);
      await ethers.provider.send("evm_mine", []);

      // act: unstake
      const unstake = await stakingContract.unstake();
      expect(unstake).to.emit(stakingToken, "Transfer")
      .withArgs(stakingContract.address, owner.address, 10);

      expect(unstake).to.changeEtherBalance(owner, 10);
    });
  });

  
  describe("Claim reward", function () {
    beforeEach(async function () {
      // owner approves spending by the contract
      await stakingToken.approve(stakingContract.address, ethers.utils.parseEther("100"));
      // owner stakes 10 tokens
      await stakingContract.stake(10);
    });

    it("Should give 0 reward if less than rewardTime passed", async function () {

      // emulate time passed, rewardTime = 600
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine", []);

      // act: claim
      const claim = await stakingContract.claim();
      expect(claim).to.emit(rewardToken, "Transfer")
      .withArgs(stakingContract.address, owner.address, 0);

      expect(claim).to.not.changeTokenBalance(rewardToken, owner, 0);
    });

    it("Should give reward if more than rewardTime passed", async function () {

      // emulate time passed, rewardTime = 60
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine", []);

      // act: claim 1x reward
      const claim = await stakingContract.claim();
      expect(claim).to.emit(rewardToken, "Transfer")
      .withArgs(stakingContract.address, owner.address, 2);

      expect(claim).to.changeTokenBalance(rewardToken, owner, 2);
    });

    it("Should give reward depending on time passed", async function () {

      // emulate time passed, rewardTime = 600
      await ethers.provider.send("evm_increaseTime", [2000]);
      await ethers.provider.send("evm_mine", []);

      // act: claim 3x reward
      const claim = await stakingContract.claim();
      expect(claim).to.emit(rewardToken, "Transfer")
      .withArgs(stakingContract.address, owner.address, 6);

      expect(claim).to.changeTokenBalance(rewardToken, owner, 6);
    });

    it("Should set correct reward if address stakes multiple times", async function () {

      // give addr1 10 staking tokens
      await stakingToken.transfer(addr1.address, 100);
      // addr1 approves spending by the contract
      await stakingToken.connect(addr1).approve(stakingContract.address, ethers.utils.parseEther("100"));

      await stakingContract.connect(addr1).stake(10);

      // emulate time passed. reward 10 token * 0.2 rate * 30 min = 6
      await ethers.provider.send("evm_increaseTime", [2000]);
      await ethers.provider.send("evm_mine", []);
  
      await stakingContract.connect(addr1).stake(10);

      // expect(await stakingContract.rewards(addr1.address)).to.equal(6);

      // emulate time passed reward 20 token * 0.2 rate * 30 min = 12
      await ethers.provider.send("evm_increaseTime", [2000]);
      await ethers.provider.send("evm_mine", []);

      // act: claim 3x reward
      const claim = await stakingContract.connect(addr1).claim();
      // expect(await stakingContract.rewards(addr1.address)).to.equal(6);
      expect(claim).to.emit(rewardToken, "Transfer")
      .withArgs(stakingContract.address, addr1.address, 18);

      expect(claim).to.changeTokenBalance(rewardToken, addr1, 18);
    });
  });

  describe("Reward rate", function () {
    it("Should let owner set reward rate", async function () {

      // owner approves spending by the contract
      await stakingToken.approve(stakingContract.address, ethers.utils.parseEther("100"));

      await stakingContract.setRate(10);
      expect(await stakingContract.rewardRatePercent()).to.equal(10);
    });

    it("Should not let non-owner to set reward rate", async function () {
      await expect(stakingContract.connect(addr1).setRate(10)).to.be.revertedWith("Not owner");
    });
  });

  describe("Locked time", function () {
    it("Should let owner set locked time in seconds", async function () {

      await stakingContract.setLockedTime(200);
      expect(await stakingContract.lockedTime()).to.equal(200);
    });

    it("Should not let non-owner to set locked time", async function () {
      await expect(stakingContract.connect(addr1).setLockedTime(200)).to.be.revertedWith("Not owner");
    });
  });
});
  /*
    it("Should set the name of the token to Yena token", async function () {
      expect(await token.name()).to.equal("Yena Token");
    });

    it("Should set the symbol of the token to YEN", async function () {
      expect(await token.symbol()).to.equal("YEN");
    });

    it("Should set the decimals of the token to 18", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it(`Should set the total supply of tokens to ${totalSupply}`, async function () {
      expect(await token.totalSupply()).to.equal(totalSupply);
    });

    it(`Should set initial owner balance to ${totalSupply}`, async function () {
      expect(await token.balanceOf(owner.address)).to.equal(totalSupply);
    });
  });

  describe("Transfer", function () {
    it("Should transfer tokens from one address to another address", async function () {
      await token.transfer(addr1.address, 10);

      expect(await token.balanceOf(owner.address)).to.equal(totalSupply - 10);
      expect(await token.balanceOf(addr1.address)).to.equal(10);
    });

    it("Should emit transfer event", async function () {
      await expect(token.transfer(addr1.address, 10))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, 10);
    });

    it("Should not allow to transfer more than the account has", async function () {
      await token.transfer(addr1.address, 10);

      await expect(
        token.connect(addr1).transfer(addr2.address, 50)
      ).to.be.revertedWith("Not enough balance for transfer");
    });
  });

  describe("Allowance and approve", function () {
    it("Should set correct allowance", async function () {
      // arrd1 allows addr2 to spend 10 YEN
      await token.connect(addr1).approve(addr2.address, 10);

      expect(await token.allowance(addr1.address, addr2.address)).to.equal(10);
    });

    it("Should emit approve event", async function () {
      await expect(token.connect(addr1).approve(addr2.address, 10))
        .to.emit(token, "Approval")
        .withArgs(addr1.address, addr2.address, 10);
    });
  });

  describe("TransferFrom", function () {
    it("Should set correct balances and allowance", async function () {
      // owner gives addr1 20 YEN
      await token.transfer(addr1.address, 20);

      // arrd1 allows addr2 to spend 10 YEN
      await token.connect(addr1).approve(addr2.address, 10);

      // act: addr2 transfers 5 YEN from addr1
      await token.connect(addrs[0]).transferFrom(addr1.address, addr2.address, 5);

      expect(await token.allowance(addr1.address, addr2.address)).to.equal(5);
      expect(await token.balanceOf(addr1.address)).to.equal(15);
      expect(await token.balanceOf(addr2.address)).to.equal(5);
    });

    it("Should not allow to transfer more than the account has", async function () {
      // owner gives addr1 20 YEN
      await token.transfer(addr1.address, 20);

      // arrd1 allows addr2 to spend 50 YEN
      await token.connect(addr1).approve(addr2.address, 50);

      // act: addr2 transfers 50 YEN from addr1
      await expect(
        token.connect(addrs[0]).transferFrom(addr1.address, addr2.address, 50)
      ).to.be.revertedWith("This transfer is not permitted");
    });

    it("Should not allow to transfer without allowance", async function () {
      // owner gives addr1 20 YEN
      await token.transfer(addr1.address, 20);

      // act: addr2 transfers 20 YEN from addr1
      await expect(
        token.connect(addrs[0]).transferFrom(addr1.address, addr2.address, 20)
      ).to.be.revertedWith("This transfer is not permitted");
    });

    it("Should emit transfer event", async function () {
      await token.approve(addr1.address, 10);

      await expect(token.connect(addrs[0]).transferFrom(owner.address, addr1.address, 10))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, 10);
    });
  });

  describe("Mint", function () {
    it("Should set correct balances and total supply", async function () {
      // owner mints for addr1 10 YEN
      await token.mint(addr1.address, 10);

      expect(await token.balanceOf(addr1.address)).to.equal(10);
      expect(await token.totalSupply()).to.equal(totalSupply + 10);
    });

    it("Should not allow non-owner to mint", async function () {
      await expect(
        token.connect(addr1).mint(addr1.address, 10)
      ).to.be.revertedWith("Minting not allowed");
    });

    it("Should emit transfer event", async function () {
      await expect(token.mint(addr1.address, 10))
        .to.emit(token, "Transfer")
        .withArgs(ethers.constants.AddressZero, addr1.address, 10);
    });
  });

  describe("Burn", function () {
    it("Should set correct balances and total supply", async function () {
      // owner gives addr1 20 YEN
      await token.transfer(addr1.address, 20);

      // owner burns from addr1 10 YEN
      await token.burn(addr1.address, 10);

      expect(await token.balanceOf(addr1.address)).to.equal(10);
      expect(await token.totalSupply()).to.equal(totalSupply - 10);
    });

    it("Should not allow non-owner to burn", async function () {
      await expect(
        token.connect(addr1).burn(addr1.address, 10)
      ).to.be.revertedWith("Burning not allowed");
    });

    it("Should not allow owner to burn more than account has", async function () {
      // owner gives addr1 20 YEN
      await token.transfer(addr1.address, 20);

      await expect(token.burn(addr1.address, 30)).to.be.revertedWith(
        "Not possible to burn this amount"
      );
    });

    it("Should emit transfer event", async function () {
      // owner gives addr1 20 YEN
      await token.transfer(addr1.address, 20);

      await expect(token.burn(addr1.address, 10))
        .to.emit(token, "Transfer")
        .withArgs(addr1.address, ethers.constants.AddressZero, 10);
    });
  });
});
*/