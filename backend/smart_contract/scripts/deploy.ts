import { viem } from "hardhat";

async function main() {
  console.log("🚀 Deploying FileRegistryV2 contract...");

  try {
    const publicClient = await viem.getPublicClient();
    const [deployer] = await viem.getWalletClients();

    console.log("👤 Deployer:", deployer.account.address);
    const network = await publicClient.getChainId();
    console.log("🔢 Chain ID:", network);

    console.log("📦 Deploying contract...");
    const deployed = await viem.deployContract(
      "contracts/FYP.sol:FileRegistryV2",
      []
    );
    const address = deployed.address as `0x${string}`;

    if (!address) {
      console.error("❌ No contract address in receipt");
      throw new Error("No contract address in receipt");
    }

    console.log("✅ FileRegistryV2 deployed to:", address);
    console.log("📝 Contract address for frontend:", address);

    // Interact with the contract using viem helpers
    const contract = await viem.getContractAt(
      "contracts/FYP.sol:FileRegistryV2",
      address
    );
    const owner = await contract.read.owner();
    const totalFiles = await contract.read.getTotalFiles();

    console.log("👑 Owner:", owner);
    console.log("📁 Initial total files:", totalFiles.toString());

    console.log("\n🎉 Deployment completed successfully!");
    console.log("📋 Contract Details:");
    console.log("   - Name: FileRegistryV2");
    console.log("   - Address:", address);
    console.log("   - ChainId:", network);
    console.log("   - Owner:", owner);
    console.log("   - Total Files:", totalFiles.toString());
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main();
