// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FileRegistryV2Module = buildModule("FileRegistryV2Module", (m) => {
  const fileRegistryV2 = m.contract("FileRegistryV2", []);

  return { fileRegistryV2 };
});

export default FileRegistryV2Module;
