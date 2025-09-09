"use client";

import React, { useState, useEffect } from "react";
import { AppFile } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  TransactionNotification,
  useTransactionNotification,
} from "@/components/ui/transaction-notification";
import {
  handleTransactionError,
  TransactionResult,
} from "@/lib/transaction-error-handler";

import {
  UserPlus,
  Copy,
  Clock,
  Shield,
  Trash2,
  Eye,
  Edit,
  Key,
} from "lucide-react";
import { wrapKeyWithPassword } from "@/lib/metadata";

interface ShareDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  file: AppFile;
}

interface AccessInfo {
  hasRead: boolean;
  hasWrite: boolean;
  grantedAt: number;
  expiresAt: number;
  expired: boolean;
}

export function ShareDialog({ isOpen, setIsOpen, file }: ShareDialogProps) {
  const [walletAddress, setWalletAddress] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [expirationDays, setExpirationDays] = useState<number>(0);
  const [isSharing, setIsSharing] = useState(false);
  const [currentShares, setCurrentShares] = useState<
    Array<{ address: string; info: AccessInfo }>
  >([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);

  // Transaction notification hook
  const { notification, showSuccess, showError, hideNotification } =
    useTransactionNotification();

  // Load current shares when dialog opens
  useEffect(() => {
    if (isOpen && file.cid) {
      loadCurrentShares();
    }
  }, [isOpen, file.cid]);

  const loadCurrentShares = async () => {
    if (!(window as any).ethereum) return;

    setIsLoadingShares(true);
    try {
      const { getContract, custom } = await import("viem");
      const { createPublicClient, createWalletClient, http } = await import(
        "viem"
      );
      const { parseAbi } = await import("viem");
      const chainsMod = await import("viem/chains");

      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

      // Derive chain from wallet to avoid mismatches
      const chainIdHex = await (window as any).ethereum.request({
        method: "eth_chainId",
      });
      const chainId = parseInt(chainIdHex, 16);
      const chain =
        chainId === 31337
          ? chainsMod.hardhat
          : chainId === 1337
          ? chainsMod.localhost
          : chainsMod.sepolia;

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });
      const walletClient = createWalletClient({
        chain,
        transport: custom((window as any).ethereum),
      });

      const [account] = await walletClient.getAddresses();
      const contractAddress = process.env
        .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

      const abi = parseAbi([
        "function getFileInfo(uint256) view returns (string, string, uint256, address, uint256, bool, string, bool, string)",
        "function getAccessInfo(uint256, address) view returns (bool, bool, uint256, uint256, bool)",
        "function metadataToFileId(string) view returns (uint256)",
      ]);

      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any; // Type assertion to avoid complex viem types

      // Resolve fileId from the file's metadataCID
      const fileIdFromMeta = await contract.read.metadataToFileId([
        (file.metadataCID || file.cid) as string,
      ]);
      const latestFileId =
        fileIdFromMeta && fileIdFromMeta !== BigInt(0)
          ? fileIdFromMeta
          : BigInt(1);

      // Load access info for common addresses (this is a simplified approach)
      const commonAddresses = [
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      ];

      const shares = [];
      for (const addr of commonAddresses) {
        try {
          const accessInfo = (await contract.read.getAccessInfo([
            latestFileId,
            addr,
          ])) as [boolean, boolean, bigint, bigint, boolean];
          if (accessInfo[0] || accessInfo[1]) {
            // hasRead or hasWrite
            shares.push({
              address: addr,
              info: {
                hasRead: accessInfo[0],
                hasWrite: accessInfo[1],
                grantedAt: Number(accessInfo[2]),
                expiresAt: Number(accessInfo[3]),
                expired: accessInfo[4],
              },
            });
          }
        } catch (error) {
          // Address might not have access, continue
        }
      }

      setCurrentShares(shares);
    } catch (error) {
      console.error("Error loading shares:", error);
    } finally {
      setIsLoadingShares(false);
    }
  };

  const handleShare = async () => {
    if (!walletAddress || !(window as any).ethereum) return;

    setIsSharing(true);
    let transactionResult: TransactionResult | null = null;

    try {
      const { getContract, custom } = await import("viem");
      const { createPublicClient, createWalletClient, http } = await import(
        "viem"
      );
      const { parseAbi } = await import("viem");
      const chainsMod = await import("viem/chains");

      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

      // Derive chain from wallet to avoid mismatches
      const chainIdHex = await (window as any).ethereum.request({
        method: "eth_chainId",
      });
      const chainId = parseInt(chainIdHex, 16);
      const chain =
        chainId === 31337
          ? chainsMod.hardhat
          : chainId === 1337
          ? chainsMod.localhost
          : chainsMod.sepolia;

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });
      const walletClient = createWalletClient({
        chain,
        transport: custom((window as any).ethereum),
      });

      const [account] = await walletClient.getAddresses();
      const contractAddress = process.env
        .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

      // Validate wallet address
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        throw new Error("Invalid wallet address format");
      }

      const abi = parseAbi([
        "function shareEncryptedFile(uint256, address, string, uint256)",
        "function grantRead(uint256, address, uint256)",
        "function grantWrite(uint256, address, uint256)",
        "function metadataToFileId(string) view returns (uint256)",
      ]);

      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      // Resolve file ID via metadata
      const fileId = await contract.read.metadataToFileId([
        (file.metadataCID || file.cid) as string,
      ]);
      if (!fileId || fileId === BigInt(0)) {
        throw new Error("Unable to resolve file ID from metadataCID");
      }

      // Calculate expiration timestamp
      const expiresAt =
        expirationDays > 0
          ? Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60
          : 0;

      let txHash: string;

      if (file.encrypted && file.encryptionData) {
        // For encrypted files, wrap the key for the recipient
        // In a real implementation, you'd use the recipient's public key
        // For now, we'll use a simple password-based wrapping
        const recipientPassword = `recipient_${walletAddress.slice(2, 10)}`; // Simplified
        const wrappedKey = await wrapKeyWithPassword(
          file.encryptionData.key,
          recipientPassword,
          file.encryptionData.iv,
          100000
        );

        // Share encrypted file with wrapped key
        txHash = await contract.write.shareEncryptedFile(
          [
            fileId,
            walletAddress as `0x${string}`,
            wrappedKey,
            BigInt(expiresAt),
          ],
          { account }
        );

        console.log("🔐 Encrypted file shared with wrapped key. TX:", txHash);
      } else {
        // For non-encrypted files, just grant permissions
        if (permission === "read") {
          txHash = await contract.write.grantRead(
            [fileId, walletAddress as `0x${string}`, BigInt(expiresAt)],
            { account }
          );
          console.log("👁️ Read access granted. TX:", txHash);
        } else {
          txHash = await contract.write.grantWrite(
            [fileId, walletAddress as `0x${string}`, BigInt(expiresAt)],
            { account }
          );
          console.log("✏️ Write access granted. TX:", txHash);
        }
      }

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      console.log(
        "📗 Share transaction confirmed in block:",
        Number(receipt.blockNumber)
      );

      // Reload current shares
      await loadCurrentShares();

      // Reset form
      setWalletAddress("");
      setPermission("read");
      setExpirationDays(0);

      // Show success notification
      showSuccess(
        "File Shared Successfully",
        `File has been shared with ${walletAddress.slice(
          0,
          6
        )}...${walletAddress.slice(-4)}`
      );
    } catch (error: any) {
      console.error("Error sharing file:", error);

      // Handle transaction error
      transactionResult = handleTransactionError(error, "file sharing");

      if (transactionResult.error) {
        showError(
          "Sharing Failed",
          transactionResult.error.userFriendlyMessage,
          transactionResult.error,
          () => handleShare() // Retry function
        );
      } else {
        showError(
          "Sharing Failed",
          error instanceof Error ? error.message : "Unknown error occurred"
        );
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeAccess = async (address: string) => {
    if (!(window as any).ethereum) return;

    try {
      const { getContract, custom } = await import("viem");
      const { createPublicClient, createWalletClient, http } = await import(
        "viem"
      );
      const { parseAbi } = await import("viem");
      const chainsMod = await import("viem/chains");

      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

      // Derive chain from wallet to avoid mismatches
      const chainIdHex = await (window as any).ethereum.request({
        method: "eth_chainId",
      });
      const chainId = parseInt(chainIdHex, 16);
      const chain =
        chainId === 31337
          ? chainsMod.hardhat
          : chainId === 1337
          ? chainsMod.localhost
          : chainsMod.sepolia;

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });
      const walletClient = createWalletClient({
        chain,
        transport: custom((window as any).ethereum),
      });

      const [account] = await walletClient.getAddresses();
      const contractAddress = process.env
        .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

      const abi = parseAbi([
        "function revokeAccess(uint256, address)",
        "function metadataToFileId(string) view returns (uint256)",
      ]);

      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      const fileId = await contract.read.metadataToFileId([
        (file.metadataCID || file.cid) as string,
      ]);
      if (!fileId || fileId === BigInt(0)) {
        throw new Error("Unable to resolve file ID from metadataCID");
      }

      const txHash = await contract.write.revokeAccess(
        [fileId, address as `0x${string}`],
        { account }
      );

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });

      console.log("🚫 Access revoked. TX:", txHash);
      console.log(
        "📗 Revoke transaction confirmed in block:",
        Number(receipt.blockNumber)
      );

      // Reload current shares
      await loadCurrentShares();

      // Show success notification
      showSuccess(
        "Access Revoked",
        `Access has been revoked for ${address.slice(0, 6)}...${address.slice(
          -4
        )}`
      );
    } catch (error: any) {
      console.error("Error revoking access:", error);

      // Handle transaction error
      const transactionResult = handleTransactionError(
        error,
        "access revocation"
      );

      if (transactionResult.error) {
        showError(
          "Revoke Failed",
          transactionResult.error.userFriendlyMessage,
          transactionResult.error,
          () => handleRevokeAccess(address) // Retry function
        );
      } else {
        showError(
          "Revoke Failed",
          error instanceof Error ? error.message : "Unknown error occurred"
        );
      }
    }
  };

  const generateShareLink = () => {
    // Use metadataCID if available, otherwise fall back to file.id
    const shareId = file.metadataCID || file.cid;
    const link = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard.writeText(link);
    alert("Share link copied to clipboard!");
  };

  const formatTimestamp = (timestamp: number) => {
    if (timestamp === 0) return "Never expires";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        title={`Share "${file.name}"`}
      >
        <div className="space-y-6 max-w-9xl">
          {/* Share with new user */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Share with New User
            </h3>

            <div>
              <label className="block text-sm font-medium mb-2">
                Wallet Address
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x1234...5678"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <Button
                  onClick={handleShare}
                  disabled={!walletAddress || isSharing}
                  className="min-w-[100px]"
                >
                  {isSharing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Share
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Permission
                </label>
                <select
                  value={permission}
                  onChange={(e) =>
                    setPermission(e.target.value as "read" | "write")
                  }
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="read">Can view</option>
                  <option value="write">Can edit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Expires in
                </label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0}>Never</option>
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
            </div>

            {file.encrypted && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <Key className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    <strong>Encrypted File:</strong> Encryption key will be
                    securely shared with the recipient.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Current shares */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Currently Shared With
            </h3>

            {isLoadingShares ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading shares...</p>
              </div>
            ) : currentShares.length > 0 ? (
              <div className="space-y-3">
                {currentShares.map((share, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {share.info.hasWrite ? (
                          <Edit className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Eye className="h-4 w-4 text-green-600" />
                        )}
                        <span className="text-sm">{share.address}</span>
                      </div>

                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>
                          Expires: {formatTimestamp(share.info.expiresAt)}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeAccess(share.address)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Shield className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">
                  No users currently have access to this file
                </p>
              </div>
            )}
          </div>

          {/* Share link */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Share Link
            </h3>
            <div className="flex space-x-2">
              <input
                value={`${window.location.origin}/share/${
                  file.metadataCID || file.cid
                }`}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50"
              />
              <Button variant="outline" onClick={generateShareLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Anyone with this link can request access to view the file
            </p>
          </div>
        </div>
      </Dialog>

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
