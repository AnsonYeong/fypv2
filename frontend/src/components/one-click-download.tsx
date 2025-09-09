"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  TransactionNotification,
  useTransactionNotification,
} from "@/components/ui/transaction-notification";
import {
  handleTransactionError,
  TransactionResult,
} from "@/lib/transaction-error-handler";
import { Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { FileDownloadService, DownloadResult } from "@/lib/file-download";

interface OneClickDownloadProps {
  metadataCID: string;
  userAddress: string;
  fileName?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  onSuccess?: (result: DownloadResult) => void;
  onError?: (error: string) => void;
}

export function OneClickDownload({
  metadataCID,
  userAddress,
  fileName,
  variant = "default",
  size = "md",
  className = "",
  onSuccess,
  onError,
}: OneClickDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "downloading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // Transaction notification hook
  const { notification, showSuccess, showError, hideNotification } =
    useTransactionNotification();

  const handleDownload = async () => {
    // Prompt user for password
    const password = prompt(
      `Enter password to decrypt "${fileName || "this file"}":`
    );

    if (!password) {
      return; // User cancelled
    }

    try {
      setIsDownloading(true);
      setStatus("downloading");
      setError(null);

      // Use the FileDownloadService for automatic download and decryption
      const result = await FileDownloadService.downloadAndDecryptFile({
        metadataCID,
        userAddress,
        password,
      });

      if (result.success && result.file) {
        setStatus("success");

        // Automatically download the file to user's device
        FileDownloadService.downloadFileToDevice(result.file);

        // Show success notification
        showSuccess(
          "Download Successful",
          `"${result.file.name}" has been downloaded successfully.`
        );

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result);
        }

        // Reset status after a delay
        setTimeout(() => {
          setStatus("idle");
        }, 3000);

        console.log("✅ File downloaded and decrypted successfully!");
        console.log("📁 Filename:", result.file.name);
        console.log("📏 Size:", result.file.size);
      } else {
        setStatus("error");
        const errorMessage = result.error || "Download failed";
        setError(errorMessage);

        // Handle transaction error
        const transactionResult = handleTransactionError(
          new Error(errorMessage),
          "file download"
        );

        if (transactionResult.error) {
          showError(
            "Download Failed",
            transactionResult.error.userFriendlyMessage,
            transactionResult.error,
            () => handleDownload() // Retry function
          );
        } else {
          showError("Download Failed", errorMessage);
        }

        // Call error callback if provided
        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (error) {
      setStatus("error");
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);

      // Handle transaction error
      const transactionResult = handleTransactionError(error, "file download");

      if (transactionResult.error) {
        showError(
          "Download Failed",
          transactionResult.error.userFriendlyMessage,
          transactionResult.error,
          () => handleDownload() // Retry function
        );
      } else {
        showError("Download Failed", errorMessage);
      }

      // Call error callback if provided
      if (onError) {
        onError(errorMessage);
      }

      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case "downloading":
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Decrypting...
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Downloaded!
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
            Failed
          </>
        );
      default:
        return (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download
          </>
        );
    }
  };

  const getButtonVariant = () => {
    switch (status) {
      case "success":
        return "outline";
      case "error":
        return "outline";
      default:
        return variant;
    }
  };

  const getButtonClassName = () => {
    let baseClasses = className;

    switch (status) {
      case "success":
        baseClasses += " border-green-500 text-green-700 hover:bg-green-50";
        break;
      case "error":
        baseClasses += " border-red-500 text-red-700 hover:bg-red-50";
        break;
    }

    return baseClasses;
  };

  return (
    <>
      <div className="inline-block">
        <Button
          onClick={handleDownload}
          disabled={isDownloading || status === "downloading"}
          variant={getButtonVariant()}
          size={size === "md" ? "default" : size}
          className={getButtonClassName()}
        >
          {getButtonContent()}
        </Button>

        {error && status === "error" && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Transaction Notification */}
      <TransactionNotification
        isVisible={notification.isVisible}
        onClose={hideNotification}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        error={notification.error}
        onRetry={notification.onRetry}
      />
    </>
  );
}

// Convenience component for file list items
export function FileDownloadButton({
  metadataCID,
  userAddress,
  fileName,
  className = "",
}: {
  metadataCID: string;
  userAddress: string;
  fileName?: string;
  className?: string;
}) {
  return (
    <OneClickDownload
      metadataCID={metadataCID}
      userAddress={userAddress}
      fileName={fileName}
      variant="outline"
      size="sm"
      className={className}
    />
  );
}

// Bulk download component for multiple files
export function BulkDownloadButton({
  files,
  userAddress,
  className = "",
}: {
  files: Array<{ metadataCID: string; fileName?: string }>;
  userAddress: string;
  className?: string;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<
    Array<{ success: boolean; fileName?: string; error?: string }>
  >([]);

  const handleBulkDownload = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setResults([]);

    const newResults = [];

    for (const file of files) {
      try {
        // Prompt for password for each file
        const password = prompt(
          `Enter password for "${file.fileName || "this file"}":`
        );

        if (!password) {
          newResults.push({
            success: false,
            fileName: file.fileName,
            error: "Password cancelled",
          });
          continue;
        }

        const result = await FileDownloadService.downloadAndDecryptFile({
          metadataCID: file.metadataCID,
          userAddress,
          password,
        });

        if (result.success && result.file) {
          FileDownloadService.downloadFileToDevice(result.file);
          newResults.push({ success: true, fileName: file.fileName });
        } else {
          newResults.push({
            success: false,
            fileName: file.fileName,
            error: result.error,
          });
        }
      } catch (error) {
        newResults.push({
          success: false,
          fileName: file.fileName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    setResults(newResults);
    setIsProcessing(false);
  };

  const successCount = results.filter((r) => r.success).length;
  const totalCount = files.length;

  return (
    <div className="space-y-2">
      <Button
        onClick={handleBulkDownload}
        disabled={isProcessing || files.length === 0}
        variant="default"
        size="lg"
        className={className}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing {files.length} files...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download {files.length} Files
          </>
        )}
      </Button>

      {results.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">
            Results: {successCount}/{totalCount} files downloaded successfully
          </p>
          {results.some((r) => !r.success) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-600">
                View errors
              </summary>
              <div className="mt-2 space-y-1">
                {results
                  .filter((r) => !r.success)
                  .map((result, index) => (
                    <div key={index} className="text-red-600 text-xs">
                      {result.fileName || "Unknown file"}: {result.error}
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
