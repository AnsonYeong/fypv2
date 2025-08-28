import { viem } from "hardhat";
import { expect } from "chai";

describe("FileRegistryV2", function () {
  let contract: any;
  let deployer: any;
  let user1: any;
  let user2: any;
  let user3: any;

  beforeEach(async function () {
    [deployer, user1, user2, user3] = await viem.getWalletClients();

    const deployed = await viem.deployContract(
      "contracts/FYP.sol:FileRegistryV2",
      []
    );

    contract = await viem.getContractAt(
      "contracts/FYP.sol:FileRegistryV2",
      deployed.address
    );
  });

  describe("Deployment", function () {
    it("should deploy with correct owner", async function () {
      const owner = await contract.read.owner();
      expect(owner.toLowerCase()).to.equal(
        deployer.account.address.toLowerCase()
      );
    });

    it("should start with 0 total files", async function () {
      const totalFiles = await contract.read.getTotalFiles();
      expect(totalFiles).to.equal(0n);
    });
  });

  describe("File Upload", function () {
    it("should upload a file hash successfully", async function () {
      const fileHash = "QmExampleHash123";
      const fileName = "document.txt";
      const fileSize = 1024n;
      const metadataCID = "bafybeigdyrztxexamplecidmetadata";

      const txHash = await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID],
        { account: user1.account }
      );
      expect(txHash).to.be.a("string");

      const totalFiles = await contract.read.getTotalFiles();
      expect(totalFiles).to.equal(1n);

      const info = await contract.read.getFileInfo([1n]);
      expect(info[0]).to.equal(fileHash); // fileHash
      expect(info[1]).to.equal(fileName); // fileName
      expect(info[2]).to.equal(fileSize); // fileSize
      expect(info[3].toLowerCase()).to.equal(
        user1.account.address.toLowerCase()
      ); // uploader
      expect(Number(info[4])).to.be.greaterThan(0); // timestamp
      expect(info[5]).to.equal(true); // isActive
      expect(info[6]).to.equal(metadataCID); // metadataCID
    });

    it("should prevent duplicate file hash uploads", async function () {
      const fileHash = "QmDuplicateHash";
      const fileName = "document.txt";
      const fileSize = 1024n;
      const metadataCID = "bafybeigdyrztxexamplecidmetadata";

      // First upload should succeed
      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID],
        { account: user1.account }
      );

      // Second upload with same hash should fail
      await expect(
        contract.write.uploadFileHash(
          [fileHash, "another.txt", 2048n, "differentmetadata"],
          { account: user2.account }
        )
      ).to.be.rejectedWith("File with this hash already exists");
    });

    it("should reject empty parameters", async function () {
      await expect(
        contract.write.uploadFileHash(["", "document.txt", 1024n, "metadata"], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File hash cannot be empty");

      await expect(
        contract.write.uploadFileHash(["hash", "", 1024n, "metadata"], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File name cannot be empty");

      await expect(
        contract.write.uploadFileHash(
          ["hash", "document.txt", 0n, "metadata"],
          { account: user1.account }
        )
      ).to.be.rejectedWith("File size must be greater than 0");

      await expect(
        contract.write.uploadFileHash(["hash", "document.txt", 1024n, ""], {
          account: user1.account,
        })
      ).to.be.rejectedWith("metadataCID cannot be empty");
    });
  });

  describe("File Information", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmTestHash";
      const fileName = "test.txt";
      const fileSize = 512n;
      const metadataCID = "bafybeigdyrztxtestmetadata";

      const txHash = await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID],
        { account: user1.account }
      );

      // Get the file ID from the transaction
      const totalFiles = await contract.read.getTotalFiles();
      fileId = totalFiles;
    });

    it("should return correct file information", async function () {
      const info = await contract.read.getFileInfo([fileId]);
      expect(info[0]).to.equal("QmTestHash");
      expect(info[1]).to.equal("test.txt");
      expect(info[2]).to.equal(512n);
      expect(info[3].toLowerCase()).to.equal(
        user1.account.address.toLowerCase()
      );
      expect(info[5]).to.equal(true);
      expect(info[6]).to.equal("bafybeigdyrztxtestmetadata");
    });

    it("should revert for non-existent file", async function () {
      await expect(contract.read.getFileInfo([999n])).to.be.rejectedWith(
        "File does not exist"
      );
    });

    it("should return user files correctly", async function () {
      const userFiles = await contract.read.getUserFiles([
        user1.account.address,
      ]);
      expect(userFiles).to.have.lengthOf(1);
      expect(userFiles[0]).to.equal(fileId);
    });

    it("should return empty array for user with no files", async function () {
      const userFiles = await contract.read.getUserFiles([
        user2.account.address,
      ]);
      expect(userFiles).to.have.lengthOf(0);
    });
  });

  describe("Access Control", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmAccessTestHash";
      const fileName = "access.txt";
      const fileSize = 256n;
      const metadataCID = "bafybeigdyrztxaccessmetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID],
        { account: user1.account }
      );

      const totalFiles = await contract.read.getTotalFiles();
      fileId = totalFiles;
    });

    it("should grant owner full access by default", async function () {
      const hasRead = await contract.read.hasReadAccess([
        fileId,
        user1.account.address,
      ]);
      const hasWrite = await contract.read.hasWriteAccess([
        fileId,
        user1.account.address,
      ]);

      expect(hasRead).to.equal(true);
      expect(hasWrite).to.equal(true);
    });

    it("should deny access to other users by default", async function () {
      const hasRead = await contract.read.hasReadAccess([
        fileId,
        user2.account.address,
      ]);
      const hasWrite = await contract.read.hasWriteAccess([
        fileId,
        user2.account.address,
      ]);

      expect(hasRead).to.equal(false);
      expect(hasWrite).to.equal(false);
    });

    it("should grant read access to user", async function () {
      await contract.write.grantRead([fileId, user2.account.address], {
        account: user1.account,
      });

      const hasRead = await contract.read.hasReadAccess([
        fileId,
        user2.account.address,
      ]);
      expect(hasRead).to.equal(true);
    });

    it("should grant write access to user", async function () {
      await contract.write.grantWrite([fileId, user2.account.address], {
        account: user1.account,
      });

      const hasWrite = await contract.read.hasWriteAccess([
        fileId,
        user2.account.address,
      ]);
      expect(hasWrite).to.equal(true);
    });

    it("should revoke all access from user", async function () {
      // First grant access
      await contract.write.grantRead([fileId, user2.account.address], {
        account: user1.account,
      });
      await contract.write.grantWrite([fileId, user2.account.address], {
        account: user1.account,
      });

      // Verify access was granted
      expect(
        await contract.read.hasReadAccess([fileId, user2.account.address])
      ).to.equal(true);
      expect(
        await contract.read.hasWriteAccess([fileId, user2.account.address])
      ).to.equal(true);

      // Revoke access
      await contract.write.revokeAccess([fileId, user2.account.address], {
        account: user1.account,
      });

      // Verify access was revoked
      expect(
        await contract.read.hasReadAccess([fileId, user2.account.address])
      ).to.equal(false);
      expect(
        await contract.read.hasWriteAccess([fileId, user2.account.address])
      ).to.equal(false);
    });

    it("should only allow file owner to grant permissions", async function () {
      await expect(
        contract.write.grantRead([fileId, user3.account.address], {
          account: user2.account,
        })
      ).to.be.rejectedWith("Only file owner can perform this action");

      await expect(
        contract.write.grantWrite([fileId, user3.account.address], {
          account: user2.account,
        })
      ).to.be.rejectedWith("Only file owner can perform this action");
    });

    it("should only allow file owner to revoke permissions", async function () {
      await expect(
        contract.write.revokeAccess([fileId, user2.account.address], {
          account: user2.account,
        })
      ).to.be.rejectedWith("Only file owner can perform this action");
    });
  });

  describe("File Updates", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmUpdateTestHash";
      const fileName = "update.txt";
      const fileSize = 128n;
      const metadataCID = "bafybeigdyrztxupdatemetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID],
        { account: user1.account }
      );

      const totalFiles = await contract.read.getTotalFiles();
      fileId = totalFiles;
    });

    it("should allow file owner to update file", async function () {
      const newFileHash = "QmNewHash";
      const newFileSize = 256n;
      const newMetadataCID = "bafybeigdyrztxnewmetadata";

      await contract.write.updateFile(
        [fileId, newFileHash, newFileSize, newMetadataCID],
        { account: user1.account }
      );

      const info = await contract.read.getFileInfo([fileId]);
      expect(info[0]).to.equal(newFileHash);
      expect(info[2]).to.equal(newFileSize);
      expect(info[6]).to.equal(newMetadataCID);
    });

    it("should allow user with write access to update file", async function () {
      // Grant write access to user2
      await contract.write.grantWrite([fileId, user2.account.address], {
        account: user1.account,
      });

      const newFileHash = "QmUser2Hash";
      const newFileSize = 512n;
      const newMetadataCID = "bafybeigdyrztxuser2metadata";

      await contract.write.updateFile(
        [fileId, newFileHash, newFileSize, newMetadataCID],
        { account: user2.account }
      );

      const info = await contract.read.getFileInfo([fileId]);
      expect(info[0]).to.equal(newFileHash);
      expect(info[2]).to.equal(newFileSize);
      expect(info[6]).to.equal(newMetadataCID);
    });

    it("should reject update from user without write access", async function () {
      const newFileHash = "QmUnauthorizedHash";
      const newFileSize = 256n;
      const newMetadataCID = "bafybeigdyrztxunauthorizedmetadata";

      await expect(
        contract.write.updateFile(
          [fileId, newFileHash, newFileSize, newMetadataCID],
          { account: user2.account }
        )
      ).to.be.rejectedWith("No write permission");
    });

    it("should reject update with empty parameters", async function () {
      await expect(
        contract.write.updateFile([fileId, "", 256n, "metadata"], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File hash cannot be empty");

      await expect(
        contract.write.updateFile([fileId, "hash", 0n, "metadata"], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File size must be > 0");

      await expect(
        contract.write.updateFile([fileId, "hash", 256n, ""], {
          account: user1.account,
        })
      ).to.be.rejectedWith("metadataCID cannot be empty");
    });
  });

  describe("File Deactivation", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmDeactivateTestHash";
      const fileName = "deactivate.txt";
      const fileSize = 64n;
      const metadataCID = "bafybeigdyrztxdeactivatemetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID],
        { account: user1.account }
      );

      const totalFiles = await contract.read.getTotalFiles();
      fileId = totalFiles;
    });

    it("should allow file owner to deactivate file", async function () {
      await contract.write.deactivateFile([fileId], {
        account: user1.account,
      });

      // The file is now deactivated, but we can't call getFileInfo on it
      // because the fileExists modifier will revert with "File is not active"
      // This is the correct behavior - the smart contract is working as intended

      // We can verify the file was deactivated by checking that operations fail
      await expect(
        contract.write.updateFile([fileId, "newhash", 128n, "newmetadata"], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File is not active");
    });

    it("should reject deactivation from non-owner", async function () {
      await expect(
        contract.write.deactivateFile([fileId], {
          account: user2.account,
        })
      ).to.be.rejectedWith("Only file owner can perform this action");
    });

    it("should reject operations on deactivated file", async function () {
      // Deactivate the file
      await contract.write.deactivateFile([fileId], {
        account: user1.account,
      });

      // Try to update the deactivated file
      await expect(
        contract.write.updateFile([fileId, "newhash", 128n, "newmetadata"], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File is not active");

      // Try to grant permissions on deactivated file
      await expect(
        contract.write.grantRead([fileId, user2.account.address], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File is not active");
    });
  });

  describe("Multiple Files and Users", function () {
    it("should handle multiple files from different users", async function () {
      // User1 uploads file1
      await contract.write.uploadFileHash(
        ["hash1", "file1.txt", 100n, "metadata1"],
        { account: user1.account }
      );

      // User2 uploads file2
      await contract.write.uploadFileHash(
        ["hash2", "file2.txt", 200n, "metadata2"],
        { account: user2.account }
      );

      // User3 uploads file3
      await contract.write.uploadFileHash(
        ["hash3", "file3.txt", 300n, "metadata3"],
        { account: user3.account }
      );

      const totalFiles = await contract.read.getTotalFiles();
      expect(totalFiles).to.equal(3n);

      // Check user files
      const user1Files = await contract.read.getUserFiles([
        user1.account.address,
      ]);
      const user2Files = await contract.read.getUserFiles([
        user2.account.address,
      ]);
      const user3Files = await contract.read.getUserFiles([
        user3.account.address,
      ]);

      expect(user1Files).to.have.lengthOf(1);
      expect(user2Files).to.have.lengthOf(1);
      expect(user3Files).to.have.lengthOf(1);

      // Check file info
      const file1Info = await contract.read.getFileInfo([1n]);
      const file2Info = await contract.read.getFileInfo([2n]);
      const file3Info = await contract.read.getFileInfo([3n]);

      expect(file1Info[3].toLowerCase()).to.equal(
        user1.account.address.toLowerCase()
      );
      expect(file2Info[3].toLowerCase()).to.equal(
        user2.account.address.toLowerCase()
      );
      expect(file3Info[3].toLowerCase()).to.equal(
        user3.account.address.toLowerCase()
      );
    });

    it("should handle complex permission scenarios", async function () {
      // User1 uploads a file
      await contract.write.uploadFileHash(
        ["complexhash", "complex.txt", 500n, "complexmetadata"],
        { account: user1.account }
      );

      const fileId = 1n;

      // Grant read access to user2
      await contract.write.grantRead([fileId, user2.account.address], {
        account: user1.account,
      });

      // Grant write access to user3
      await contract.write.grantWrite([fileId, user3.account.address], {
        account: user1.account,
      });

      // Verify permissions
      expect(
        await contract.read.hasReadAccess([fileId, user2.account.address])
      ).to.equal(true);
      expect(
        await contract.read.hasWriteAccess([fileId, user2.account.address])
      ).to.equal(false);
      expect(
        await contract.read.hasReadAccess([fileId, user3.account.address])
      ).to.equal(false);
      expect(
        await contract.read.hasWriteAccess([fileId, user3.account.address])
      ).to.equal(true);

      // User3 should be able to update the file
      await contract.write.updateFile(
        [fileId, "updatedhash", 600n, "updatedmetadata"],
        { account: user3.account }
      );

      // User2 should not be able to update the file
      await expect(
        contract.write.updateFile(
          [fileId, "user2hash", 700n, "user2metadata"],
          { account: user2.account }
        )
      ).to.be.rejectedWith("No write permission");

      // Revoke user3's write access
      await contract.write.revokeAccess([fileId, user3.account.address], {
        account: user1.account,
      });

      // User3 should no longer be able to update
      await expect(
        contract.write.updateFile(
          [fileId, "finalhash", 800n, "finalmetadata"],
          { account: user3.account }
        )
      ).to.be.rejectedWith("No write permission");
    });
  });

  describe("Edge Cases", function () {
    it("should handle very large file sizes", async function () {
      const largeSize = 2n ** 256n - 1n; // Maximum uint256
      const fileHash = "QmLargeFileHash";
      const fileName = "large.txt";
      const metadataCID = "bafybeigdyrztxlargemetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, largeSize, metadataCID],
        { account: user1.account }
      );

      const info = await contract.read.getFileInfo([1n]);
      expect(info[2]).to.equal(largeSize);
    });

    it("should handle very long file names and hashes", async function () {
      const longHash = "Qm" + "a".repeat(100);
      const longName = "a".repeat(100) + ".txt";
      const longMetadata = "bafybeigdyrztx" + "a".repeat(100);

      await contract.write.uploadFileHash(
        [longHash, longName, 100n, longMetadata],
        { account: user1.account }
      );

      const info = await contract.read.getFileInfo([1n]);
      expect(info[0]).to.equal(longHash);
      expect(info[1]).to.equal(longName);
      expect(info[6]).to.equal(longMetadata);
    });
  });
});
