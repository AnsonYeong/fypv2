"use client";

import React, { useState, useEffect } from "react";
import {
  AppFile,
  formatFileSize,
  formatDate,
  getVersionHistoryFromBlockchain,
} from "@/lib/data";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, Download, Clock, FileText, Loader2 } from "lucide-react";
import { unwrapKeyWithPassword } from "@/lib/metadata";

interface VersionHistorySheetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  file: AppFile;
  onUpdateFile?: (file: AppFile) => void; // Callback for when user wants to update file
}

export function VersionHistorySheet({
  isOpen,
  setIsOpen,
  file,
  onUpdateFile,
}: VersionHistorySheetProps) {
  const [blockchainVersions, setBlockchainVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [downloadingVersionId, setDownloadingVersionId] = useState<
    string | null
  >(null);

  // Load version history from blockchain when sheet opens
  useEffect(() => {
    if (isOpen && file.fileId && file.metadataCID) {
      loadVersionHistory();
    }
  }, [isOpen, file.fileId, file.metadataCID]);

  const loadVersionHistory = async () => {
    if (!file.fileId || !file.metadataCID) return;

    setIsLoadingVersions(true);
    try {
      const versions = await getVersionHistoryFromBlockchain(
        file.fileId,
        file.metadataCID
      );

      // Verify current version on-chain and mark it explicitly
      try {
        const { createPublicClient, http, getContract, parseAbi } =
          await import("viem");
        const chainsMod = await import("viem/chains");
        const chainIdHex = await (window as any).ethereum?.request?.({
          method: "eth_chainId",
        });
        const chainId = chainIdHex ? parseInt(chainIdHex, 16) : 31337;
        const chain =
          chainId === 31337
            ? chainsMod.hardhat
            : chainId === 1337
            ? chainsMod.localhost
            : chainsMod.sepolia;
        const rpcUrl =
          process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl),
        });
        const contractAddress = process.env
          .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
        const abi = parseAbi([
          "function getFileInfo(uint256) view returns (string, string, uint256, address, uint256, bool, string, bool, string, uint256)",
        ]);
        const contract = getContract({
          address: contractAddress,
          abi,
          client: { public: publicClient },
        }) as any;
        const info = (await contract.read.getFileInfo([
          BigInt(file.fileId),
        ])) as [
          string,
          string,
          bigint,
          string,
          bigint,
          boolean,
          string,
          boolean,
          string,
          bigint
        ];
        const currentMetadataCID = info[6];
        const enhanced = Array.isArray(versions)
          ? versions.map((v: any) => ({
              ...v,
              isCurrentVersion: Boolean(
                v?.metadataCID && v.metadataCID === currentMetadataCID
              ),
            }))
          : versions;
        setBlockchainVersions(enhanced as any[]);
      } catch {
        // Fallback to original list if verification fails
        setBlockchainVersions(versions as any[]);
      }
    } catch (error) {
      console.error("Error loading version history:", error);
      setBlockchainVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Use blockchain versions if available, otherwise fall back to local versions
  const displayVersions =
    blockchainVersions.length > 0 ? blockchainVersions : file.versions;

  // Show newest first if version numbers exist; otherwise keep original order
  const orderedVersions = Array.isArray(displayVersions)
    ? [...displayVersions].sort((a: any, b: any) => {
        const av = typeof a?.version === "number" ? a.version : 0;
        const bv = typeof b?.version === "number" ? b.version : 0;
        return bv - av; // descending (newest first)
      })
    : displayVersions;

  const downloadFileFromBase64 = (base64Data: string, filename: string) => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownloadVersion = async (version: any) => {
    try {
      setDownloadingVersionId(version.id);
      const metadataCID: string | undefined =
        version.metadataCID || version.cid || version.id;
      if (!metadataCID) throw new Error("Missing version metadata CID");

      // Fetch metadata JSON (route returns JSON for metadata CIDs)
      const metaRes = await fetch(
        `/api/ipfs/retrieve?cid=${encodeURIComponent(metadataCID)}`
      );
      if (!metaRes.ok) {
        throw new Error(`Failed to fetch metadata: ${metaRes.statusText}`);
      }
      const metadata = await metaRes.json();

      // Resolve actual encrypted/plain file CID and file name
      const fileCID: string = metadata?.ipfs?.fileCID || metadataCID;
      const originalName: string =
        metadata?.fileInfo?.originalName || `${file.name}`;
      const isEncrypted: boolean =
        metadata?.encryption?.algorithm === "AES-GCM-256";

      if (isEncrypted) {
        // Ask user for the original encryption password
        const password = window.prompt(
          `This version is encrypted. Enter the decryption password for "${originalName}"`
        );
        if (!password) {
          return; // cancelled
        }

        // Unwrap key using password, salt, and iterations from metadata
        const wrapped = metadata.encryption?.keyWrapped as string;
        const salt = metadata.encryption?.salt as string;
        const iterations = metadata.encryption?.iterations as number;
        const iv = metadata.encryption?.iv as string;
        if (!wrapped || !salt || !iterations || !iv) {
          throw new Error("Incomplete encryption metadata");
        }

        const hexKey = unwrapKeyWithPassword(
          wrapped,
          password,
          salt,
          iterations
        );
        if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
          throw new Error("Derived key has invalid format/length");
        }

        // Request server to retrieve and decrypt the file
        const decRes = await fetch("/api/ipfs/retrieve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cid: fileCID,
            key: hexKey,
            iv,
            filename: originalName,
          }),
        });
        if (!decRes.ok) {
          const err = await decRes.json().catch(() => ({} as any));
          throw new Error(err?.error || err?.details || decRes.statusText);
        }
        const payload = await decRes.json();
        if (!payload?.success || !payload?.decryptedData) {
          throw new Error(payload?.message || "Decryption failed");
        }
        downloadFileFromBase64(
          payload.decryptedData,
          payload.filename || originalName
        );
      } else {
        // Plain file: download directly from gateway
        const resp = await fetch(
          `https://gateway.pinata.cloud/ipfs/${fileCID}`
        );
        if (!resp.ok)
          throw new Error(`Failed to download file: ${resp.statusText}`);
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error("Version download error:", e);
      alert(
        `Failed to download version: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      setDownloadingVersionId(null);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={`Version History - ${file.name}`}
    >
      <div className="space-y-4">
        <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
          <FileText className="h-5 w-5 text-blue-600" />
          <div>
            <div className="font-medium">{file.name}</div>
            <div className="text-sm text-gray-600">
              {orderedVersions.length} versions • {formatFileSize(file.size)}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isLoadingVersions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">
                Loading version history...
              </span>
            </div>
          ) : orderedVersions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No version history available
            </div>
          ) : (
            orderedVersions.map((version: any, index: number) => {
              const maxVersionNumber = Math.max(
                ...orderedVersions.map((v: any) =>
                  typeof v?.version === "number" ? v.version : 0
                )
              );
              const isCurrent = Boolean(
                (typeof version?.isCurrentVersion === "boolean" &&
                  version.isCurrentVersion) ||
                  (typeof version?.version === "number" &&
                    version.version === maxVersionNumber)
              );
              return (
                <div
                  key={version.id}
                  className={`p-4 border rounded-lg ${
                    isCurrent ? "border-blue-200 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <History className="h-4 w-4 text-gray-600" />
                      <span className="font-medium">
                        Version {version.version}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {formatFileSize(version.size)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadVersion(version)}
                        disabled={downloadingVersionId === version.id}
                      >
                        {downloadingVersionId === version.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(version.timestamp)}</span>
                  </div>

                  <div className="text-sm text-gray-700">{version.changes}</div>

                  {index > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <Button variant="outline" size="sm" className="w-full">
                        Restore this version
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t pt-4">
          <div className="text-sm text-gray-600 mb-3">
            Version history helps you track changes and restore previous
            versions of your files.
          </div>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (onUpdateFile) {
                  onUpdateFile(file);
                  setIsOpen(false); // Close the version history sheet
                }
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Update File
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={loadVersionHistory}
              disabled={isLoadingVersions}
            >
              {isLoadingVersions ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <History className="h-4 w-4 mr-2" />
              )}
              Refresh History
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
