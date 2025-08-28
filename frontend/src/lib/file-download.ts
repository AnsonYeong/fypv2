import { retrieveMetadata } from "./metadata-upload";
import { unwrapKeyWithPassword } from "./metadata";
import { FileMetadata } from "./metadata";
import {
  getReadContract,
  GetUserFilesResult,
  GetFileInfoResult,
} from "./contract";

export interface DownloadResult {
  success: boolean;
  file?: File;
  error?: string;
  metadata?: FileMetadata;
}

export interface DownloadOptions {
  metadataCID?: string;
  fileCID?: string;
  userAddress: string;
  password: string;
}

export class FileDownloadService {
  /**
   * Resolve metadata CID from a file CID by scanning accessible on-chain files
   */
  static async resolveMetadataCidFromFileCid(
    userAddress: string,
    fileCid: string
  ): Promise<string | null> {
    try {
      const contract = getReadContract();
      const total = (await contract.read.getTotalFiles()) as bigint;
      if (!total || total === BigInt(0)) return null;

      for (let i = BigInt(1); i <= total; i++) {
        try {
          const canRead = await contract.read.hasReadAccess([
            i,
            userAddress as `0x${string}`,
          ]);
          if (!canRead) continue;

          const info = (await contract.read.getFileInfo([
            i,
          ])) as GetFileInfoResult;
          const mdCid = info[6];
          const md = await retrieveMetadata(mdCid);
          if (md.ipfs.fileCID === fileCid) {
            return mdCid;
          }
        } catch {
          // continue scanning
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to resolve metadata CID:", error);
      return null;
    }
  }

  /**
   * Complete file download and decryption process
   */
  static async downloadAndDecryptFile(
    options: DownloadOptions
  ): Promise<DownloadResult> {
    try {
      let metadataCidToUse = options.metadataCID;

      // Auto-resolve metadata CID if only fileCID is provided
      if (!metadataCidToUse && options.fileCID) {
        const resolvedCid = await this.resolveMetadataCidFromFileCid(
          options.userAddress,
          options.fileCID
        );
        if (!resolvedCid) {
          return {
            success: false,
            error: "Could not find metadata for this file",
          };
        }
        metadataCidToUse = resolvedCid;
      }

      if (!metadataCidToUse) {
        return { success: false, error: "Missing metadata CID" };
      }

      // Step 1: Retrieve metadata using our API
      const metadataResponse = await fetch("/api/contract/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadataCID: metadataCidToUse,
          userAddress: options.userAddress,
        }),
      });

      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json();
        return {
          success: false,
          error: errorData.error || "Failed to retrieve metadata",
        };
      }

      const metadataResult = await metadataResponse.json();
      const metadata: FileMetadata = metadataResult.metadata;

      // Step 2: Extract and unwrap the encryption key
      const encryptionKey = unwrapKeyWithPassword(
        metadata.encryption.keyWrapped,
        options.password,
        metadata.encryption.salt,
        metadata.encryption.iterations
      );

      // Step 3: Download the encrypted file from IPFS
      const encryptedFileResponse = await fetch(metadata.ipfs.gateway);
      if (!encryptedFileResponse.ok) {
        return {
          success: false,
          error: "Failed to download encrypted file from IPFS",
        };
      }

      const encryptedFileBuffer = await encryptedFileResponse.arrayBuffer();

      // Step 4: Decrypt the file
      const decryptedFileBuffer = await this.decryptFile(
        new Uint8Array(encryptedFileBuffer),
        encryptionKey,
        metadata.encryption.iv
      );

      // Step 5: Create and return the decrypted file
      const decryptedFile = new File(
        [decryptedFileBuffer],
        metadata.fileInfo.originalName,
        { type: metadata.fileInfo.mimeType || "application/octet-stream" }
      );

      return {
        success: true,
        file: decryptedFile,
        metadata: metadata,
      };
    } catch (error) {
      console.error("Download and decryption failed:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Decrypt file data using AES-256-GCM
   */
  private static async decryptFile(
    encryptedData: Uint8Array,
    keyHex: string,
    ivHex: string
  ): Promise<Uint8Array> {
    try {
      // Convert hex key and hex IV to buffers
      const keyBytes = keyHex.match(/^[0-9a-fA-F]+$/) ? keyHex : "";
      const ivBytes = ivHex.match(/^[0-9a-fA-F]+$/) ? ivHex : "";

      if (!keyBytes || keyBytes.length !== 64) {
        throw new Error(
          "Invalid key format (expected 64 hex chars for 32 bytes)"
        );
      }
      if (!ivBytes || (ivBytes.length !== 24 && ivBytes.length !== 32)) {
        // 12-byte (24 hex) IV is standard; allow 16-byte (32 hex) if earlier data used it
        throw new Error("Invalid IV format (expected 24 or 32 hex chars)");
      }

      const keyBuffer = new Uint8Array(
        keyBytes.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
      const ivBuffer = new Uint8Array(
        ivBytes.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      // Use Web Crypto API for decryption
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: ivBuffer,
        },
        cryptoKey,
        encryptedData
      );

      return new Uint8Array(decryptedBuffer);
    } catch (error) {
      throw new Error(
        `Decryption failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get list of downloadable files for a user
   */
  static async getDownloadableFiles(
    userAddress: string
  ): Promise<FileMetadata[]> {
    try {
      // This would integrate with your existing getUserFiles function
      // For now, we'll return an empty array - you can implement this based on your needs
      return [];
    } catch (error) {
      console.error("Failed to get downloadable files:", error);
      return [];
    }
  }

  /**
   * Verify file access before attempting download
   */
  static async verifyFileAccess(
    metadataCID: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      const response = await fetch("/api/contract/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadataCID: metadataCID,
          userAddress: userAddress,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error("Access verification failed:", error);
      return false;
    }
  }

  /**
   * Download file directly to user's device
   */
  static downloadFileToDevice(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
