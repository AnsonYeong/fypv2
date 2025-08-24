"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Lock, Loader2 } from "lucide-react";

interface DecryptDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  fileCid?: string;
}

export function DecryptDialog({
  isOpen,
  setIsOpen,
  fileCid = "",
}: DecryptDialogProps) {
  const [cid, setCid] = useState(fileCid);
  const [key, setKey] = useState("");
  const [iv, setIv] = useState("");
  const [filename, setFilename] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedFile, setDecryptedFile] = useState<{
    filename: string;
    data: string;
    size: number;
  } | null>(null);

  const handleDecrypt = async () => {
    if (!cid || !key || !iv) {
      alert("Please provide CID, encryption key, and IV");
      return;
    }

    try {
      setIsDecrypting(true);

      const response = await fetch("/api/ipfs/retrieve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cid,
          key,
          iv,
          filename: filename || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Decryption failed: ${error.error || response.statusText}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Ensure we have a proper filename with extension
        let finalFilename = result.filename;

        // If the filename doesn't have an extension, try to detect it from the decrypted content
        if (!finalFilename.includes(".")) {
          // Check if it's an SVG (starts with <?xml)
          if (result.decryptedData.startsWith("PD94bWwgdmVyc2lvbj0iMS4wIj8+")) {
            finalFilename = "decrypted-file.svg";
          }
          // Check if it's a PDF (starts with JVBERi0)
          else if (result.decryptedData.startsWith("JVBERi0")) {
            finalFilename = "decrypted-file.pdf";
          }
          // Check if it's a PNG (starts with iVBORw0KGgo)
          else if (result.decryptedData.startsWith("iVBORw0KGgo")) {
            finalFilename = "decrypted-file.png";
          }
          // Check if it's a JPEG (starts with /9j/4AAQ)
          else if (result.decryptedData.startsWith("/9j/4AAQ")) {
            finalFilename = "decrypted-file.jpg";
          } else {
            finalFilename = "decrypted-file";
          }
        }

        setDecryptedFile({
          filename: finalFilename,
          data: result.decryptedData,
          size: result.decryptedSize,
        });

        console.log("✅ File decrypted successfully!");
        console.log("📁 Filename:", finalFilename);
        console.log("📏 Size:", result.decryptedSize);
        console.log(
          "🔍 First 100 chars:",
          result.decryptedData.substring(0, 100)
        );
      } else {
        alert("Decryption failed: " + result.message);
      }
    } catch (error) {
      console.error("Decryption error:", error);
      alert(
        "Decryption failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsDecrypting(false);
    }
  };

  const downloadDecryptedFile = () => {
    if (!decryptedFile) return;

    // Convert base64 to blob
    const byteCharacters = atob(decryptedFile.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray]);

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = decryptedFile.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const resetForm = () => {
    setCid(fileCid);
    setKey("");
    setIv("");
    setFilename("");
    setDecryptedFile(null);
  };

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title="Decrypt File"
      isLoading={isDecrypting}
      disableCloseOnOverlayClick={isDecrypting}
      loadingContent={
        <div className="text-center space-y-4">
          <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">
              Decrypting file...
            </h3>
            <p className="text-sm text-gray-600 max-w-xs mx-auto">
              Please wait while we decrypt your file from IPFS. This may take a
              few moments.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!decryptedFile ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">File CID</label>
              <Input
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                placeholder="Enter IPFS CID..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                🔐 Encryption Key (Hex)
              </label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter 64-character hex key..."
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                🔑 Initialization Vector (Hex)
              </label>
              <Input
                value={iv}
                onChange={(e) => setIv(e.target.value)}
                placeholder="Enter 24-character hex IV..."
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                📁 Original Filename (Optional)
              </label>
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Enter original filename..."
              />
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Security Note:</strong> Your encryption key and IV will
                be sent to the server for decryption. Only use this with files
                you've encrypted yourself.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isDecrypting}
                className="btn-3d btn-3d-secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDecrypt}
                disabled={!cid || !key || !iv || isDecrypting}
                className="btn-3d btn-3d-primary"
              >
                {isDecrypting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Decrypting...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Decrypt File
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                ✅ File Decrypted Successfully!
              </h3>
              <div className="space-y-2 text-sm text-green-700">
                <p>
                  <strong>Filename:</strong> {decryptedFile.filename}
                </p>
                <p>
                  <strong>Size:</strong> {decryptedFile.size} bytes
                </p>
                <p>
                  <strong>Status:</strong> Ready for download
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={resetForm}
                className="btn-3d btn-3d-secondary"
              >
                Decrypt Another File
              </Button>
              <Button
                onClick={downloadDecryptedFile}
                className="btn-3d btn-3d-primary"
              >
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
