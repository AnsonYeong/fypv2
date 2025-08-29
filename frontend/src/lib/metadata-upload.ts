import {
  createFileMetadata,
  FileMetadata,
  updateMetadataWithBlockchain,
} from "./metadata";
import {
  getWriteContract,
  getReadContract,
  GetFileInfoResult,
  GetUserFilesResult,
} from "./contract";

export interface UploadResult {
  fileCID: string;
  metadataCID: string;
  metadata: FileMetadata;
  blockchain: {
    fileId: number;
    txHash: string;
    blockNumber?: number;
  };
}

export interface UploadOptions {
  password: string;
  uploaderAddress: string;
  contractAddress: string;
  pinataJWT: string;
}

// Upload encrypted file and metadata to IPFS
export async function uploadEncryptedFileWithMetadata(
  encryptedFile: File,
  originalFile: File,
  encryptionKey: string,
  iv: string,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    // Step 1: Upload encrypted file to IPFS
    const fileFormData = new FormData();
    fileFormData.append("file", encryptedFile);

    const fileResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.pinataJWT}`,
        },
        body: fileFormData,
      }
    );

    if (!fileResponse.ok) {
      throw new Error(
        `Failed to upload encrypted file: ${fileResponse.statusText}`
      );
    }

    const fileResult = await fileResponse.json();
    const fileCID = fileResult.IpfsHash;

    // Step 2: Create metadata
    const metadata = await createFileMetadata(
      originalFile,
      encryptedFile,
      fileCID,
      encryptionKey,
      iv,
      options.password,
      options.uploaderAddress,
      options.contractAddress
    );

    // Step 3: Upload metadata to IPFS
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json",
    });
    const metadataFile = new File([metadataBlob], "metadata.json", {
      type: "application/json",
    });

    const metadataFormData = new FormData();
    metadataFormData.append("file", metadataFile);

    const metadataResponse = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.pinataJWT}`,
        },
        body: metadataFormData,
      }
    );

    if (!metadataResponse.ok) {
      throw new Error(
        `Failed to upload metadata: ${metadataResponse.statusText}`
      );
    }

    const metadataResult = await metadataResponse.json();
    const metadataCID = metadataResult.IpfsHash;

    // Step 4: Update metadata with metadata CID
    metadata.ipfs.metadataCID = metadataCID;

    // Step 5: Upload to blockchain (pass 4 args)
    const contract = getWriteContract();
    const txHash = await contract.write.uploadFileHash([
      metadataCID, // store metadata CID as fileHash on-chain
      originalFile.name,
      BigInt(originalFile.size),
      metadataCID,
    ]);

    // Step 6: Get file ID from blockchain via mapping
    const fileIdBig = (await getReadContract().read.hashToFileId([
      metadataCID,
    ])) as bigint;
    if (fileIdBig === BigInt(0)) {
      throw new Error("Failed to verify file on blockchain (id=0)");
    }

    // Step 7: Update metadata with blockchain info
    const finalMetadata = updateMetadataWithBlockchain(
      metadata,
      Number(fileIdBig),
      txHash,
      0 // blockNumber will be updated later if needed
    );

    // Step 8: Re-upload updated metadata (optional - for consistency)
    const updatedMetadataBlob = new Blob(
      [JSON.stringify(finalMetadata, null, 2)],
      {
        type: "application/json",
      }
    );
    const updatedMetadataFile = new File(
      [updatedMetadataBlob],
      "metadata.json",
      {
        type: "application/json",
      }
    );

    const updatedMetadataFormData = new FormData();
    updatedMetadataFormData.append("file", updatedMetadataFile);

    await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.pinataJWT}`,
      },
      body: updatedMetadataFormData,
    });

    return {
      fileCID,
      metadataCID,
      metadata: finalMetadata,
      blockchain: {
        fileId: Number(fileIdBig),
        txHash,
        blockNumber: 0,
      },
    };
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
}

// Retrieve metadata from IPFS
export async function retrieveMetadata(
  metadataCID: string
): Promise<FileMetadata> {
  try {
    const response = await fetch(
      `https://gateway.pinata.cloud/ipfs/${metadataCID}`
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve metadata: ${response.statusText}`);
    }

    const metadataText = await response.text();
    const metadata = JSON.parse(metadataText) as FileMetadata;

    return metadata;
  } catch (error) {
    console.error("Failed to retrieve metadata:", error);
    throw error;
  }
}

// Verify file access using metadata and blockchain
export async function verifyFileAccess(
  metadataCID: string,
  userAddress: string,
  permission: "read" | "write" | "share" | "delete" = "read"
): Promise<boolean> {
  try {
    const contract = getReadContract();

    // Resolve fileId via mapping
    const fileIdBig = (await contract.read.hashToFileId([
      metadataCID,
    ])) as bigint;
    if (fileIdBig === BigInt(0)) return false;

    // Check chain-level access (authoritative)
    const hasAccess = await contract.read.hasReadAccess([
      fileIdBig,
      userAddress as `0x${string}`,
    ]);
    if (!hasAccess) return false;

    // If chain access is granted, consider it sufficient
    return true;
  } catch (error) {
    console.error("Access verification failed:", error);
    return false;
  }
}

// Share file with another user (off-chain metadata list plus on-chain read grant)
export async function shareFile(
  metadataCID: string,
  targetAddress: string,
  userAddress: string
): Promise<boolean> {
  try {
    // Resolve fileId
    const read = getReadContract();
    const write = getWriteContract();
    const fileIdBig = (await read.read.hashToFileId([metadataCID])) as bigint;
    if (fileIdBig === BigInt(0)) throw new Error("File not found on chain");

    // Grant read on-chain (only owner can)
    await write.write.grantRead([fileIdBig, targetAddress as `0x${string}`]);

    // Update metadata
    const metadata = await retrieveMetadata(metadataCID);
    if (!metadata.access.sharedWith.includes(targetAddress)) {
      metadata.access.sharedWith.push(targetAddress);
    }

    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json",
    });
    const metadataFile = new File([metadataBlob], "metadata.json", {
      type: "application/json",
    });

    const formData = new FormData();
    formData.append("file", metadataFile);

    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update metadata");
    }

    return true;
  } catch (error) {
    console.error("File sharing failed:", error);
    throw error;
  }
}

// Get user's files from blockchain and metadata
export async function getUserFiles(userAddress: string): Promise<
  Array<{
    fileId: number;
    metadata: FileMetadata;
    blockchainInfo: {
      txHash: string;
      timestamp: number;
    };
  }>
> {
  try {
    const contract = getReadContract();
    const fileIds = (await contract.read.getUserFiles([
      userAddress as `0x${string}`,
    ])) as GetUserFilesResult;

    const files = [] as Array<{
      fileId: number;
      metadata: FileMetadata;
      blockchainInfo: { txHash: string; timestamp: number };
    }>;

    for (const fileId of fileIds) {
      try {
        // Get file info from blockchain
        const fileInfo = (await contract.read.getFileInfo([
          fileId,
        ])) as GetFileInfoResult;
        const metadataCID = fileInfo[6];

        // Retrieve metadata
        const metadata = await retrieveMetadata(metadataCID);

        files.push({
          fileId: Number(fileId),
          metadata,
          blockchainInfo: {
            txHash: metadata.blockchain.txHash || "",
            timestamp: metadata.blockchain.timestamp,
          },
        });
      } catch (error) {
        console.error(`Failed to retrieve file ${fileId}:`, error);
        // Continue with other files
      }
    }

    return files;
  } catch (error) {
    console.error("Failed to get user files:", error);
    throw error;
  }
}
