import { task } from "hardhat/config";

const contractAddress = "";

task("stake", "--CUSTOM-- Stake tokens in the pool")
  .addParam("amount", "Staking tokens amount")
  .setAction(async function ({ amount }, { ethers }) {
    const Staking = await ethers.getContractAt("Staking", contractAddress);
    const [sender] = await ethers.getSigners();
    await Staking.connect(sender).stake(amount);
    console.log(`The address ${sender.address} staked ${amount} tokens`);
  });

task(
  "unstake",
  "--CUSTOM-- Withdraw all staked tokens"
)
  .setAction(async function ({}, { ethers }) {
    const Staking = await ethers.getContractAt("Staking", contractAddress);
    const [sender] = await ethers.getSigners();
    await Staking.connect(sender).unstake();
    console.log(
      `The address ${sender.address} withdrew all its staked tokens`
    );
  });

task(
  "claim",
  "--CUSTOM-- Claim reward tokens"
)
  .setAction(async function ({}, { ethers }) {
    const Staking = await ethers.getContractAt("Staking", contractAddress);
    const [sender] = await ethers.getSigners();
    await Staking.connect(sender).claim();
    console.log(
      `The sender ${sender.address} withdrew its reward tokens`
    );
  });