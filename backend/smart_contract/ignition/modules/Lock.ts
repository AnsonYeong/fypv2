// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FileHashStorageModule = buildModule("FileHashStorageModule", (m) => {
  const fileHashStorage = m.contract("FileHashStorage", []);

  return { fileHashStorage };
});

export default FileHashStorageModule;
