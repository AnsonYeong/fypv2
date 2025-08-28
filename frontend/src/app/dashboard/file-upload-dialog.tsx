"use client";

import React, { useState } from "react";
import { AppFile, saveFilesToStorage, getFilesFromStorage } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { KeyDialog } from "./key-dialog";
import { createFileMetadata } from "@/lib/metadata";

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
  const [showEncryptionDetails, setShowEncryptionDetails] = useState(false);
  const [encryptionDetails, setEncryptionDetails] = useState<{
    key: string;
    iv: string;
    algorithm: string;
  } | null>(null);
  const [uploadedCid, setUploadedCid] = useState<string>("");
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [metadataCID, setMetadataCID] = useState<string>("");

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
        type: selectedFile.name.split(".").pop() || "unknown",
        lastModified: new Date(),
        owner: "Current User",
        sharedWith: [],
        permissions: "admin",
        versions: [
          {
            id: "v1",
            version: 1,
            timestamp: new Date(),
            size: selectedFile.size,
            changes: "Initial upload (pinned to IPFS)",
          },
        ],
        cid,
        gatewayUrl,
        encrypted: encrypted || false,
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
          // Ask user for password for wrapping the encryption key
          const password =
            window.prompt(
              "Enter a password to protect your key (used to wrap the key):"
            ) || "";
          if (!password) {
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
              password,
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

            // Register on-chain with metadataCID
            try {
              const fileHash = metadata.integrity.originalHash;
              const registerRes = await fetch("/api/contract/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileHash,
                  fileName,
                  fileSize: selectedFile.size,
                  metadataCID: metaJson.metadataCID,
                  uploaderAddress: walletAddress || undefined,
                }),
              });
              if (!registerRes.ok) {
                const txt = await registerRes.text();
                console.error("Contract register failed:", txt);
              } else {
                const rj = await registerRes.json();
                console.log("📗 Contract upload tx:", rj.txHash);
                console.log("🔎 On-chain check:", {
                  fileId: rj.fileId,
                  storedCID: rj.storedCID,
                });
                if (rj.storedCID === metaJson.metadataCID) {
                  console.log(
                    "✅ Metadata CID stored on-chain matches IPFS CID:",
                    rj.storedCID
                  );
                } else {
                  console.warn(
                    "⚠️ Mismatch between on-chain storedCID and uploaded metadataCID",
                    { onChain: rj.storedCID, ipfs: metaJson.metadataCID }
                  );
                }
              }
            } catch (chainErr) {
              console.error("Contract call error:", chainErr);
            }
          }
        } catch (metaErr) {
          console.error("Metadata processing error:", metaErr);
        }
      }

      // Show encryption success message if file was encrypted
      if (encrypted && encryptionData) {
        // Store encryption details for the success dialog
        setEncryptionDetails({
          key: encryptionData.key,
          iv: encryptionData.iv,
          algorithm: encryptionData.algorithm,
        });

        // Automatically show the encryption details dialog
        setShowEncryptionDetails(true);

        // Don't close the main dialog yet - let user see the encryption details first
        // setIsOpen(false); // Commented out to keep dialog open

        // Also log to console for easy copying
        console.log("🔐 ENCRYPTION CREDENTIALS SAVED TO CONSOLE:");
        console.log("Key:", encryptionData.key);
        console.log("IV:", encryptionData.iv);
        console.log("Algorithm:", encryptionData.algorithm);
        if (metadataCID) {
          console.log("Metadata CID:", metadataCID);
        }
      } else {
        // If not encrypted, close the dialog normally
        setIsOpen(false);
        setSelectedFile(null);
        setFileName("");
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
    setEncryptionDetails(null);
    setShowEncryptionDetails(false);
    setMetadataCID("");
  };

  return (
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
        <div>
          <label className="block text-sm font-medium mb-2">File Name</label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Enter file name..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Select File</label>
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
            onChange={(e) => setShouldEncrypt(e.target.checked)}
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
              <strong>Security Note:</strong> Your file will be encrypted with
              AES-256 encryption before uploading to IPFS. The encryption key
              and IV will be returned to you - keep them safe for decryption!
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
      </div>

      {/* Encryption Success Dialog */}
      <KeyDialog
        isOpen={showEncryptionDetails}
        onClose={() => {
          setShowEncryptionDetails(false);
          setIsOpen(false);
          setSelectedFile(null);
          setFileName("");
          setUploadedCid("");
          setUploadedFilename("");
          setEncryptionDetails(null);
          setMetadataCID("");
        }}
        uploadedCid={uploadedCid}
        uploadedFilename={uploadedFilename}
        encryptionDetails={encryptionDetails!}
      />
    </Dialog>
  );
}
