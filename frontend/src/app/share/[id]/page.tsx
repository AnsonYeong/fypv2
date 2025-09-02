"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Lock,
  Eye,
  FileText,
  Calendar,
  User,
  Loader2,
} from "lucide-react";

interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  cid: string;
  gatewayUrl: string;
  encrypted: boolean;
  owner: string;
  sharedAt: number;
  expiresAt: number;
  permissions: {
    read: boolean;
    write: boolean;
  };
}

export default function ShareAccessPage() {
  const params = useParams();
  const fileId = params.id as string;

  const [file, setFile] = useState<SharedFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [wrappedKey, setWrappedKey] = useState("");
  const [decryptionPassword, setDecryptionPassword] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    // Load file details from blockchain using the metadata CID from URL
    const loadFileDetails = async () => {
      try {
        setIsLoading(true);

        // The fileId from URL is actually the metadata CID
        const metadataCID = fileId;
        console.log("🔍 Loading file details for metadata CID:", metadataCID);

        // Set basic file info - real details will be loaded when access is verified
        setFile({
          id: metadataCID, // This is actually the metadata CID
          name: "Loading...", // Will be updated when we fetch from IPFS
          size: 0,
          type: "unknown",
          cid: metadataCID,
          gatewayUrl: "",
          encrypted: true,
          owner: "",
          sharedAt: 0,
          expiresAt: 0,
          permissions: {
            read: false,
            write: false,
          },
        });

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading file details:", error);
        setIsLoading(false);
      }
    };

    if (fileId) {
      loadFileDetails();
    }
  }, [fileId]);

  const fetchFileMetadata = async (metadataCID: string) => {
    try {
      console.log("🔍 Fetching file metadata from IPFS:", metadataCID);

      // Fetch metadata from IPFS via our API
      const response = await fetch(
        `/api/ipfs/retrieve?cid=${encodeURIComponent(metadataCID)}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`);
      }

      const metadata = await response.json();
      console.log("✅ File metadata loaded:", metadata);

      // Update file with real metadata
      setFile((prevFile) =>
        prevFile
          ? {
              ...prevFile,
              name: metadata.fileInfo?.originalName || "Unknown File",
              size: metadata.fileInfo?.originalSize || 0,
              type: metadata.fileInfo?.mimeType || "unknown",
              gatewayUrl: metadata.ipfs?.gatewayUrl || "",
              encrypted: metadata.encryption?.algorithm === "AES-GCM-256",
              owner: metadata.blockchain?.owner || "",
              sharedAt: metadata.blockchain?.timestamp || 0,
              expiresAt: 0, // Will be set from blockchain access info
              // IMPORTANT: Set the actual file CID for downloads, not the metadata CID
              cid: metadata.ipfs?.fileCID || metadataCID, // Use the actual file CID from metadata
            }
          : null
      );

      console.log("📁 File updated with metadata:", {
        name: metadata.fileInfo?.originalName,
        size: metadata.fileInfo?.originalSize,
        encrypted: metadata.encryption?.algorithm === "AES-GCM-256",
        fileCID: metadata.ipfs?.fileCID,
        metadataCID: metadataCID,
      });
    } catch (error) {
      console.error("Error fetching file metadata:", error);
    }
  };

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      alert("Please install MetaMask to access this file");
      return;
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        checkAccess(accounts[0]);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Failed to connect wallet");
    }
  };

  const checkAccess = async (address: string) => {
    if (!file) return;

    try {
      const { getContract, custom } = await import("viem");
      const { createPublicClient, createWalletClient, http } = await import(
        "viem"
      );
      const { parseAbi } = await import("viem");
      const { localhost, sepolia } = await import("viem/chains");

      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
      const chain = rpcUrl.includes("8545") ? localhost : sepolia;

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });
      const walletClient = createWalletClient({
        chain,
        transport: custom((window as any).ethereum),
      });

      const contractAddress = process.env
        .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

      const abi = parseAbi([
        "function hashToFileId(string) view returns (uint256)",
        "function hasReadAccess(uint256, address) view returns (bool)",
        "function getWrappedKey(uint256) view returns (string)",
        "function getAccessInfo(uint256, address) view returns (bool, bool, uint256, uint256, bool)",
      ]);

      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      // The URL contains the metadata CID, use it to find the file ID
      const metadataCID = fileId; // fileId from URL is actually the metadata CID
      console.log("🔍 Looking up file ID for metadata CID:", metadataCID);

      const blockchainFileId = await contract.read.metadataToFileId([
        metadataCID,
      ]);
      console.log(
        "🔍 Found file ID on blockchain:",
        blockchainFileId ? blockchainFileId.toString() : "Not found"
      );

      if (!blockchainFileId || blockchainFileId === BigInt(0)) {
        console.error("❌ File not found on blockchain");
        setHasAccess(false);
        return;
      }

      // Check if user has read access to this specific file
      const hasRead = await contract.read.hasReadAccess([
        blockchainFileId,
        address,
      ]);
      console.log("🔍 User read access:", hasRead);

      if (hasRead) {
        setHasAccess(true);

        if (file.encrypted) {
          try {
            const wrappedKeyData = await contract.read.getWrappedKey([
              blockchainFileId,
            ]);
            console.log(
              "🔐 Wrapped key retrieved:",
              wrappedKeyData ? "Yes" : "No"
            );
            setWrappedKey(wrappedKeyData);
          } catch (error) {
            console.log("No wrapped key found for this user");
          }
        }

        // Fetch file metadata from IPFS if access is granted
        await fetchFileMetadata(metadataCID);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;

    try {
      if (file.encrypted && !decryptionPassword) {
        alert(
          "Please enter the decryption password to download this encrypted file"
        );
        return;
      }

      setIsDownloading(true);
      setDownloadProgress(0);

      console.log("🔍 Download decision:", {
        isEncrypted: file.encrypted,
        hasPassword: !!decryptionPassword,
        fileState: file,
      });

      if (file.encrypted && decryptionPassword) {
        console.log("🔐 Proceeding with encrypted file download");
        // Handle encrypted file download
        await downloadEncryptedFile();
      } else if (!file.encrypted) {
        console.log("📁 Proceeding with plain file download");
        // Handle non-encrypted file download
        await downloadPlainFile();
      } else {
        console.log("❌ Missing password for encrypted file");
        // Missing password for encrypted file
        alert("Please enter the decryption password for this encrypted file");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      alert(
        `Failed to download file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const downloadEncryptedFile = async () => {
    if (!file || !decryptionPassword) return;

    try {
      setDownloadProgress(10);

      // First, we need to get the file metadata to extract encryption details
      // Note: file.id is the metadata CID, we need to fetch the metadata first
      const metadataResponse = await fetch(
        `/api/ipfs/retrieve?cid=${encodeURIComponent(file.id)}`
      );

      if (!metadataResponse.ok) {
        throw new Error("Failed to fetch file metadata");
      }

      const metadata = await metadataResponse.json();
      setDownloadProgress(20);

      // Extract encryption details from metadata
      const { encryption, ipfs } = metadata;
      if (!encryption || !ipfs) {
        throw new Error("File metadata is missing encryption information");
      }

      // The keyWrapped field contains a wrapped key that needs to be unwrapped
      // using the original password, salt, and iterations
      console.log("🔑 Unwrapping encryption key with password");

      // Import the key unwrapping function
      const { unwrapKeyWithPassword } = await import("@/lib/metadata");

      // Unwrap the key using the password, salt, and iterations from metadata
      const unwrappedKey = unwrapKeyWithPassword(
        encryption.keyWrapped, // This is the wrapped key
        decryptionPassword, // Your original password
        encryption.salt, // Salt used for key derivation
        encryption.iterations // Number of iterations
      );

      console.log(
        "🔐 Key unwrapped successfully, length:",
        unwrappedKey.length
      );

      // The unwrappedKey is already in hex format (from unwrapKeyWithPassword)
      // We just need to validate it and use it directly
      const hexKey = unwrappedKey;

      console.log("🔑 Key details:", {
        unwrappedKeyLength: unwrappedKey.length,
        hexKeyLength: hexKey.length,
        expectedHexLength: 64, // 32 bytes = 64 hex characters
        isValidLength: hexKey.length === 64,
        keyStart: hexKey.substring(0, 8) + "...",
        keyEnd: "..." + hexKey.substring(hexKey.length - 8),
      });

      // Validate key length (64 hex characters = 32 bytes)
      if (hexKey.length !== 64) {
        throw new Error(
          `Invalid key length: ${hexKey.length} hex characters. Expected 64 characters (32 bytes) for AES-256-GCM.`
        );
      }

      // Validate hex format
      if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
        throw new Error(
          "Invalid key format. Expected 64-character hex string."
        );
      }

      setDownloadProgress(40);

      // Download and decrypt the file using the ACTUAL file CID from metadata
      // NOT the metadata CID from the URL
      const requestBody = {
        cid: ipfs.fileCID, // Use the actual encrypted file CID, not the metadata CID
        key: hexKey, // Use the hex-converted key (API expects hex format)
        iv: encryption.iv,
        filename: file.name,
      };

      console.log("🔍 Sending decryption request:", {
        cid: requestBody.cid,
        keyLength: requestBody.key.length,
        ivLength: requestBody.iv.length,
        filename: requestBody.filename,
      });

      const decryptResponse = await fetch("/api/ipfs/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!decryptResponse.ok) {
        let errorMessage = "Decryption failed";
        try {
          const errorData = await decryptResponse.json();
          errorMessage =
            errorData.error ||
            errorData.details ||
            `HTTP ${decryptResponse.status}: ${decryptResponse.statusText}`;
        } catch (parseError) {
          errorMessage = `HTTP ${decryptResponse.status}: ${decryptResponse.statusText}`;
        }

        console.error("❌ Decryption API error:", {
          status: decryptResponse.status,
          statusText: decryptResponse.statusText,
          error: errorMessage,
        });

        throw new Error(errorMessage);
      }

      setDownloadProgress(80);

      const decryptResult = await decryptResponse.json();

      if (!decryptResult.success) {
        throw new Error(decryptResult.message || "Decryption failed");
      }

      console.log("🔍 Decryption result:", {
        success: decryptResult.success,
        filename: decryptResult.filename,
        decryptedSize: decryptResult.decryptedSize,
        encryptedSize: decryptResult.encryptedSize,
        dataLength: decryptResult.decryptedData?.length || 0,
        dataStart: decryptResult.decryptedData?.substring(0, 20) || "none",
        hasData: !!decryptResult.decryptedData,
        dataType: typeof decryptResult.decryptedData,
        isBase64: decryptResult.decryptedData
          ? /^[A-Za-z0-9+/]*={0,2}$/.test(decryptResult.decryptedData)
          : false,
      });

      setDownloadProgress(90);

      // Download the decrypted file
      downloadFileFromBase64(
        decryptResult.decryptedData,
        file.name,
        decryptResult.decryptedSize
      );

      setDownloadProgress(100);
      console.log(
        "✅ Encrypted file downloaded and decrypted successfully using unwrapped key!"
      );
    } catch (error) {
      console.error("Error downloading encrypted file:", error);
      throw error;
    }
  };

  const downloadPlainFile = async () => {
    if (!file) return;

    try {
      setDownloadProgress(20);

      // For non-encrypted files, download directly from IPFS
      const response = await fetch(
        `https://gateway.pinata.cloud/ipfs/${file.cid}`,
        {
          method: "GET",
          headers: {
            "User-Agent": "BlockShare/1.0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      setDownloadProgress(60);

      const blob = await response.blob();

      setDownloadProgress(80);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadProgress(100);
      console.log("✅ Plain file downloaded successfully!");
    } catch (error) {
      console.error("Error downloading plain file:", error);
      throw error;
    }
  };

  const downloadFileFromBase64 = (
    base64Data: string,
    filename: string,
    size: number
  ) => {
    try {
      console.log("🔍 Processing download data:", {
        filename,
        size,
        dataLength: base64Data?.length || 0,
        dataType: typeof base64Data,
        isBase64: base64Data
          ? /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)
          : false,
        dataStart: base64Data?.substring(0, 50) || "none",
      });

      if (!base64Data || typeof base64Data !== "string") {
        throw new Error("Invalid data received for download");
      }

      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      console.log("🔍 Byte array created:", {
        length: byteArray.length,
        firstBytes: Array.from(byteArray.slice(0, 10))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      });

      // Detect file format and set correct extension
      let finalFilename = filename;
      if (!finalFilename.includes(".")) {
        // Check if it's an SVG (starts with <?xml)
        if (base64Data.startsWith("PD94bWwgdmVyc2lvbj0iMS4wIj8+")) {
          finalFilename = "decrypted-file.svg";
        }
        // Check if it's a PDF (starts with JVBERi0)
        else if (base64Data.startsWith("JVBERi0")) {
          finalFilename = "decrypted-file.pdf";
        }
        // Check if it's a PNG (starts with iVBORw0KGgo)
        else if (base64Data.startsWith("iVBORw0KGgo")) {
          finalFilename = "decrypted-file.png";
        }
        // Check if it's a JPEG (starts with /9j/4AAQ)
        else if (base64Data.startsWith("/9j/4AAQ")) {
          finalFilename = "decrypted-file.jpg";
        } else {
          finalFilename = "decrypted-file";
        }
      }

      // Set proper MIME type based on file extension
      let mimeType = "application/octet-stream";
      if (finalFilename.endsWith(".pdf")) {
        mimeType = "application/pdf";
      } else if (finalFilename.endsWith(".svg")) {
        mimeType = "image/svg+xml";
      } else if (finalFilename.endsWith(".png")) {
        mimeType = "image/png";
      } else if (
        finalFilename.endsWith(".jpg") ||
        finalFilename.endsWith(".jpeg")
      ) {
        mimeType = "image/jpeg";
      }

      // Create blob with proper MIME type
      const blob = new Blob([byteArray], { type: mimeType });

      console.log(`🔍 File format detected: ${finalFilename} (${mimeType})`);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(
        `✅ File downloaded: ${finalFilename} (${size} bytes) with MIME type: ${mimeType}`
      );
    } catch (error) {
      console.error("Error creating download link:", error);
      throw new Error("Failed to create download link");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shared file...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            File Not Found
          </h1>
          <p className="text-gray-600">
            The requested file could not be found or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Shared File Access
          </h1>
          <p className="text-gray-600">Access your shared file securely</p>
        </div>

        {/* File Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {file.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {formatFileSize(file.size)} • {file.type}
                </p>
              </div>
            </div>

            {file.encrypted && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 rounded-full">
                <Lock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">Encrypted</span>
              </div>
            )}
          </div>

          {/* File Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Shared by</p>
                  <p className="text-sm text-gray-600 font-mono">
                    {file.owner}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Shared on</p>
                  <p className="text-sm text-gray-600">
                    {formatTimestamp(file.sharedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Eye className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Access expires
                  </p>
                  <p className="text-sm text-gray-600">
                    {file.expiresAt === 0
                      ? "Never"
                      : formatTimestamp(file.expiresAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="h-5 w-5 text-gray-400">🔐</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Permissions
                  </p>
                  <p className="text-sm text-gray-600">
                    {file.permissions.read ? "Read" : ""}
                    {file.permissions.read && file.permissions.write
                      ? " • "
                      : ""}
                    {file.permissions.write ? "Write" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Connection */}
          {!isConnected ? (
            <div className="text-center py-6 border-t">
              <p className="text-gray-600 mb-4">
                Connect your wallet to access this file
              </p>
              <Button onClick={connectWallet} size="lg">
                <div className="w-5 h-5 mr-2">🦊</div>
                Connect MetaMask
              </Button>
            </div>
          ) : (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    Connected: {walletAddress.slice(0, 6)}...
                    {walletAddress.slice(-4)}
                  </span>
                </div>

                {hasAccess && (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 rounded-full">
                    <Eye className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-800">
                      Access Granted
                    </span>
                  </div>
                )}
              </div>

              {hasAccess ? (
                <div className="space-y-4">
                  {file.encrypted && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Encryption Password
                      </label>
                      <Input
                        type="password"
                        value={decryptionPassword}
                        onChange={(e) => setDecryptionPassword(e.target.value)}
                        placeholder="Enter your original encryption password"
                        className="max-w-md"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the password you used when you originally
                        encrypted this file.
                      </p>
                    </div>
                  )}

                  {/* Download Progress */}
                  {isDownloading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Downloading file...</span>
                        <span>{downloadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleDownload}
                    disabled={
                      (file.encrypted && !decryptionPassword) || isDownloading
                    }
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="h-5 w-5 mr-2" />
                        Download File
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    You don't have access to this file.
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Contact the file owner to request access.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Security Notice
              </h3>
              <p className="text-sm text-blue-800">
                This file is shared securely through blockchain-based access
                control. Your wallet address is used to verify your identity and
                permissions.
                {file.encrypted &&
                  " Encrypted files require your original encryption password to decrypt."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
