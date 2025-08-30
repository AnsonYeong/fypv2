"use client";

import React, { useState } from "react";
import { AppFile, saveFilesToStorage, getFilesFromStorage } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { createFileMetadata } from "@/lib/metadata";
import { generateSHA256 } from "@/lib/metadata";

interface FileUploadDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onFileUploaded: (file: AppFile) => void;
  userId?: string;
  walletAddress?: string; // Add wallet address prop
}

export function FileUploadDialog({
  isOpen,
  setIsOpen,
  onFileUploaded,
  userId = "demo-user",
  walletAddress, // Add wallet address parameter
}: FileUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [shouldEncrypt, setShouldEncrypt] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [uploadedCid, setUploadedCid] = useState<string>("");
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [metadataCID, setMetadataCID] = useState<string>("");
  const [chainTxHash, setChainTxHash] = useState<string>("");
  const [chainFileId, setChainFileId] = useState<number | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !fileName) return;
    try {
      setIsUploading(true);
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("name", fileName);
      if (shouldEncrypt) {
        form.append("encrypt", "true");
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Upload failed: ${err.error || res.statusText}`);
        return;
      }

      const { cid, gatewayUrl, encrypted, encryptionData } = await res.json();

      const newFile: AppFile = {
        id: Date.now().toString(),
        name: fileName,
        size: selectedFile.size,
        type: selectedFile.type,
        lastModified: new Date(),
        owner: walletAddress || "0x0000000000000000000000000000000000000000",
        sharedWith: [],
        permissions: "admin",
        versions: [],
        cid: cid, // This is the file CID
        metadataCID: "", // Will be set after metadata upload
        gatewayUrl: gatewayUrl,
        encrypted: encrypted,
        encryptionData:
          encrypted && encryptionData
            ? {
                key: encryptionData.key,
                iv: encryptionData.iv,
                algorithm: encryptionData.algorithm,
              }
            : undefined,
      };

      // Save to localStorage for the current user
      try {
        const existingFiles = getFilesFromStorage(userId);
        const updatedFiles = [newFile, ...existingFiles];
        saveFilesToStorage(updatedFiles, userId);
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }

      onFileUploaded(newFile);

      // Store the CID and filename for display
      setUploadedCid(cid);
      setUploadedFilename(fileName);

      // If encrypted, generate metadata.json and upload to IPFS
      if (encrypted && encryptionData) {
        try {
          // Use password from dialog state
          if (!encryptionPassword) {
            console.warn("Metadata generation skipped: no password provided");
          } else {
            // Download encrypted file from IPFS to compute hash and size
            const encResp = await fetch(gatewayUrl);
            if (!encResp.ok)
              throw new Error("Failed to fetch encrypted file from IPFS");
            const encBuf = await encResp.arrayBuffer();
            const encryptedBlob = new Blob([encBuf], {
              type: "application/octet-stream",
            });
            const encryptedFile = new File(
              [encryptedBlob],
              selectedFile.name + ".encrypted",
              {
                type: "application/octet-stream",
              }
            );

            // Create metadata
            const metadata = await createFileMetadata(
              selectedFile,
              encryptedFile,
              cid,
              encryptionData.key,
              encryptionData.iv,
              encryptionPassword,
              walletAddress || "0x0000000000000000000000000000000000000000", // placeholder, replace with connected wallet
              process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
                "0x0000000000000000000000000000000000000000"
            );

            // Upload metadata via API
            const metaRes = await fetch("/api/ipfs/metadata", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(metadata),
            });
            if (!metaRes.ok) {
              const txt = await metaRes.text();
              throw new Error(`Metadata upload failed: ${txt}`);
            }
            const metaJson = await metaRes.json();
            setMetadataCID(metaJson.metadataCID);
            console.log("✅ metadataCID:", metaJson.metadataCID);

            // Update the file object with the metadata CID
            newFile.metadataCID = metaJson.metadataCID;

            // Register on-chain with metadataCID via user's wallet (MetaMask)
            try {
              if (!(window as any).ethereum) {
                throw new Error("No injected wallet detected (MetaMask)");
              }

              const { getContract, custom } = await import("viem");
              const { createPublicClient, createWalletClient, http } =
                await import("viem");
              const { parseAbi } = await import("viem");
              const { localhost, sepolia } = await import("viem/chains");

              const rpcUrl =
                process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

              // Detect wallet's current network
              const currentChainIdHex = await (window as any).ethereum.request({
                method: "eth_chainId",
              });
              const currentChainId = parseInt(
                (currentChainIdHex || "0x0") as string,
                16
              );
              // Build chain dynamically to match wallet (supports 31337 or 1337)
              const chain =
                currentChainId === 11155111
                  ? sepolia
                  : ({
                      id: currentChainId,
                      name: "Local",
                      network: "local",
                      nativeCurrency: {
                        name: "ETH",
                        symbol: "ETH",
                        decimals: 18,
                      },
                      rpcUrls: { default: { http: [rpcUrl] } },
                    } as any);
              const desiredChainIdHex = `0x${chain.id.toString(16)}`;
              if (
                (currentChainIdHex || "").toLowerCase() !== desiredChainIdHex
              ) {
                throw new Error(
                  `Wallet network mismatch. Current ${currentChainIdHex} (${currentChainId}), required ${desiredChainIdHex} (${chain.id}). Please switch network in MetaMask and retry.`
                );
              }

              const publicClient = createPublicClient({
                chain,
                transport: http(rpcUrl),
              });
              const walletClient = createWalletClient({
                chain,
                transport: custom((window as any).ethereum),
              });

              const [account] = await walletClient.getAddresses();

              const contractAddress =
                (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ||
                (process.env.CONTRACT_ADDRESS as `0x${string}`);
              if (
                !contractAddress ||
                contractAddress === ("0x" as `0x${string}`)
              ) {
                throw new Error("Contract address not configured");
              }

              const abi = parseAbi([
                "function uploadFileHash(string _fileHash, string _fileName, uint256 _fileSize, string _metadataCID, bool _isEncrypted, string _masterKeyHash) returns (uint256)",
                "function hashToFileId(string) view returns (uint256)",
                "function getFileInfo(uint256) view returns (string, string, uint256, address, uint256, bool, string, bool, string)",
              ]);

              const contract = getContract({
                address: contractAddress,
                abi,
                client: { public: publicClient, wallet: walletClient as any },
              });

              // Pre-check: avoid duplicate registration
              const existingId = (await (contract as any).read.hashToFileId([
                metaJson.metadataCID,
              ])) as bigint;
              if (existingId && existingId > BigInt(0)) {
                setChainFileId(Number(existingId));
                console.log(
                  "ℹ️ Metadata already registered on-chain as fileId:",
                  Number(existingId)
                );
              } else {
                // Generate master key hash for encrypted files
                const masterKeyHash =
                  encrypted && encryptionData
                    ? await generateSHA256(encryptionData.key)
                    : "";

                const txHash = await (contract as any).write.uploadFileHash(
                  [
                    metaJson.metadataCID,
                    fileName,
                    BigInt(selectedFile.size),
                    metaJson.metadataCID,
                    encrypted || false,
                    masterKeyHash,
                  ],
                  { account }
                );

                setChainTxHash(txHash as string);

                // Optional: wait for confirmation and resolve fileId
                const receipt = await publicClient.waitForTransactionReceipt({
                  hash: txHash as `0x${string}`,
                });
                console.log(
                  "📗 Contract upload mined in block:",
                  Number(receipt.blockNumber)
                );

                const fileIdBig = (await (contract as any).read.hashToFileId([
                  metaJson.metadataCID,
                ])) as bigint;
                if (fileIdBig && fileIdBig > BigInt(0)) {
                  setChainFileId(Number(fileIdBig));
                }
              }
            } catch (chainErr) {
              console.error("Client-side contract call error:", chainErr);
            }
          }
        } catch (metaErr) {
          console.error("Metadata processing error:", metaErr);
        }
      }

      // Close dialog after successful upload (both encrypted and non-encrypted)
      if (encrypted && encryptionData) {
        // For encrypted files, show success message briefly before closing
        console.log("✅ File uploaded and encrypted successfully!");
        console.log("🔐 ENCRYPTION CREDENTIALS SAVED TO CONSOLE:");
        console.log("Key:", encryptionData.key);
        console.log("IV:", encryptionData.iv);
        console.log("Algorithm:", encryptionData.algorithm);
        if (metadataCID) {
          console.log("Metadata CID:", metadataCID);
        }

        setUploadSuccess(true);
        // Close dialog after a brief delay to show success
        setTimeout(() => {
          setIsOpen(false);
          resetForm();
        }, 2000);
      } else {
        // For non-encrypted files, close immediately
        setUploadSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          resetForm();
        }, 1500);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFileName("");
    setUploadedCid("");
    setUploadedFilename("");
    setMetadataCID("");
    setEncryptionPassword("");
    setShowPasswordDialog(false);
    setUploadSuccess(false);
  };

  const handleEncryptionChange = (checked: boolean) => {
    setShouldEncrypt(checked);
    if (checked) {
      setShowPasswordDialog(true);
    } else {
      setEncryptionPassword("");
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        setIsOpen={(open) => {
          if (!open) {
            resetForm();
          }
          setIsOpen(open);
        }}
        title="Upload File"
        isLoading={isUploading}
        disableCloseOnOverlayClick={isUploading}
        loadingContent={
          <div className="text-center space-y-4">
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Uploading to IPFS...
              </h3>
              <p className="text-sm text-gray-600 max-w-xs mx-auto">
                Please wait while we securely upload your file to the
                decentralized network. This may take a few moments depending on
                file size.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {uploadSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Upload Successful!
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Your file has been uploaded to IPFS and registered on the
                  blockchain.
                </p>
              </div>
              {uploadedCid && (
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-600">
                    IPFS CID: {uploadedCid}
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500">
                This dialog will close automatically...
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  File Name
                </label>
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter file name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Select File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-blue-600 hover:text-blue-700 border-2 border-blue-500 rounded-md px-4 py-2 inline-block hover:bg-blue-50 transition-colors"
                  >
                    Choose a file
                  </label>
                  <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
                </div>
                {selectedFile && (
                  <div className="mt-2 p-2 bg-gray-50 rounded flex items-center justify-between">
                    <span className="text-sm">{selectedFile.name}</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Encryption Option */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="encrypt-file"
                  checked={shouldEncrypt}
                  onChange={(e) => handleEncryptionChange(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="encrypt-file"
                  className="text-sm font-medium text-gray-700"
                >
                  🔐 Encrypt file before upload (AES-256)
                </label>
              </div>
              {shouldEncrypt && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Security Note:</strong> Your file will be encrypted
                    with AES-256 encryption before uploading to IPFS. The
                    encryption key and IV will be returned to you - keep them
                    safe for decryption!
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isUploading}
                  className="btn-3d btn-3d-secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !fileName || isUploading}
                  className="btn-3d btn-3d-primary"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Password Dialog */}
      <Dialog
        isOpen={showPasswordDialog}
        setIsOpen={setShowPasswordDialog}
        title="Enter Encryption Password"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={encryptionPassword}
              onChange={(e) => setEncryptionPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your encryption password"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowPasswordDialog(false);
                setShouldEncrypt(false);
                setEncryptionPassword("");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (encryptionPassword.trim()) {
                  setShowPasswordDialog(false);
                }
              }}
              disabled={!encryptionPassword.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
