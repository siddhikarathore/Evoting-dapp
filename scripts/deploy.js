const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const Election = await hre.ethers.getContractFactory("Election");
  const election = await Election.deploy();

  await election.waitForDeployment();

  const contractAddress = await election.getAddress();
  console.log("Election contract deployed to:", contractAddress);

  // Verify if deployer is admin
  const isDeployerAdmin = await election.isAdmin(deployer.address);
  console.log("Is deployer an admin?", isDeployerAdmin);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });