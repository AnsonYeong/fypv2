"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { FileDownloadService, DownloadResult } from "@/lib/file-download";

interface EnhancedDownloadDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  metadataCID?: string; // optional legacy
  fileCID?: string; // encrypted file CID from list
  userAddress?: string;
  fileName?: string;
}

export function EnhancedDownloadDialog({
  isOpen,
  setIsOpen,
  metadataCID = "",
  fileCID = "",
  userAddress = "",
  fileName = "",
}: EnhancedDownloadDialogProps) {
  const [password, setPassword] = useState("");
  const [fallbackCid, setFallbackCid] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!password || !userAddress) {
      setError("Please provide password and ensure wallet is connected");
      return;
    }

    try {
      setIsDownloading(true);
      setError(null);
      setDownloadResult(null);

      // Prefer metadataCID if provided; else use fileCID from selection; else fallback manual
      const result = await FileDownloadService.downloadAndDecryptFile({
        metadataCID: metadataCID || undefined,
        fileCID: fileCID || fallbackCid || undefined,
        userAddress: userAddress,
        password: password,
      });

      if (result.success && result.file) {
        setDownloadResult(result);
        FileDownloadService.downloadFileToDevice(result.file);
      } else {
        setError(result.error || "Download failed");
      }
    } catch (error) {
      console.error("Download error:", error);
      setError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const resetForm = () => {
    setPassword("");
    setFallbackCid("");
    setDownloadResult(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    setIsOpen(false);
  };

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={handleClose}
      title="Download & Decrypt File"
      isLoading={isDownloading}
      disableCloseOnOverlayClick={isDownloading}
      loadingContent={
        <div className="text-center space-y-4">
          <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Downloading and Decrypting...
            </h3>
            <p className="text-sm text-gray-600 max-w-xs mx-auto">
              Please wait while we retrieve your file from IPFS, decrypt it, and
              prepare it for download.
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
        {!downloadResult ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                🔐 Password for Key Unwrapping
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your password unwraps the encryption key stored in metadata.
              </p>
            </div>

            {!metadataCID && !fileCID && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Optional: File CID (if no selection)
                </label>
                <input
                  value={fallbackCid}
                  onChange={(e) => setFallbackCid(e.target.value)}
                  placeholder="Enter encrypted file CID (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If you opened this dialog from the file list, we already know
                  the CID.
                </p>
              </div>
            )}

            {userAddress && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Wallet Connected:</strong> {userAddress.slice(0, 6)}
                  ...{userAddress.slice(-4)}
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>How it works:</strong>
                <br />
                1. If needed, resolves Metadata CID from your on-chain file list
                <br />
                2. Retrieves metadata from IPFS
                <br />
                3. Extracts encryption key using your password
                <br />
                4. Downloads encrypted file from IPFS and decrypts locally
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isDownloading}
                className="btn-3d btn-3d-secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDownload}
                disabled={!password || !userAddress || isDownloading}
                className="btn-3d btn-3d-primary"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download & Decrypt
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center space-x-3 mb-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <h3 className="text-lg font-semibold text-green-800">
                  ✅ File Successfully Downloaded & Decrypted!
                </h3>
              </div>
              <div className="space-y-2 text-sm text-green-700">
                <p>
                  <strong>Filename:</strong> {downloadResult.file?.name}
                </p>
                <p>
                  <strong>Size:</strong> {downloadResult.file?.size} bytes
                </p>
                <p>
                  <strong>Type:</strong>{" "}
                  {downloadResult.file?.type || "Unknown"}
                </p>
                <p>
                  <strong>Algorithm:</strong>{" "}
                  {downloadResult.metadata?.encryption?.algorithm}
                </p>
                <p>
                  <strong>Status:</strong> File has been automatically
                  downloaded to your device
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={resetForm}
                className="btn-3d btn-3d-secondary"
              >
                Download Another File
              </Button>
              <Button onClick={handleClose} className="btn-3d btn-3d-primary">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
