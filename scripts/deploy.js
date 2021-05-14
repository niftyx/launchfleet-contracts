const { ethers, upgrades } = require("hardhat");
const loadJsonFile = require("load-json-file");
const settings = loadJsonFile.sync("./scripts/settings.json").networks.mumbai;

async function main() {
  //Silences "struct" warnings
  //WARNING: do NOT add new properties, structs, mappings etc to these contracts in upgrades.
  upgrades.silenceWarnings();

  // We get the contract to deploy
  // Test

  // production
  // const LaunchTokenFactory = await ethers.getContractFactory("LaunchToken");
  const LaunchTokenFactory = await ethers.getContractFactory("TestToken");
  console.log("Starting deployments...");

  const launchToken = await LaunchTokenFactory.deploy();
  console.log("Token Deployed...", launchToken.address);

  const PoolFactoryFactory = await ethers.getContractFactory("PoolFactory");
  const poolFactory = await upgrades.deployProxy(
    PoolFactoryFactory,
    [
      launchToken.address,
      settings.baseAmount,
      settings.feeRecipient,
      settings.feePercent,
    ],
    {
      unsafeAllowCustomTypes: true,
    }
  );
  await poolFactory.deployed();
  console.log("PoolFactory Deployed...", poolFactory.address());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
