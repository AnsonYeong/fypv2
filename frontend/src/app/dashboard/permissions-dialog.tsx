"use client";

import React, { useState, useEffect } from "react";
import { AppFile } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  User,
  Lock,
  Unlock,
  Users,
  Clock,
  Edit,
  Trash2,
  Save,
  Copy,
  History,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
} from "lucide-react";
import {
  createPublicClient,
  http,
  getContract,
  custom,
  createWalletClient,
  parseAbi,
} from "viem";
import * as Chains from "viem/chains";

interface PermissionsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  file: AppFile;
}

interface UserAccess {
  address: string;
  canRead: boolean;
  canWrite: boolean;
  grantedAt: number;
  expiresAt: number;
  isExpired: boolean;
}

interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    expiresInDays: number;
  };
}

export function PermissionsDialog({
  isOpen,
  setIsOpen,
  file,
}: PermissionsDialogProps) {
  const [activeTab, setActiveTab] = useState<
    "users" | "templates" | "history" | "settings"
  >("users");
  const [userAccess, setUserAccess] = useState<UserAccess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "expired">(
    "all"
  );
  const [bulkAction, setBulkAction] = useState<
    "none" | "grant-read" | "grant-write" | "revoke"
  >("none");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [permissionTemplates, setPermissionTemplates] = useState<
    PermissionTemplate[]
  >([
    {
      id: "1",
      name: "View Only",
      description: "Users can only view and download files",
      permissions: { canRead: true, canWrite: false, expiresInDays: 30 },
    },
    {
      id: "2",
      name: "Collaborator",
      description: "Users can view, edit, and upload new versions",
      permissions: { canRead: true, canWrite: true, expiresInDays: 90 },
    },
    {
      id: "3",
      name: "Temporary Access",
      description: "Short-term access for contractors or guests",
      permissions: { canRead: true, canWrite: false, expiresInDays: 7 },
    },
  ]);

  // Load user access information from blockchain
  useEffect(() => {
    if (isOpen && file.cid) {
      loadUserAccess();
    }
  }, [isOpen, file.cid]);

  const loadUserAccess = async () => {
    setIsLoading(true);

    // Debug: Log the file object being processed
    console.log("🔍 DEBUG: File object received:", file);
    console.log("🔍 DEBUG: File properties:", {
      id: file.id,
      name: file.name,
      cid: file.cid,
      owner: file.owner,
      encrypted: file.encrypted,
    });

    try {
      const chainIdHex = await (window as any).ethereum?.request?.({
        method: "eth_chainId",
      });
      const chainId = chainIdHex ? parseInt(chainIdHex, 16) : 31337;
      const chain =
        chainId === 31337
          ? Chains.hardhat
          : chainId === 1337
          ? Chains.localhost
          : Chains.sepolia;
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

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
        "function getAccessInfo(uint256, address) view returns (bool canRead, bool canWrite, uint256 grantedAt, uint256 expiresAt)",
        "function getUsersWithAccess(uint256) view returns (address[])",
        "function getUserFiles(address) view returns (uint256[])",
        "function getFileInfo(uint256) view returns (string, string, uint256, address, uint256, bool, string, bool, string)",
      ]);
      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      console.log("🔍 Looking for file:", file.name);
      console.log("🔍 File CID (this is the actual file):", file.cid);
      console.log(
        "🔍 Metadata CID (this is what blockchain stores):",
        file.metadataCID
      );
      console.log("🔍 Contract address:", contractAddress);

      // The blockchain stores metadata CID, not file CID
      // Use metadataCID if available, otherwise fall back to cid
      const lookupCID = file.metadataCID || file.cid;
      let fileId = await contract.read.hashToFileId([lookupCID]);
      console.log(
        "🔍 File ID from lookup CID:",
        fileId ? fileId.toString() : "Not found"
      );

      // If not found, try to find the file by searching through user's files
      if (!fileId || fileId === BigInt(0)) {
        console.log(
          "File not found with lookup CID, searching through user's files..."
        );

        try {
          // Get current user's account
          const [account] = await walletClient.getAddresses();

          // Get all files for the current user
          const userFiles = await contract.read.getUserFiles([account]);
          console.log("User has", userFiles.length, "files on blockchain");

          // Look through user's files to find one that matches
          for (const userFileId of userFiles) {
            try {
              const fileInfo = await contract.read.getFileInfo([userFileId]);
              console.log("Checking file ID", userFileId, "name:", fileInfo[1]);

              // Check if this file's name matches
              if (fileInfo[1] === file.name) {
                fileId = userFileId;
                console.log(
                  "Found matching file by name:",
                  fileInfo[1],
                  "with ID:",
                  fileId
                );
                break;
              }
            } catch (error) {
              console.log("Error checking file", userFileId, ":", error);
              continue;
            }
          }
        } catch (error) {
          console.log("Error searching user files:", error);
        }

        // If still not found, show empty list
        if (!fileId || fileId === BigInt(0)) {
          console.log("Could not find file on blockchain, showing empty list");
          setUserAccess([]);
          return;
        }
      }

      console.log("✅ Found file on blockchain with ID:", fileId.toString());

      // Get all users who have access to this file
      console.log(
        "🔍 Calling getUsersWithAccess for file ID:",
        fileId.toString()
      );
      const usersWithAccess = await contract.read.getUsersWithAccess([fileId]);
      console.log("👥 Users with access:", usersWithAccess);
      console.log("👥 Users with access length:", usersWithAccess.length);

      const accessList: UserAccess[] = [];
      console.log(
        "🔍 Processing",
        usersWithAccess.length,
        "users with access..."
      );

      for (const addr of usersWithAccess) {
        try {
          console.log("🔍 Checking access for address:", addr);
          const accessInfo = await contract.read.getAccessInfo([fileId, addr]);
          console.log("🔍 Access info for", addr, ":", accessInfo);

          if (accessInfo[0] || accessInfo[1]) {
            // has read or write access
            const userAccess: UserAccess = {
              address: addr,
              canRead: accessInfo[0],
              canWrite: accessInfo[1],
              grantedAt: Number(accessInfo[2]),
              expiresAt: Number(accessInfo[3]),
              isExpired:
                Number(accessInfo[3]) > 0 &&
                Number(accessInfo[3]) < Math.floor(Date.now() / 1000),
            };
            accessList.push(userAccess);
            console.log("✅ Added user access:", userAccess);
          } else {
            console.log("❌ User has no access permissions");
          }
        } catch (error) {
          console.log("❌ Error checking access for", addr, ":", error);
          // Address might not have access, continue
          continue;
        }
      }

      console.log("📋 Final access list:", accessList);
      setUserAccess(accessList);
    } catch (error) {
      console.error("Error loading user access:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (bulkAction === "none" || selectedUsers.size === 0) return;

    try {
      setIsLoading(true);
      const chainIdHex = await (window as any).ethereum?.request?.({
        method: "eth_chainId",
      });
      const chainId = chainIdHex ? parseInt(chainIdHex, 16) : 31337;
      const chain =
        chainId === 31337
          ? Chains.hardhat
          : chainId === 1337
          ? Chains.localhost
          : Chains.sepolia;
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

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
        "function hashToFileId(string) view returns (uint256)",
        "function grantRead(uint256, address, uint256) external",
        "function grantWrite(uint256, address, uint256) external",
        "function revokeAccess(uint256, address) external",
      ]);
      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      const fileId = await contract.read.hashToFileId([file.cid]);
      if (!fileId || fileId === BigInt(0)) return;

      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

      for (const userAddress of selectedUsers) {
        try {
          if (bulkAction === "grant-read") {
            await contract.write.grantRead(
              [fileId, userAddress as `0x${string}`, BigInt(expiresAt)],
              { account }
            );
          } else if (bulkAction === "grant-write") {
            await contract.write.grantWrite(
              [fileId, userAddress as `0x${string}`, BigInt(expiresAt)],
              { account }
            );
          } else if (bulkAction === "revoke") {
            await contract.write.revokeAccess(
              [fileId, userAddress as `0x${string}`],
              { account }
            );
          }
        } catch (error) {
          console.error(
            `Error performing bulk action on ${userAddress}:`,
            error
          );
        }
      }

      // Refresh user access list
      await loadUserAccess();
      setSelectedUsers(new Set());
      setBulkAction("none");
      alert(`Bulk action completed for ${selectedUsers.size} users`);
    } catch (error) {
      console.error("Error performing bulk action:", error);
      alert("Error performing bulk action. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndividualAction = async (
    userAddress: string,
    action: "grant-read" | "grant-write" | "revoke"
  ) => {
    try {
      setIsLoading(true);
      console.log(`🚀 Starting ${action} action for user:`, userAddress);

      const chainIdHex = await (window as any).ethereum?.request?.({
        method: "eth_chainId",
      });
      const chainId = chainIdHex ? parseInt(chainIdHex, 16) : 31337;
      const chain =
        chainId === 31337
          ? Chains.hardhat
          : chainId === 1337
          ? Chains.localhost
          : Chains.sepolia;
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

      console.log(`🔗 Chain ID: ${chainId}, RPC: ${rpcUrl}`);

      const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      });
      const walletClient = createWalletClient({
        chain,
        transport: custom((window as any).ethereum),
      });

      const [account] = await walletClient.getAddresses();
      console.log(`👤 Current account:`, account);

      const contractAddress = process.env
        .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
      const abi = parseAbi([
        "function hashToFileId(string) view returns (uint256)",
        "function grantRead(uint256, address, uint256) external",
        "function grantWrite(uint256, address, uint256) external",
        "function revokeAccess(uint256, address) external",
      ]);
      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      console.log(`📁 Looking for file: ${file.name} with CID: ${file.cid}`);
      console.log(`📁 Note: This CID is the file CID, not the metadata CID`);
      console.log(`📁 Metadata CID: ${file.metadataCID}`);

      // Use metadataCID if available, otherwise fall back to cid
      const lookupCID = file.metadataCID || file.cid;
      const fileId = await contract.read.hashToFileId([lookupCID]);
      console.log(
        `🆔 File ID from lookup CID:`,
        fileId ? fileId.toString() : "Not found"
      );

      if (!fileId || fileId === BigInt(0)) {
        console.error("❌ File not found on blockchain");
        alert(
          "File not found on blockchain. Please try uploading the file first."
        );
        return;
      }

      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
      console.log(
        `⏰ Setting expiration to:`,
        new Date(expiresAt * 1000).toISOString()
      );

      try {
        console.log(
          `📝 Executing contract call: ${action} for file ${fileId} and user ${userAddress}`
        );

        if (action === "grant-read") {
          console.log(`📖 Granting READ access...`);
          const txHash = await contract.write.grantRead(
            [fileId, userAddress as `0x${string}`, BigInt(expiresAt)],
            { account }
          );
          console.log(`✅ READ access granted! Transaction hash:`, txHash);
        } else if (action === "grant-write") {
          console.log(`✏️ Granting WRITE access...`);
          const txHash = await contract.write.grantWrite(
            [fileId, userAddress as `0x${string}`, BigInt(expiresAt)],
            { account }
          );
          console.log(`✅ WRITE access granted! Transaction hash:`, txHash);
        } else if (action === "revoke") {
          console.log(`🚫 Revoking access...`);
          const txHash = await contract.write.revokeAccess(
            [fileId, userAddress as `0x${string}`],
            { account }
          );
          console.log(`✅ Access revoked! Transaction hash:`, txHash);
        }

        console.log(`🔄 Refreshing user access list...`);
        // Refresh user access list
        await loadUserAccess();
        alert(
          `Successfully ${action.replace("-", "ed ")} access for ${userAddress}`
        );
      } catch (error) {
        console.error(
          `❌ Error performing ${action} on ${userAddress}:`,
          error
        );
        alert(
          `Error performing ${action}. Please check the console for details.`
        );
      }
    } catch (error) {
      console.error("❌ Error performing individual action:", error);
      alert("Error performing action. Please check the console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const applyTemplate = (template: PermissionTemplate) => {
    setBulkAction("grant-read");
    // You could implement template application logic here
    alert(
      `Template "${template.name}" applied. Select users and click "Apply Bulk Action" to grant permissions.`
    );
  };

  const filteredUsers = userAccess.filter((user) => {
    const matchesSearch = user.address
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === "all" ||
      (filterType === "active" && !user.isExpired) ||
      (filterType === "expired" && user.isExpired);
    return matchesSearch && matchesFilter;
  });

  const toggleUserSelection = (address: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(address)) {
      newSelected.delete(address);
    } else {
      newSelected.add(address);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.address)));
    }
  };

  const exportAccessList = () => {
    const csvContent = [
      "Address,Can Read,Can Write,Granted At,Expires At,Status",
      ...filteredUsers
        .map(
          (user) =>
            `${user.address},${user.canRead},${user.canWrite},${new Date(
              user.grantedAt * 1000
            ).toISOString()},${
              user.expiresAt > 0
                ? new Date(user.expiresAt * 1000).toISOString()
                : "Never"
            },${user.isExpired ? "Expired" : "Active"}`
        )
        .join("\n"),
    ];

    const blob = new Blob([csvContent.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `file-permissions-${file.name}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={`Advanced Permissions for "${file.name}"`}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "users", label: "User Access", icon: Users },
              { id: "templates", label: "Templates", icon: Settings },
              { id: "history", label: "Access History", icon: History },
              { id: "settings", label: "Settings", icon: Lock },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by wallet address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired Only</option>
              </select>
              <Button variant="outline" onClick={exportAccessList}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>

            {/* Bulk Actions */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium">Bulk Actions:</span>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value as any)}
                  className="border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="none">Select Action</option>
                  <option value="grant-read">Grant Read Access</option>
                  <option value="grant-write">Grant Write Access</option>
                  <option value="revoke">Revoke Access</option>
                </select>
                <Button
                  onClick={handleBulkAction}
                  disabled={
                    bulkAction === "none" ||
                    selectedUsers.size === 0 ||
                    isLoading
                  }
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Apply to {selectedUsers.size} Users
                </Button>
              </div>
            </div>

            {/* User Access Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={
                      selectedUsers.size === filteredUsers.length &&
                      filteredUsers.length > 0
                    }
                    onChange={selectAllUsers}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All
                  </span>
                  <span className="text-sm text-gray-500">
                    {selectedUsers.size} of {filteredUsers.length} users
                    selected
                  </span>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading user access...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Users Currently Have Access
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      This file hasn't been shared with any users yet. Use the
                      Share dialog to grant access to other users.
                    </p>
                    <p className="text-xs text-gray-500">
                      Note: If you've shared this file before but don't see
                      users here, the file may need to be re-uploaded to the
                      blockchain with the correct CID.
                    </p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.address}
                      className={`px-6 py-4 border-b border-gray-100 hover:bg-gray-50 ${
                        user.isExpired ? "bg-red-50" : ""
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.address)}
                          onChange={() => toggleUserSelection(user.address)}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-600" />
                            <span className="text-sm">{user.address}</span>
                            {user.isExpired && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                Expired
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Granted:{" "}
                            {new Date(
                              user.grantedAt * 1000
                            ).toLocaleDateString()}
                            {user.expiresAt > 0 && (
                              <span className="ml-4">
                                Expires:{" "}
                                {new Date(
                                  user.expiresAt * 1000
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              user.canRead
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.canRead ? "Read" : "No Read"}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              user.canWrite
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.canWrite ? "Write" : "No Write"}
                          </span>

                          {/* Individual Action Buttons */}
                          <div className="flex items-center space-x-1 ml-2">
                            {!user.canRead && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleIndividualAction(
                                    user.address,
                                    "grant-read"
                                  )
                                }
                                disabled={isLoading}
                                className="h-6 px-2 text-xs bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                              >
                                Grant Read
                              </Button>
                            )}
                            {!user.canWrite && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleIndividualAction(
                                    user.address,
                                    "grant-write"
                                  )
                                }
                                disabled={isLoading}
                                className="h-6 px-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                              >
                                Grant Write
                              </Button>
                            )}
                            {(user.canRead || user.canWrite) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleIndividualAction(user.address, "revoke")
                                }
                                disabled={isLoading}
                                className="h-6 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === "templates" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {permissionTemplates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">
                      {template.name}
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => applyTemplate(template)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Apply
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {template.description}
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          template.permissions.canRead
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      ></span>
                      <span>
                        Read Access:{" "}
                        {template.permissions.canRead ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          template.permissions.canWrite
                            ? "bg-blue-500"
                            : "bg-gray-300"
                        }`}
                      ></span>
                      <span>
                        Write Access:{" "}
                        {template.permissions.canWrite ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span>
                        Expires in: {template.permissions.expiresInDays} days
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create New Template
              </Button>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Access Logs</h3>
                  <p className="text-sm text-gray-600">
                    Track all permission changes and file access
                  </p>
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Logs
                </Button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>
                Access history tracking will be implemented in the next version.
              </p>
              <p className="text-sm mt-2">
                This will include detailed logs of all permission changes, file
                access, and user activity.
              </p>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4">
                File Security Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">
                      Require Password for Access
                    </label>
                    <p className="text-sm text-gray-500">
                      Additional security layer for sensitive files
                    </p>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">
                      Allow Public Access
                    </label>
                    <p className="text-sm text-gray-500">
                      Make file accessible without wallet connection
                    </p>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">
                      Track Access Logs
                    </label>
                    <p className="text-sm text-gray-500">
                      Record all file access and permission changes
                    </p>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">
                      Auto-Expire Permissions
                    </label>
                    <p className="text-sm text-gray-500">
                      Automatically revoke access after inactivity
                    </p>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4">
                Notification Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">
                      Permission Changes
                    </label>
                    <p className="text-sm text-gray-500">
                      Notify when users are granted or revoked access
                    </p>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">
                      Access Attempts
                    </label>
                    <p className="text-sm text-gray-500">
                      Alert on failed access attempts
                    </p>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-gray-700">
                      Expiration Warnings
                    </label>
                    <p className="text-sm text-gray-500">
                      Notify before permissions expire
                    </p>
                  </div>
                  <input type="checkbox" className="rounded" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-t pt-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {activeTab === "users" &&
              `${filteredUsers.length} users with access`}
            {activeTab === "templates" &&
              `${permissionTemplates.length} permission templates`}
            {activeTab === "history" && "Access history and logs"}
            {activeTab === "settings" && "Security and notification settings"}
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
            {activeTab === "users" && (
              <Button onClick={loadUserAccess} disabled={isLoading}>
                {isLoading ? "Refreshing..." : "Refresh Access"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
