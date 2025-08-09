import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("FileHashStorage", function () {
  // We define a fixture to reuse the same setup in every test.
  async function deployFileHashStorageFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount, thirdAccount] =
      await hre.viem.getWalletClients();

    const fileHashStorage = await hre.viem.deployContract(
      "FileHashStorage",
      []
    );

    const publicClient = await hre.viem.getPublicClient();

    return {
      fileHashStorage,
      owner,
      otherAccount,
      thirdAccount,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { fileHashStorage, owner } = await loadFixture(
        deployFileHashStorageFixture
      );

      expect(await fileHashStorage.read.owner()).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should initialize with nextFileId as 1", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      expect(await fileHashStorage.read.nextFileId()).to.equal(1n);
    });

    it("Should initialize with zero total files", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      expect(await fileHashStorage.read.getTotalFiles()).to.equal(0n);
    });
  });

  describe("File Upload", function () {
    it("Should upload a file hash successfully", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      const fileHash = "QmTestHash123";
      const fileName = "test.txt";
      const fileSize = 1024n;

      const result = await fileHashStorage.write.uploadFileHash([
        fileHash,
        fileName,
        fileSize,
      ]);
      expect(result).to.be.a("string"); // transaction hash

      // Verify file was stored correctly
      const fileInfo = (await fileHashStorage.read.getFileInfo([1n])) as [
        string,
        string,
        bigint,
        string,
        bigint,
        boolean
      ];
      expect(fileInfo[0]).to.equal(fileHash); // fileHash
      expect(fileInfo[1]).to.equal(fileName); // fileName
      expect(fileInfo[2]).to.equal(fileSize); // fileSize
      expect(fileInfo[5]).to.equal(true); // isActive
    });

    it("Should emit FileUploaded event", async function () {
      const { fileHashStorage, publicClient, owner } = await loadFixture(
        deployFileHashStorageFixture
      );

      const fileHash = "QmTestHash123";
      const fileName = "test.txt";
      const fileSize = 1024n;

      const hash = await fileHashStorage.write.uploadFileHash([
        fileHash,
        fileName,
        fileSize,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const uploadEvents = await fileHashStorage.getEvents.FileUploaded();
      expect(uploadEvents).to.have.lengthOf(1);
      expect((uploadEvents[0].args as any).fileId).to.equal(1n);
      expect((uploadEvents[0].args as any).fileHash).to.equal(fileHash);
      expect((uploadEvents[0].args as any).fileName).to.equal(fileName);
      expect((uploadEvents[0].args as any).uploader).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should reject empty file hash", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      await expect(
        fileHashStorage.write.uploadFileHash(["", "test.txt", 1024n])
      ).to.be.rejectedWith("File hash cannot be empty");
    });

    it("Should reject empty file name", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      await expect(
        fileHashStorage.write.uploadFileHash(["QmTestHash123", "", 1024n])
      ).to.be.rejectedWith("File name cannot be empty");
    });

    it("Should reject zero file size", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      await expect(
        fileHashStorage.write.uploadFileHash(["QmTestHash123", "test.txt", 0n])
      ).to.be.rejectedWith("File size must be greater than 0");
    });

    it("Should reject duplicate file hash", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      const fileHash = "QmTestHash123";

      // Upload first file
      await fileHashStorage.write.uploadFileHash([
        fileHash,
        "test1.txt",
        1024n,
      ]);

      // Try to upload duplicate hash
      await expect(
        fileHashStorage.write.uploadFileHash([fileHash, "test2.txt", 2048n])
      ).to.be.rejectedWith("File with this hash already exists");
    });
  });

  describe("File Retrieval", function () {
    it("Should get user files", async function () {
      const { fileHashStorage, owner } = await loadFixture(
        deployFileHashStorageFixture
      );

      // Upload two files
      await fileHashStorage.write.uploadFileHash([
        "QmHash1",
        "file1.txt",
        1024n,
      ]);
      await fileHashStorage.write.uploadFileHash([
        "QmHash2",
        "file2.txt",
        2048n,
      ]);

      const userFiles = (await fileHashStorage.read.getUserFiles([
        getAddress(owner.account.address),
      ])) as bigint[];
      expect(userFiles).to.have.lengthOf(2);
      expect(userFiles[0]).to.equal(1n);
      expect(userFiles[1]).to.equal(2n);
    });

    it("Should get file hash by ID", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      const fileHash = "QmTestHash123";
      await fileHashStorage.write.uploadFileHash([fileHash, "test.txt", 1024n]);

      const retrievedHash = await fileHashStorage.read.getFileHash([1n]);
      expect(retrievedHash).to.equal(fileHash);
    });

    it("Should verify hash exists", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      const fileHash = "QmTestHash123";
      await fileHashStorage.write.uploadFileHash([fileHash, "test.txt", 1024n]);

      const [exists, fileId] = (await fileHashStorage.read.verifyHash([
        fileHash,
      ])) as [boolean, bigint];
      expect(exists).to.equal(true);
      expect(fileId).to.equal(1n);
    });

    it("Should return false for non-existent hash", async function () {
      const { fileHashStorage } = await loadFixture(
        deployFileHashStorageFixture
      );

      const [exists, fileId] = (await fileHashStorage.read.verifyHash([
        "QmNonExistentHash",
      ])) as [boolean, bigint];
      expect(exists).to.equal(false);
      expect(fileId).to.equal(0n);
    });
  });

  describe("File Sharing", function () {
    it("Should share file with another user", async function () {
      const { fileHashStorage, otherAccount, publicClient } = await loadFixture(
        deployFileHashStorageFixture
      );

      // Upload a file
      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      // Share with another user
      const otherUserAddress = otherAccount.account.address;
      const hash = await fileHashStorage.write.shareFile([
        1n,
        otherUserAddress,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Verify sharing
      const sharedUsers = (await fileHashStorage.read.getSharedUsers([
        1n,
      ])) as string[];
      expect(sharedUsers).to.have.lengthOf(1);
      expect(getAddress(sharedUsers[0] as string)).to.equal(
        getAddress(otherUserAddress)
      );

      // Check access
      const hasAccess = await fileHashStorage.read.hasAccess([
        1n,
        otherAccount.account.address,
      ]);
      expect(hasAccess).to.equal(true);
    });

    it("Should emit FileShared event", async function () {
      const { fileHashStorage, owner, otherAccount, publicClient } =
        await loadFixture(deployFileHashStorageFixture);

      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      const otherUserAddress = otherAccount.account.address;
      const hash = await fileHashStorage.write.shareFile([
        1n,
        otherUserAddress,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const shareEvents = await fileHashStorage.getEvents.FileShared();
      expect(shareEvents).to.have.lengthOf(1);
      expect((shareEvents[0].args as any).fileId).to.equal(1n);
      expect((shareEvents[0].args as any).sharedBy).to.equal(
        getAddress(owner.account.address)
      );
      expect((shareEvents[0].args as any).sharedWith).to.equal(
        getAddress(otherUserAddress).toLowerCase()
      );
    });

    it("Should reject sharing by non-owner", async function () {
      const { fileHashStorage, otherAccount, thirdAccount } = await loadFixture(
        deployFileHashStorageFixture
      );

      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      // Try to share from non-owner account
      const fileHashStorageAsOther = await hre.viem.getContractAt(
        "FileHashStorage",
        fileHashStorage.address,
        { client: { wallet: otherAccount } }
      );

      await expect(
        fileHashStorageAsOther.write.shareFile([
          1n,
          thirdAccount.account.address,
        ])
      ).to.be.rejectedWith("Only file owner can perform this action");
    });
  });

  describe("File Deactivation", function () {
    it("Should deactivate file by owner", async function () {
      const { fileHashStorage, publicClient } = await loadFixture(
        deployFileHashStorageFixture
      );

      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      const hash = await fileHashStorage.write.deactivateFile([1n]);
      await publicClient.waitForTransactionReceipt({ hash });

      // File should no longer be accessible
      await expect(fileHashStorage.read.getFileInfo([1n])).to.be.rejectedWith(
        "File is not active"
      );
    });

    it("Should emit FileDeactivated event", async function () {
      const { fileHashStorage, owner, publicClient } = await loadFixture(
        deployFileHashStorageFixture
      );

      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      const hash = await fileHashStorage.write.deactivateFile([1n]);
      await publicClient.waitForTransactionReceipt({ hash });

      const deactivateEvents =
        await fileHashStorage.getEvents.FileDeactivated();
      expect(deactivateEvents).to.have.lengthOf(1);
      expect((deactivateEvents[0].args as any).fileId).to.equal(1n);
      expect((deactivateEvents[0].args as any).deactivatedBy).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should reject deactivation by non-owner", async function () {
      const { fileHashStorage, otherAccount } = await loadFixture(
        deployFileHashStorageFixture
      );

      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      const fileHashStorageAsOther = await hre.viem.getContractAt(
        "FileHashStorage",
        fileHashStorage.address,
        { client: { wallet: otherAccount } }
      );

      await expect(
        fileHashStorageAsOther.write.deactivateFile([1n])
      ).to.be.rejectedWith("Only file owner can perform this action");
    });
  });

  describe("Access Control", function () {
    it("Should grant access to file owner", async function () {
      const { fileHashStorage, owner } = await loadFixture(
        deployFileHashStorageFixture
      );

      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      const hasAccess = await fileHashStorage.read.hasAccess([
        1n,
        owner.account.address,
      ]);
      expect(hasAccess).to.equal(true);
    });

    it("Should deny access to non-shared users", async function () {
      const { fileHashStorage, otherAccount } = await loadFixture(
        deployFileHashStorageFixture
      );

      await fileHashStorage.write.uploadFileHash([
        "QmTestHash123",
        "test.txt",
        1024n,
      ]);

      const hasAccess = await fileHashStorage.read.hasAccess([
        1n,
        otherAccount.account.address,
      ]);
      expect(hasAccess).to.equal(false);
    });
  });
});
