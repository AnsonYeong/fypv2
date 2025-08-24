"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface KeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  uploadedCid: string;
  uploadedFilename: string;
  encryptionDetails: {
    key: string;
    iv: string;
    algorithm: string;
  };
}

export function KeyDialog({
  isOpen,
  onClose,
  uploadedCid,
  uploadedFilename,
  encryptionDetails,
}: KeyDialogProps) {
  if (!isOpen) return null;

  const copyAllCredentials = () => {
    const credentialsText = `Encryption Credentials for ${uploadedFilename}:

File CID: ${uploadedCid}
Key: ${encryptionDetails.key}
IV: ${encryptionDetails.iv}
Algorithm: ${encryptionDetails.algorithm}

⚠️ IMPORTANT: Save these securely for decryption!
You need ALL of these details to decrypt your file later.`;

    navigator.clipboard
      .writeText(credentialsText)
      .then(() => {
        alert("✅ All encryption credentials copied to clipboard!");
      })
      .catch(() => {
        alert("❌ Failed to copy to clipboard. Please copy manually.");
      });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            🔐 File Encrypted Successfully!
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              <strong>🎉 Success!</strong> Your file{" "}
              <strong>"{uploadedFilename}"</strong> has been encrypted with
              AES-256 encryption and uploaded to IPFS. The file is now secure
              and cannot be accessed without the encryption credentials below.
            </p>
          </div>

          {/* File CID */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              📁 File CID (IPFS Hash)
            </label>
            <div className="flex items-center space-x-2">
              <Input
                value={uploadedCid}
                readOnly
                className="text-sm bg-gray-50 border-gray-300"
              />
              <Button
                onClick={() => navigator.clipboard.writeText(uploadedCid)}
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              This is your file's unique identifier on IPFS. You'll need this
              along with the encryption credentials to decrypt the file.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-4"></div>

          {/* Encryption Details */}
          <div className="space-y-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="text-center mb-3">
              <h3 className="text-lg font-semibold text-blue-900">
                🔐 Encryption Credentials
              </h3>
              <p className="text-sm text-blue-700">
                Save these securely - you'll need them to decrypt your file
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                🔑 Encryption Key (Hex) - 64 characters
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  value={encryptionDetails.key}
                  readOnly
                  className="text-sm bg-gray-50 border-gray-300"
                />
                <Button
                  onClick={() =>
                    navigator.clipboard.writeText(encryptionDetails.key)
                  }
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                🔐 Initialization Vector (Hex) - 24 characters
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  value={encryptionDetails.iv}
                  readOnly
                  className="text-sm bg-gray-50 border-gray-300"
                />
                <Button
                  onClick={() =>
                    navigator.clipboard.writeText(encryptionDetails.iv)
                  }
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                🛡️ Encryption Algorithm
              </label>
              <Input
                value={encryptionDetails.algorithm}
                readOnly
                className="text-sm bg-gray-50 border-gray-300"
              />
            </div>
          </div>

          {/* Warning */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="text-sm text-yellow-800">
                <p className="font-medium">
                  ⚠️ CRITICAL: Save These Credentials!
                </p>
                <ul className="mt-2 space-y-1">
                  <li>• Store the encryption key and IV securely</li>
                  <li>• Without these, your file cannot be decrypted</li>
                  <li>• Consider using a password manager or secure note</li>
                  <li>• The file on IPFS is encrypted and unreadable</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-3">
            <Button
              onClick={copyAllCredentials}
              variant="outline"
              className="btn-3d btn-3d-secondary"
            >
              📋 Copy All Credentials
            </Button>
            <Button onClick={onClose} className="btn-3d btn-3d-primary">
              I've Saved My Credentials
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
