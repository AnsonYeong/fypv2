import crypto from "crypto";

// Types for metadata structure
export interface FileMetadata {
  version: string;
  fileInfo: {
    originalName: string;
    originalSize: number;
    encryptedSize: number;
    mimeType: string;
    uploadDate: string;
    lastModified: string;
  };
  encryption: {
    algorithm: "AES-GCM-256";
    keyWrapped: string; // Base64 encoded wrapped key
    iv: string; // Base64 encoded IV
    salt: string; // Base64 encoded salt for key derivation
    iterations: number; // PBKDF2 iterations
  };
  ipfs: {
    fileCID: string; // Encrypted file CID
    metadataCID?: string; // Self-reference CID (optional)
    gateway: string; // IPFS gateway URL
  };
  blockchain: {
    contractAddress: string;
    fileId?: number; // Will be set after contract upload
    uploader: string; // Ethereum address
    txHash?: string; // Transaction hash
    blockNumber?: number;
    timestamp: number;
  };
  access: {
    owner: string; // Ethereum address
    sharedWith: string[]; // Array of Ethereum addresses
    permissions: {
      read: boolean;
      write: boolean;
      share: boolean;
      delete: boolean;
    };
  };
  integrity: {
    originalHash: string; // SHA-256 of original file
    encryptedHash: string; // SHA-256 of encrypted file
    metadataHash: string; // SHA-256 of this metadata (excluding this field)
  };
}

export interface EncryptionResult {
  encryptedFile: File;
  metadata: FileMetadata;
  key: string; // Raw encryption key (hex)
  iv: string; // IV (hex)
}

export interface DecryptionRequest {
  metadata: FileMetadata;
  password?: string; // For password-based decryption
  privateKey?: string; // For key-based decryption
}

// Safe deep copy function (CSP-friendly)
function deepCopy<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map((item) => deepCopy(item)) as T;

  if (typeof obj === "object") {
    const copiedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        copiedObj[key] = deepCopy(obj[key]);
      }
    }
    return copiedObj;
  }

  return obj;
}

// Generate SHA-256 hash
export function generateSHA256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Generate random salt
export function generateSalt(): string {
  return crypto.randomBytes(32).toString("base64");
}

// Generate random IV
export function generateIV(): string {
  return crypto.randomBytes(12).toString("base64");
}

// Wrap encryption key with a password (PBKDF2 + AES)
export function wrapKeyWithPassword(
  key: string,
  password: string,
  salt: string,
  iterations: number = 100000
): string {
  const keyBuffer = Buffer.from(key, "hex");
  const passwordBuffer = Buffer.from(password, "utf8");

  // Derive key from password using PBKDF2
  const derivedKey = crypto.pbkdf2Sync(
    passwordBuffer,
    Buffer.from(salt, "base64"),
    iterations,
    32,
    "sha256"
  );

  // Generate wrapping key and IV
  const wrappingKey = crypto.randomBytes(32);
  const wrappingIV = crypto.randomBytes(12);

  // Encrypt the file encryption key
  const cipher = crypto.createCipheriv("aes-256-gcm", wrappingKey, wrappingIV);
  cipher.setAAD(derivedKey);

  let wrappedKey = cipher.update(keyBuffer);
  wrappedKey = Buffer.concat([wrappedKey, cipher.final()]);

  // Combine wrapped key with auth tag, wrapping key, wrapping IV, and derived key
  const authTag = cipher.getAuthTag();
  const finalWrappedKey = Buffer.concat([
    wrappedKey,
    authTag,
    wrappingKey,
    wrappingIV,
    derivedKey, // Store the derived key for verification
  ]);

  return finalWrappedKey.toString("base64");
}

// Unwrap encryption key with password
export function unwrapKeyWithPassword(
  wrappedKeyData: string,
  password: string,
  salt: string,
  iterations: number = 100000
): string {
  const wrappedBuffer = Buffer.from(wrappedKeyData, "base64");

  // Calculate sizes
  const keySize = 32; // 32 bytes for the original key
  const authTagSize = 16; // 16 bytes for GCM auth tag
  const wrappingKeySize = 32; // 32 bytes for wrapping key
  const wrappingIVSize = 12; // 12 bytes for wrapping IV
  const derivedKeySize = 32; // 32 bytes for derived key

  // Extract components from the end
  const totalSize = wrappedBuffer.length;
  const derivedKeyStart = totalSize - derivedKeySize;
  const wrappingIVStart = derivedKeyStart - wrappingIVSize;
  const wrappingKeyStart = wrappingIVStart - wrappingKeySize;
  const authTagStart = wrappingKeyStart - authTagSize;
  const wrappedKeyEnd = authTagStart;

  const wrappedKey = wrappedBuffer.slice(0, wrappedKeyEnd);
  const authTag = wrappedBuffer.slice(authTagStart, wrappingKeyStart);
  const wrappingKey = wrappedBuffer.slice(wrappingKeyStart, wrappingIVStart);
  const wrappingIV = wrappedBuffer.slice(wrappingIVStart, derivedKeyStart);
  const storedDerivedKey = wrappedBuffer.slice(derivedKeyStart);

  // Derive key from password
  const passwordBuffer = Buffer.from(password, "utf8");
  const derivedKeyFromPassword = crypto.pbkdf2Sync(
    passwordBuffer,
    Buffer.from(salt, "base64"),
    iterations,
    32,
    "sha256"
  );

  // Verify derived key matches
  if (!derivedKeyFromPassword.equals(storedDerivedKey)) {
    throw new Error("Invalid password or salt");
  }

  // Decrypt the wrapped key
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    wrappingKey,
    wrappingIV
  );
  decipher.setAAD(derivedKeyFromPassword);
  decipher.setAuthTag(authTag);

  let decryptedKey = decipher.update(wrappedKey);
  decryptedKey = Buffer.concat([decryptedKey, decipher.final()]);

  return decryptedKey.toString("hex");
}

// Create metadata for an encrypted file
export async function createFileMetadata(
  file: File,
  encryptedFile: File,
  fileCID: string,
  encryptionKey: string,
  iv: string,
  password: string,
  uploaderAddress: string,
  contractAddress: string
): Promise<FileMetadata> {
  const salt = generateSalt();
  const iterations = 100000;

  // Generate hashes
  const originalBuffer = await file.arrayBuffer();
  const encryptedBuffer = await encryptedFile.arrayBuffer();

  const originalHash = generateSHA256(Buffer.from(originalBuffer));
  const encryptedHash = generateSHA256(Buffer.from(encryptedBuffer));

  // Wrap the encryption key
  const wrappedKey = wrapKeyWithPassword(
    encryptionKey,
    password,
    salt,
    iterations
  );

  // Create metadata structure
  const metadata: FileMetadata = {
    version: "1.0.0",
    fileInfo: {
      originalName: file.name,
      originalSize: file.size,
      encryptedSize: encryptedFile.size,
      mimeType: file.type || "application/octet-stream",
      uploadDate: new Date().toISOString(),
      lastModified: new Date(file.lastModified).toISOString(),
    },
    encryption: {
      algorithm: "AES-GCM-256",
      keyWrapped: wrappedKey,
      iv: iv,
      salt: salt,
      iterations: iterations,
    },
    ipfs: {
      fileCID: fileCID,
      gateway: `https://gateway.pinata.cloud/ipfs/${fileCID}`,
    },
    blockchain: {
      contractAddress: contractAddress,
      uploader: uploaderAddress,
      timestamp: Math.floor(Date.now() / 1000),
    },
    access: {
      owner: uploaderAddress,
      sharedWith: [],
      permissions: {
        read: true,
        write: false,
        share: true,
        delete: true,
      },
    },
    integrity: {
      originalHash: originalHash,
      encryptedHash: encryptedHash,
      metadataHash: "", // Will be set after creation
    },
  };

  // Calculate metadata hash (excluding the integrity.metadataHash field)
  // IMPORTANT: Use safe deep copy to avoid modifying the original object
  const metadataForHash = deepCopy(metadata);
  metadataForHash.integrity.metadataHash = "";

  // Create a stable string representation for hashing
  // Sort all nested object keys recursively for consistent hashing
  const sortObjectKeys = (obj: any): any => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);

    const sortedObj: any = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sortedObj[key] = sortObjectKeys(obj[key]);
      });
    return sortedObj;
  };

  const sortedMetadata = sortObjectKeys(metadataForHash);
  const metadataString = JSON.stringify(sortedMetadata);
  const metadataHash = generateSHA256(metadataString);

  console.log("🔍 Debug - Metadata Hash Calculation:");
  console.log("  - Calculated Hash:", metadataHash);
  console.log("  - Hash Length:", metadataHash.length);

  // Create final metadata object with the hash included
  const finalMetadata: FileMetadata = {
    ...metadata,
    integrity: {
      ...metadata.integrity,
      metadataHash: metadataHash,
    },
  };

  console.log("🔍 Debug - Final Metadata:");
  console.log("  - Final Hash:", finalMetadata.integrity.metadataHash);
  console.log(
    "  - Final Hash Length:",
    finalMetadata.integrity.metadataHash.length
  );

  // Double-check the hash is properly set
  console.log("🔍 Final Check - metadataHash field:");
  console.log("  - Type:", typeof finalMetadata.integrity.metadataHash);
  console.log("  - Value:", finalMetadata.integrity.metadataHash);
  console.log("  - Length:", finalMetadata.integrity.metadataHash.length);
  console.log(
    "  - Is empty string:",
    finalMetadata.integrity.metadataHash === ""
  );

  // Triple-check the object structure
  console.log("🔍 Object Structure Check:");
  console.log("  - Final metadata object:", finalMetadata);
  console.log("  - Final metadata.integrity:", finalMetadata.integrity);
  console.log(
    "  - Final metadata.integrity.metadataHash:",
    finalMetadata.integrity.metadataHash
  );
  console.log(
    "  - JSON.stringify test:",
    JSON.stringify(finalMetadata, null, 2).substring(0, 200) + "..."
  );

  return finalMetadata;
}

// Validate metadata integrity
export function validateMetadata(metadata: FileMetadata): boolean {
  try {
    // Check if all required fields exist
    if (
      !metadata.version ||
      !metadata.fileInfo ||
      !metadata.encryption ||
      !metadata.ipfs ||
      !metadata.blockchain ||
      !metadata.access ||
      !metadata.integrity
    ) {
      return false;
    }

    // Validate version
    if (metadata.version !== "1.0.0") {
      return false;
    }

    // Validate encryption algorithm
    if (metadata.encryption.algorithm !== "AES-GCM-256") {
      return false;
    }

    // Validate hashes
    // IMPORTANT: Use safe deep copy to avoid modifying the original object
    const metadataForHash = deepCopy(metadata);
    metadataForHash.integrity.metadataHash = "";

    // Use the same hash calculation logic as creation
    const sortObjectKeys = (obj: any): any => {
      if (obj === null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sortObjectKeys);

      const sortedObj: any = {};
      Object.keys(obj)
        .sort()
        .forEach((key) => {
          sortedObj[key] = sortObjectKeys(obj[key]);
        });
      return sortedObj;
    };

    const sortedMetadata = sortObjectKeys(metadataForHash);
    const metadataString = JSON.stringify(sortedMetadata);
    const calculatedHash = generateSHA256(metadataString);

    console.log("🔍 Validation Debug:");
    console.log("  - Input metadata integrity:", metadata.integrity);
    console.log("  - Calculated hash:", calculatedHash);
    console.log("  - Stored hash:", metadata.integrity.metadataHash);
    console.log(
      "  - Hash match:",
      calculatedHash === metadata.integrity.metadataHash
    );

    if (calculatedHash !== metadata.integrity.metadataHash) {
      console.error("Hash mismatch:", {
        calculated: calculatedHash,
        stored: metadata.integrity.metadataHash,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Metadata validation error:", error);
    return false;
  }
}

// Extract file information from metadata
export function getFileInfoFromMetadata(metadata: FileMetadata) {
  return {
    name: metadata.fileInfo.originalName,
    size: metadata.fileInfo.originalSize,
    encryptedSize: metadata.fileInfo.encryptedSize,
    mimeType: metadata.fileInfo.mimeType,
    uploadDate: metadata.fileInfo.uploadDate,
    isEncrypted: true,
    algorithm: metadata.encryption.algorithm,
    fileCID: metadata.ipfs.fileCID,
    gatewayUrl: metadata.ipfs.gateway,
    owner: metadata.access.owner,
    sharedWith: metadata.access.sharedWith,
    permissions: metadata.access.permissions,
  };
}

// Update metadata after blockchain operations
export function updateMetadataWithBlockchain(
  metadata: FileMetadata,
  fileId: number,
  txHash: string,
  blockNumber: number
): FileMetadata {
  return {
    ...metadata,
    blockchain: {
      ...metadata.blockchain,
      fileId: fileId,
      txHash: txHash,
      blockNumber: blockNumber,
    },
  };
}

// Add shared user to metadata
export function addSharedUser(
  metadata: FileMetadata,
  userAddress: string
): FileMetadata {
  if (!metadata.access.sharedWith.includes(userAddress)) {
    return {
      ...metadata,
      access: {
        ...metadata.access,
        sharedWith: [...metadata.access.sharedWith, userAddress],
      },
    };
  }
  return metadata;
}

// Remove shared user from metadata
export function removeSharedUser(
  metadata: FileMetadata,
  userAddress: string
): FileMetadata {
  return {
    ...metadata,
    access: {
      ...metadata.access,
      sharedWith: metadata.access.sharedWith.filter(
        (addr) => addr !== userAddress
      ),
    },
  };
}

// Check if user has access to file
export function hasAccess(
  metadata: FileMetadata,
  userAddress: string,
  permission: keyof FileMetadata["access"]["permissions"] = "read"
): boolean {
  // Owner has all permissions
  if (metadata.access.owner.toLowerCase() === userAddress.toLowerCase()) {
    return true;
  }

  // Shared users have read permission by default
  if (
    metadata.access.sharedWith.some(
      (addr) => addr.toLowerCase() === userAddress.toLowerCase()
    )
  ) {
    return permission === "read";
  }

  return false;
}

// Export metadata as JSON string
export function exportMetadata(metadata: FileMetadata): string {
  return JSON.stringify(metadata, null, 2);
}

// Import metadata from JSON string
export function importMetadata(jsonString: string): FileMetadata {
  try {
    const metadata = JSON.parse(jsonString) as FileMetadata;
    if (validateMetadata(metadata)) {
      return metadata;
    } else {
      throw new Error("Invalid metadata format");
    }
  } catch (error) {
    throw new Error(`Failed to import metadata: ${error}`);
  }
}
