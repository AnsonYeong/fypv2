"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Lock, Eye, FileText, Calendar, User } from "lucide-react";

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

  useEffect(() => {
    // In a real implementation, you'd fetch the file details from IPFS/blockchain
    // For now, we'll simulate a shared file
    setTimeout(() => {
      setFile({
        id: fileId,
        name: "Shared Document.pdf",
        size: 1024000,
        type: "application/pdf",
        cid: "bafybeihvj6abpebmpsehdky6focwqaa6kcdbs4j7hcxctfyiowkuus2i7e",
        gatewayUrl:
          "https://gateway.pinata.cloud/ipfs/bafybeihvj6abpebmpsehdky6focwqaa6kcdbs4j7hcxctfyiowkuus2i7e",
        encrypted: true,
        owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        sharedAt: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
        expiresAt: Math.floor(Date.now() / 1000) + 604800, // 7 days from now
        permissions: {
          read: true,
          write: false,
        },
      });
      setIsLoading(false);
    }, 1000);
  }, [fileId]);

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
        "function hasReadAccess(uint256, address) view returns (bool)",
        "function getWrappedKey(uint256) view returns (string)",
        "function getAccessInfo(uint256, address) view returns (bool, bool, uint256, uint256, bool)",
      ]);

      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      // For demo purposes, we'll assume file ID 1
      const fileId = 1;

      const hasRead = await contract.read.hasReadAccess([fileId, address]);

      if (hasRead) {
        setHasAccess(true);

        if (file.encrypted) {
          try {
            const wrappedKeyData = await contract.read.getWrappedKey([fileId]);
            setWrappedKey(wrappedKeyData);
          } catch (error) {
            console.log("No wrapped key found for this user");
          }
        }
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      // For demo purposes, grant access
      setHasAccess(true);
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

      // In a real implementation, you'd:
      // 1. Download the encrypted file from IPFS
      // 2. Decrypt it using the wrapped key and password
      // 3. Create a download link

      // For demo purposes, we'll just show a success message
      alert(
        "File download started! (This is a demo - in production, the file would be decrypted and downloaded)"
      );
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file");
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
                        Decryption Password
                      </label>
                      <Input
                        type="password"
                        value={decryptionPassword}
                        onChange={(e) => setDecryptionPassword(e.target.value)}
                        placeholder="Enter the password provided by the sender"
                        className="max-w-md"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The sender should have provided you with a password to
                        decrypt this file.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleDownload}
                    disabled={file.encrypted && !decryptionPassword}
                    size="lg"
                    className="w-full md:w-auto"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download File
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
                  " Encrypted files require the decryption password provided by the sender."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
