import { ethers } from "hardhat";

async function main() {
  const stakingToken = "";
  const rewardToken = "0x1c89A807bBc003A17F7F3c695F57B684Baba24db";
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(stakingToken, rewardToken);

  await staking.deployed();

  console.log("Staking deployed to:", staking.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
