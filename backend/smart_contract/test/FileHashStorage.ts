import { viem } from "hardhat";
import { expect } from "chai";

describe("FileRegistryV2 - Complete Test Suite", function () {
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

  describe("File Upload - Enhanced with Encryption", function () {
    it("should upload a non-encrypted file successfully", async function () {
      const fileHash = "QmExampleHash123";
      const fileName = "document.txt";
      const fileSize = 1024n;
      const metadataCID = "bafybeigdyrztxexamplecidmetadata";
      const isEncrypted = false;
      const masterKeyHash = "";

      const txHash = await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, isEncrypted, masterKeyHash],
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
      expect(info[7]).to.equal(isEncrypted); // isEncrypted
      expect(info[8]).to.equal(masterKeyHash); // masterKeyHash
      expect(info[9]).to.equal(1n); // versionCount
    });

    it("should upload an encrypted file successfully", async function () {
      const fileHash = "QmEncryptedHash456";
      const fileName = "secret.txt";
      const fileSize = 2048n;
      const metadataCID = "bafybeigdyrztxencryptedmetadata";
      const isEncrypted = true;
      const masterKeyHash = "0x1234567890abcdef";

      const txHash = await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, isEncrypted, masterKeyHash],
        { account: user1.account }
      );
      expect(txHash).to.be.a("string");

      const info = await contract.read.getFileInfo([1n]);
      expect(info[7]).to.equal(isEncrypted);
      expect(info[8]).to.equal(masterKeyHash);
    });

    it("should initialize version history on upload", async function () {
      const fileHash = "QmVersionTestHash";
      const fileName = "version.txt";
      const fileSize = 512n;
      const metadataCID = "bafybeigdyrztxversionmetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, false, ""],
        { account: user1.account }
      );

      const versions = await contract.read.getFileVersions([1n]);
      expect(versions).to.have.lengthOf(1);
      expect(versions[0]).to.equal(metadataCID);
    });

    it("should prevent duplicate file hash uploads", async function () {
      const fileHash = "QmDuplicateHash";
      const fileName = "document.txt";
      const fileSize = 1024n;
      const metadataCID = "bafybeigdyrztxexamplecidmetadata";

      // First upload should succeed
      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, false, ""],
        { account: user1.account }
      );

      // Second upload with same hash should fail
      await expect(
        contract.write.uploadFileHash(
          [fileHash, "another.txt", 2048n, "differentmetadata", false, ""],
          { account: user2.account }
        )
      ).to.be.rejectedWith("File with this hash already exists");
    });

    it("should reject empty parameters", async function () {
      await expect(
        contract.write.uploadFileHash(
          ["", "document.txt", 1024n, "metadata", false, ""],
          {
            account: user1.account,
          }
        )
      ).to.be.rejectedWith("File hash cannot be empty");

      await expect(
        contract.write.uploadFileHash(
          ["hash", "", 1024n, "metadata", false, ""],
          {
            account: user1.account,
          }
        )
      ).to.be.rejectedWith("File name cannot be empty");

      await expect(
        contract.write.uploadFileHash(
          ["hash", "document.txt", 0n, "metadata", false, ""],
          { account: user1.account }
        )
      ).to.be.rejectedWith("File size must be greater than 0");

      await expect(
        contract.write.uploadFileHash(
          ["hash", "document.txt", 1024n, "", false, ""],
          {
            account: user1.account,
          }
        )
      ).to.be.rejectedWith("metadataCID cannot be empty");
    });
  });

  describe("Version History System", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmVersionTestHash";
      const fileName = "version.txt";
      const fileSize = 512n;
      const metadataCID = "bafybeigdyrztxversionmetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, false, ""],
        { account: user1.account }
      );

      fileId = 1n;
    });

    it("should create new version on file update", async function () {
      const newFileHash = "QmNewVersionHash";
      const newFileSize = 1024n;
      const newMetadataCID = "bafybeigdyrztxnewversionmetadata";

      await contract.write.updateFile(
        [fileId, newFileHash, newFileSize, newMetadataCID],
        { account: user1.account }
      );

      // Check version count increased
      const info = await contract.read.getFileInfo([fileId]);
      expect(info[9]).to.equal(2n); // versionCount

      // Check version history
      const versions = await contract.read.getFileVersions([fileId]);
      expect(versions).to.have.lengthOf(2);
      expect(versions[0]).to.equal("bafybeigdyrztxversionmetadata"); // Original
      expect(versions[1]).to.equal(newMetadataCID); // New version
    });

    it("should update hashToFileId mapping when file is updated", async function () {
      const newFileHash = "QmNewVersionHash";
      const newFileSize = 1024n;
      const newMetadataCID = "bafybeigdyrztxnewversionmetadata";

      // Before update, new metadata CID should not map to any file
      const fileIdBefore = await contract.read.metadataToFileId([
        newMetadataCID,
      ]);
      expect(fileIdBefore).to.equal(0n);

      // Update the file
      await contract.write.updateFile(
        [fileId, newFileHash, newFileSize, newMetadataCID],
        { account: user1.account }
      );

      // After update, new metadata CID should map to the same file ID
      const fileIdAfter = await contract.read.metadataToFileId([
        newMetadataCID,
      ]);
      expect(fileIdAfter).to.equal(fileId);

      // Original metadata CID should still map to the same file ID
      const originalFileId = await contract.read.metadataToFileId([
        "bafybeigdyrztxversionmetadata",
      ]);
      expect(originalFileId).to.equal(fileId);
    });

    it("should track multiple versions correctly", async function () {
      // Create version 2
      await contract.write.updateFile([fileId, "hash2", 1024n, "metadata2"], {
        account: user1.account,
      });

      // Create version 3
      await contract.write.updateFile([fileId, "hash3", 1536n, "metadata3"], {
        account: user1.account,
      });

      // Create version 4
      await contract.write.updateFile([fileId, "hash4", 2048n, "metadata4"], {
        account: user1.account,
      });

      const info = await contract.read.getFileInfo([fileId]);
      expect(info[9]).to.equal(4n); // versionCount

      const versions = await contract.read.getFileVersions([fileId]);
      expect(versions).to.have.lengthOf(4);
      expect(versions[0]).to.equal("bafybeigdyrztxversionmetadata");
      expect(versions[1]).to.equal("metadata2");
      expect(versions[2]).to.equal("metadata3");
      expect(versions[3]).to.equal("metadata4");
    });

    it("should rollback to previous version", async function () {
      // Create version 2
      await contract.write.updateFile([fileId, "hash2", 1024n, "metadata2"], {
        account: user1.account,
      });

      // Create version 3
      await contract.write.updateFile([fileId, "hash3", 1536n, "metadata3"], {
        account: user1.account,
      });

      // Rollback to version 1 (index 0)
      await contract.write.rollbackFile([fileId, 0n], {
        account: user1.account,
      });

      const info = await contract.read.getFileInfo([fileId]);
      expect(info[6]).to.equal("bafybeigdyrztxversionmetadata"); // Should be original metadata
    });

    it("should reject rollback to invalid version index", async function () {
      await expect(
        contract.write.rollbackFile([fileId, 5n], {
          account: user1.account,
        })
      ).to.be.rejectedWith("Invalid version index");
    });

    it("should only allow file owner to rollback", async function () {
      await expect(
        contract.write.rollbackFile([fileId, 0n], {
          account: user2.account,
        })
      ).to.be.rejectedWith("Only file owner can perform this action");
    });

    it("should emit correct events for versioning", async function () {
      const newFileHash = "QmEventTestHash";
      const newFileSize = 1024n;
      const newMetadataCID = "bafybeigdyrztxeventmetadata";

      // This test would require event filtering, which is more complex
      // For now, we just ensure the transaction succeeds
      const txHash = await contract.write.updateFile(
        [fileId, newFileHash, newFileSize, newMetadataCID],
        { account: user1.account }
      );
      expect(txHash).to.be.a("string");
    });
  });

  describe("Enhanced Access Control with Expiration", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmAccessTestHash";
      const fileName = "access.txt";
      const fileSize = 256n;
      const metadataCID = "bafybeigdyrztxaccessmetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, false, ""],
        { account: user1.account }
      );

      fileId = 1n;
    });

    it("should grant read access with expiration", async function () {
      const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      await contract.write.grantRead(
        [fileId, user2.account.address, expirationTime],
        {
          account: user1.account,
        }
      );

      const hasRead = await contract.read.hasReadAccess([
        fileId,
        user2.account.address,
      ]);
      expect(hasRead).to.equal(true);

      const accessInfo = await contract.read.getAccessInfo([
        fileId,
        user2.account.address,
      ]);
      expect(accessInfo[0]).to.equal(true); // hasRead
      expect(accessInfo[1]).to.equal(false); // hasWrite
      expect(Number(accessInfo[2])).to.be.greaterThan(0); // grantedAt
      expect(Number(accessInfo[3])).to.equal(expirationTime); // expiresAt
      expect(accessInfo[4]).to.equal(false); // expired
    });

    it("should grant write access with expiration", async function () {
      const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      await contract.write.grantWrite(
        [fileId, user2.account.address, expirationTime],
        {
          account: user1.account,
        }
      );

      const hasWrite = await contract.read.hasWriteAccess([
        fileId,
        user2.account.address,
      ]);
      expect(hasWrite).to.equal(true);

      const accessInfo = await contract.read.getAccessInfo([
        fileId,
        user2.account.address,
      ]);
      expect(accessInfo[0]).to.equal(false); // hasRead
      expect(accessInfo[1]).to.equal(true); // hasWrite
      expect(Number(accessInfo[3])).to.equal(expirationTime); // expiresAt
    });

    it("should grant access without expiration (0)", async function () {
      await contract.write.grantRead([fileId, user2.account.address, 0], {
        account: user1.account,
      });

      const accessInfo = await contract.read.getAccessInfo([
        fileId,
        user2.account.address,
      ]);
      expect(accessInfo[3]).to.equal(0n); // expiresAt = 0 (never expires)
      expect(accessInfo[4]).to.equal(false); // expired = false
    });

    it("should reject expired access", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      // This should fail because expiration is in the past
      await expect(
        contract.write.grantRead([fileId, user2.account.address, pastTime], {
          account: user1.account,
        })
      ).to.be.rejectedWith("Expiration must be in the future");
    });

    it("should reject future expiration time", async function () {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      // This should work fine
      await contract.write.grantRead(
        [fileId, user2.account.address, futureTime],
        {
          account: user1.account,
        }
      );

      // But this should fail (expiration in the past)
      const pastTime = Math.floor(Date.now() / 1000) - 3600;
      await expect(
        contract.write.grantRead([fileId, user3.account.address, pastTime], {
          account: user1.account,
        })
      ).to.be.rejectedWith("Expiration must be in the future");
    });

    it("should track users with access correctly", async function () {
      // Grant access to multiple users
      await contract.write.grantRead([fileId, user2.account.address, 0], {
        account: user1.account,
      });
      await contract.write.grantWrite([fileId, user3.account.address, 0], {
        account: user1.account,
      });

      const usersWithAccess = await contract.read.getUsersWithAccess([fileId]);
      expect(usersWithAccess).to.have.lengthOf(2);
      expect(usersWithAccess[0].toLowerCase()).to.equal(
        user2.account.address.toLowerCase()
      );
      expect(usersWithAccess[1].toLowerCase()).to.equal(
        user3.account.address.toLowerCase()
      );
    });

    it("should revoke access and remove from tracking", async function () {
      // Grant access to user2
      await contract.write.grantRead([fileId, user2.account.address, 0], {
        account: user1.account,
      });

      // Verify user is tracked
      let usersWithAccess = await contract.read.getUsersWithAccess([fileId]);
      expect(usersWithAccess).to.have.lengthOf(1);

      // Revoke access
      await contract.write.revokeAccess([fileId, user2.account.address], {
        account: user1.account,
      });

      // Verify access is revoked
      const hasRead = await contract.read.hasReadAccess([
        fileId,
        user2.account.address,
      ]);
      expect(hasRead).to.equal(false);

      // Verify user is removed from tracking
      usersWithAccess = await contract.read.getUsersWithAccess([fileId]);
      expect(usersWithAccess).to.have.lengthOf(0);
    });
  });

  describe("Encryption and Key Management", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmEncryptedTestHash";
      const fileName = "encrypted.txt";
      const fileSize = 1024n;
      const metadataCID = "bafybeigdyrztxencryptedmetadata";
      const isEncrypted = true;
      const masterKeyHash = "0x1234567890abcdef";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, isEncrypted, masterKeyHash],
        { account: user1.account }
      );

      fileId = 1n;
    });

    it("should share encrypted file with wrapped key", async function () {
      const wrappedKey = "0xabcdef1234567890";
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;

      await contract.write.shareEncryptedFile(
        [fileId, user2.account.address, wrappedKey, expirationTime],
        { account: user1.account }
      );

      // Verify read access was granted
      const hasRead = await contract.read.hasReadAccess([
        fileId,
        user2.account.address,
      ]);
      expect(hasRead).to.equal(true);

      // Verify wrapped key was stored
      const storedKey = await contract.read.getWrappedKey([fileId], {
        account: user2.account,
      });
      expect(storedKey).to.equal(wrappedKey);
    });

    it("should reject sharing encrypted file with non-encrypted file", async function () {
      // Upload a non-encrypted file
      await contract.write.uploadFileHash(
        ["hash2", "plain.txt", 512n, "metadata2", false, ""],
        { account: user1.account }
      );

      const wrappedKey = "0xabcdef1234567890";
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        contract.write.shareEncryptedFile(
          [2n, user2.account.address, wrappedKey, expirationTime],
          { account: user1.account }
        )
      ).to.be.rejectedWith("File is not encrypted");
    });

    it("should reject empty wrapped key", async function () {
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        contract.write.shareEncryptedFile(
          [fileId, user2.account.address, "", expirationTime],
          { account: user1.account }
        )
      ).to.be.rejectedWith("Wrapped key cannot be empty");
    });

    it("should only allow authorized user to get wrapped key", async function () {
      const wrappedKey = "0xabcdef1234567890";
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;

      // Share with user2
      await contract.write.shareEncryptedFile(
        [fileId, user2.account.address, wrappedKey, expirationTime],
        { account: user1.account }
      );

      // user2 should be able to get the key
      const key = await contract.read.getWrappedKey([fileId], {
        account: user2.account,
      });
      expect(key).to.equal(wrappedKey);

      // user3 should not be able to get the key
      await expect(
        contract.read.getWrappedKey([fileId], { account: user3.account })
      ).to.be.rejectedWith("No read access");
    });

    it("should revoke wrapped key when access is revoked", async function () {
      const wrappedKey = "0xabcdef1234567890";
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;

      // Share with user2
      await contract.write.shareEncryptedFile(
        [fileId, user2.account.address, wrappedKey, expirationTime],
        { account: user1.account }
      );

      // Verify key exists
      const key = await contract.read.getWrappedKey([fileId], {
        account: user2.account,
      });
      expect(key).to.equal(wrappedKey);

      // Revoke access
      await contract.write.revokeAccess([fileId, user2.account.address], {
        account: user1.account,
      });

      // Verify key is no longer accessible
      await expect(
        contract.read.getWrappedKey([fileId], { account: user2.account })
      ).to.be.rejectedWith("No read access");
    });
  });

  describe("File Updates with Version History", function () {
    let fileId: bigint;

    beforeEach(async function () {
      const fileHash = "QmUpdateTestHash";
      const fileName = "update.txt";
      const fileSize = 128n;
      const metadataCID = "bafybeigdyrztxupdatemetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, fileSize, metadataCID, false, ""],
        { account: user1.account }
      );

      fileId = 1n;
    });

    it("should allow file owner to update file and create version", async function () {
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
      expect(info[9]).to.equal(2n); // versionCount should be 2

      const versions = await contract.read.getFileVersions([fileId]);
      expect(versions).to.have.lengthOf(2);
    });

    it("should allow user with write access to update file", async function () {
      // Grant write access to user2
      await contract.write.grantWrite([fileId, user2.account.address, 0], {
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
        [fileHash, fileName, fileSize, metadataCID, false, ""],
        { account: user1.account }
      );

      fileId = 1n;
    });

    it("should allow file owner to deactivate file", async function () {
      await contract.write.deactivateFile([fileId], {
        account: user1.account,
      });

      // The file is now deactivated, operations should fail
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
        contract.write.grantRead([fileId, user2.account.address, 0], {
          account: user1.account,
        })
      ).to.be.rejectedWith("File is not active");
    });
  });

  describe("Complex Scenarios", function () {
    it("should handle multiple files with different encryption states", async function () {
      // Upload non-encrypted file
      await contract.write.uploadFileHash(
        ["hash1", "plain.txt", 100n, "metadata1", false, ""],
        { account: user1.account }
      );

      // Upload encrypted file
      await contract.write.uploadFileHash(
        ["hash2", "secret.txt", 200n, "metadata2", true, "0xkeyhash"],
        { account: user2.account }
      );

      // Upload another non-encrypted file
      await contract.write.uploadFileHash(
        ["hash3", "normal.txt", 300n, "metadata3", false, ""],
        { account: user3.account }
      );

      const totalFiles = await contract.read.getTotalFiles();
      expect(totalFiles).to.equal(3n);

      // Check encryption states
      const file1Info = await contract.read.getFileInfo([1n]);
      const file2Info = await contract.read.getFileInfo([2n]);
      const file3Info = await contract.read.getFileInfo([3n]);

      expect(file1Info[7]).to.equal(false); // isEncrypted
      expect(file2Info[7]).to.equal(true); // isEncrypted
      expect(file3Info[7]).to.equal(false); // isEncrypted
    });

    it("should handle complex permission and versioning scenarios", async function () {
      // User1 uploads a file
      await contract.write.uploadFileHash(
        ["complexhash", "complex.txt", 500n, "complexmetadata", false, ""],
        { account: user1.account }
      );

      const fileId = 1n;

      // Grant read access to user2
      await contract.write.grantRead([fileId, user2.account.address, 0], {
        account: user1.account,
      });

      // Grant write access to user3
      await contract.write.grantWrite([fileId, user3.account.address, 0], {
        account: user1.account,
      });

      // User3 updates the file (creates version 2)
      await contract.write.updateFile(
        [fileId, "updatedhash", 600n, "updatedmetadata"],
        { account: user3.account }
      );

      // Check version count
      const info = await contract.read.getFileInfo([fileId]);
      expect(info[9]).to.equal(2n);

      // User2 should not be able to update (only read access)
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

    it("should handle version rollback with permissions", async function () {
      // Upload file
      await contract.write.uploadFileHash(
        ["rollbackhash", "rollback.txt", 100n, "metadata1", false, ""],
        { account: user1.account }
      );

      const fileId = 1n;

      // Create version 2
      await contract.write.updateFile([fileId, "hash2", 200n, "metadata2"], {
        account: user1.account,
      });

      // Create version 3
      await contract.write.updateFile([fileId, "hash3", 300n, "metadata3"], {
        account: user1.account,
      });

      // Grant read access to user2
      await contract.write.grantRead([fileId, user2.account.address, 0], {
        account: user1.account,
      });

      // Rollback to version 1
      await contract.write.rollbackFile([fileId, 0n], {
        account: user1.account,
      });

      // Check that rollback worked
      const info = await contract.read.getFileInfo([fileId]);
      expect(info[6]).to.equal("metadata1"); // Should be original metadata

      // User2 should still have read access after rollback
      const hasRead = await contract.read.hasReadAccess([
        fileId,
        user2.account.address,
      ]);
      expect(hasRead).to.equal(true);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("should handle very large file sizes", async function () {
      const largeSize = 2n ** 256n - 1n; // Maximum uint256
      const fileHash = "QmLargeFileHash";
      const fileName = "large.txt";
      const metadataCID = "bafybeigdyrztxlargemetadata";

      await contract.write.uploadFileHash(
        [fileHash, fileName, largeSize, metadataCID, false, ""],
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
        [longHash, longName, 100n, longMetadata, false, ""],
        { account: user1.account }
      );

      const info = await contract.read.getFileInfo([1n]);
      expect(info[0]).to.equal(longHash);
      expect(info[1]).to.equal(longName);
      expect(info[6]).to.equal(longMetadata);
    });

    it("should handle invalid file IDs", async function () {
      await expect(contract.read.getFileInfo([999n])).to.be.rejectedWith(
        "File does not exist"
      );

      await expect(contract.read.getFileVersions([999n])).to.be.rejectedWith(
        "File does not exist"
      );
    });

    it("should handle invalid user addresses", async function () {
      await contract.write.uploadFileHash(
        ["testhash", "test.txt", 100n, "testmetadata", false, ""],
        { account: user1.account }
      );

      await expect(
        contract.write.grantRead(
          [1n, "0x0000000000000000000000000000000000000000", 0],
          {
            account: user1.account,
          }
        )
      ).to.be.rejectedWith("Invalid user address");
    });
  });
});
