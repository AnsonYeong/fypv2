import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost, sepolia } from "viem/chains";

// Type definitions for contract return values
export type GetFileInfoResult = [
  string, // fileHash
  string, // fileName
  bigint, // fileSize
  string, // uploader
  bigint, // timestamp
  boolean, // isActive
  string, // metadataCID
  boolean, // isEncrypted
  string // masterKeyHash
];
export type GetUserFilesResult = bigint[];

// Contract ABI aligned with FileRegistryV2
const abi = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "fileId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "fileHash",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "fileName",
        type: "string",
      },
      {
        indexed: true,
        internalType: "address",
        name: "uploader",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "metadataCID",
        type: "string",
      },
    ],
    name: "FileUploaded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "fileId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "newFileHash",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "newMetadataCID",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newSize",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "updatedBy",
        type: "address",
      },
    ],
    name: "FileUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "fileId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "deactivatedBy",
        type: "address",
      },
    ],
    name: "FileDeactivated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "fileId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "grantedTo",
        type: "address",
      },
    ],
    name: "ReadGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "fileId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "grantedTo",
        type: "address",
      },
    ],
    name: "WriteGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "fileId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "revokedFrom",
        type: "address",
      },
    ],
    name: "AccessRevoked",
    type: "event",
  },
  {
    inputs: [
      { internalType: "string", name: "_fileHash", type: "string" },
      { internalType: "string", name: "_fileName", type: "string" },
      { internalType: "uint256", name: "_fileSize", type: "uint256" },
      { internalType: "string", name: "_metadataCID", type: "string" },
      { internalType: "bool", name: "_isEncrypted", type: "bool" },
      { internalType: "string", name: "_masterKeyHash", type: "string" },
    ],
    name: "uploadFileHash",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "string", name: "_newFileHash", type: "string" },
      { internalType: "uint256", name: "_newFileSize", type: "uint256" },
      { internalType: "string", name: "_newMetadataCID", type: "string" },
    ],
    name: "updateFile",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_fileId", type: "uint256" }],
    name: "deactivateFile",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_fileId", type: "uint256" }],
    name: "getFileInfo",
    outputs: [
      { internalType: "string", name: "fileHash", type: "string" },
      { internalType: "string", name: "fileName", type: "string" },
      { internalType: "uint256", name: "fileSize", type: "uint256" },
      { internalType: "address", name: "uploader", type: "address" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "bool", name: "isActive", type: "bool" },
      { internalType: "string", name: "metadataCID", type: "string" },
      { internalType: "bool", name: "isEncrypted", type: "bool" },
      { internalType: "string", name: "masterKeyHash", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_user", type: "address" }],
    name: "getUserFiles",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
    ],
    name: "hasReadAccess",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
    ],
    name: "hasWriteAccess",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
      { internalType: "uint256", name: "_expiresAt", type: "uint256" },
    ],
    name: "grantRead",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
      { internalType: "uint256", name: "_expiresAt", type: "uint256" },
    ],
    name: "grantWrite",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
    ],
    name: "revokeAccess",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "hashToFileId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalFiles",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextFileId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
    ],
    name: "getAccessInfo",
    outputs: [
      { internalType: "bool", name: "hasRead", type: "bool" },
      { internalType: "bool", name: "hasWrite", type: "bool" },
      { internalType: "uint256", name: "grantedAt", type: "uint256" },
      { internalType: "uint256", name: "expiresAt", type: "uint256" },
      { internalType: "bool", name: "expired", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_fileId", type: "uint256" }],
    name: "getUsersWithAccess",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_fileId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
      { internalType: "string", name: "_wrappedKey", type: "string" },
      { internalType: "uint256", name: "_expiresAt", type: "uint256" },
    ],
    name: "shareEncryptedFile",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const address =
  ((process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    process.env.CONTRACT_ADDRESS) as `0x${string}` | undefined) ??
  ("0x" as `0x${string}`);
const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
const chain = rpcUrl.includes("8545") ? localhost : sepolia;

export function getPublic() {
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

export function getWallet() {
  const raw = process.env.SERVER_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "SERVER_PRIVATE_KEY is not set on the server. Set it in your .env file."
    );
  }
  const pk = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (pk.length !== 66) {
    throw new Error(
      "SERVER_PRIVATE_KEY has invalid length. Expect 32-byte hex (64 chars) with 0x prefixed."
    );
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({ account, chain, transport: http(rpcUrl) });
}

export function getReadContract() {
  if (!address || address === ("0x" as `0x${string}`)) {
    throw new Error(
      "Contract address is not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS or CONTRACT_ADDRESS."
    );
  }
  return getContract({ address, abi, client: { public: getPublic() } });
}

export function getWriteContract() {
  const pub = getPublic();
  const wal = getWallet();
  if (!address || address === ("0x" as `0x${string}`)) {
    throw new Error(
      "Contract address is not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS or CONTRACT_ADDRESS."
    );
  }
  return getContract({ address, abi, client: { public: pub, wallet: wal } });
}

// Function to resolve file ID from AppFile object
export async function resolveFileId(file: any, account: `0x${string}`) {
  try {
    const publicClient = getPublic();
    const contract = getContract({
      address,
      abi,
      client: { public: publicClient },
    });

    // If file already has a fileId, use it
    if (file.fileId) {
      return { fileId: file.fileId, foundBy: "existing" };
    }

    // Try to find file by CID (metadataCID)
    if (file.metadataCID) {
      // This would require a mapping function in the contract
      // For now, we'll need to implement a different approach
      console.log("Searching by metadataCID:", file.metadataCID);
    }

    // Try to find file by name and owner
    if (file.name && account) {
      // This would require iterating through user files
      // For now, we'll need to implement a different approach
      console.log("Searching by name and owner:", file.name, account);
    }

    // For now, return a placeholder - this needs proper implementation
    // based on your contract's actual structure
    throw new Error(
      "File ID resolution not yet implemented. Please ensure file has fileId property."
    );
  } catch (error) {
    console.error("Error resolving file ID:", error);
    throw error;
  }
}

// Function to create a write contract instance
export async function createWriteContract() {
  try {
    if (!(window as any).ethereum) {
      throw new Error("MetaMask not found");
    }

    const { createWalletClient, custom } = await import("viem");
    const { hardhat } = await import("viem/chains");

    const walletClient = createWalletClient({
      chain: hardhat,
      transport: custom((window as any).ethereum),
    });

    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new Error("No account connected");
    }

    const contract = getContract({
      address,
      abi,
      client: {
        public: getPublic(),
        wallet: walletClient,
      },
    });

    return { contract, account, walletClient };
  } catch (error) {
    console.error("Error creating write contract:", error);
    throw error;
  }
}
