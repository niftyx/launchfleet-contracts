const { ethers, upgrades } = require("hardhat");
const loadJsonFile = require("load-json-file");
const settings = loadJsonFile.sync("./scripts/settings.json").networks.mumbai;

async function main() {
  //Silences "struct" warnings
  //WARNING: do NOT add new properties, structs, mappings etc to these contracts in upgrades.
  upgrades.silenceWarnings();

  // We get the contract to deploy

  const PoolFactoryFactory = await ethers.getContractFactory("PoolFactory");

  console.log("Upgrading poolFactory...");
  await upgrades.upgradeProxy(settings.poolFactory, PoolFactoryFactory, {
    unsafeAllowCustomTypes: true,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
