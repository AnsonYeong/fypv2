"use client";

import React, { useState, useEffect } from "react";
import {
  AppFile,
  saveFilesToStorage,
  getFilesFromStorage,
  clearFilesFromStorage,
  retrieveUserFilesFromIPFS,
} from "@/lib/data";
import { FileList } from "./file-list";
import { FileUploadDialog } from "./file-upload-dialog";
import { ShareDialog } from "./share-dialog";
import { PermissionsDialog } from "./permissions-dialog";
import { VersionHistorySheet } from "./version-history-sheet";
import { EnhancedDownloadDialog } from "./enhanced-download-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Home, Folder, Users, Settings, User, Lock } from "lucide-react";
import {
  createPublicClient,
  http,
  getContract,
  custom,
  createWalletClient,
  parseAbi,
} from "viem";
import * as Chains from "viem/chains";

export function DashboardClient() {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [sharedFiles, setSharedFiles] = useState<AppFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<AppFile | null>(null);
  const [activeSection, setActiveSection] = useState("files");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingShared, setIsLoadingShared] = useState(false);
  const [isLoadingSharedCounts, setIsLoadingSharedCounts] = useState(false);
  const [ipfsError, setIpfsError] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isShareOpen, setShareOpen] = useState(false);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);
  const [isVersionsOpen, setVersionsOpen] = useState(false);
  const [isDecryptOpen, setDecryptOpen] = useState(false);
  const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isProfileInfoOpen, setProfileInfoOpen] = useState(false);
  const [isLogoutOpen, setLogoutOpen] = useState(false);

  // Get wallet address from localStorage or session
  useEffect(() => {
    const storedAddress = localStorage.getItem("walletAddress");
    if (storedAddress) {
      setWalletAddress(storedAddress);
    }
  }, []);

  // Function to count shared users for a specific file
  const getSharedUsersCount = async (fileId: number): Promise<number> => {
    if (!walletAddress) return 0;

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
      const [account] = await walletClient.getAddresses();

      const contractAddress = process.env
        .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
      const abi = parseAbi([
        "function getAccessInfo(uint256, address) view returns (bool canRead, bool canWrite, uint256 grantedAt, uint256 expiresAt)",
      ]);
      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      // Check a list of common addresses to see who has access
      const commonAddresses = [
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
        "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
        "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
        "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
        "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
        "0xBcd4042DE499D14e55001CcbB24a551F3b954096",
      ];

      let sharedCount = 0;
      for (const addr of commonAddresses) {
        try {
          const accessInfo = await contract.read.getAccessInfo([
            BigInt(fileId),
            addr as `0x${string}`,
          ]);
          if (accessInfo[0] && accessInfo[0] !== account) {
            // canRead and not the owner
            sharedCount++;
          }
        } catch (error) {
          // Address might not have access, continue
          continue;
        }
      }

      return sharedCount;
    } catch (error) {
      console.error("Error counting shared users:", error);
      return 0;
    }
  };

  // Function to load files from blockchain with shared counts
  const loadFilesFromBlockchain = async (): Promise<AppFile[]> => {
    if (!walletAddress) return [];

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
      const [account] = await walletClient.getAddresses();

      const contractAddress = process.env
        .NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
      const abi = parseAbi([
        "function getUserFiles(address) view returns (uint256[])",
        "function getFileInfo(uint256) view returns (string, string, uint256, address, uint256, bool, string, bool, string)",
      ]);
      const contract = getContract({
        address: contractAddress,
        abi,
        client: { public: publicClient, wallet: walletClient as any },
      }) as any;

      const userFileIds = await contract.read.getUserFiles([account]);
      const results: AppFile[] = [];

      for (const fileId of userFileIds) {
        try {
          const info = (await contract.read.getFileInfo([fileId])) as [
            string,
            string,
            bigint,
            string,
            bigint,
            boolean,
            string,
            boolean,
            string
          ];

          const metadataCID = info[6];
          const name = info[1];
          const size = Number(info[2]);
          const owner = info[3];
          const timestamp = Number(info[4]);
          const isActive = info[5];
          const isEncrypted = info[7];
          const masterKeyHash = info[8];

          // Get shared count for this file
          const sharedCount = await getSharedUsersCount(Number(fileId));

          // Fetch metadata from IPFS to get additional info
          let gatewayUrl: string | undefined = undefined;
          let fileType: string | undefined = undefined;
          try {
            const res = await fetch(
              `/api/ipfs/retrieve?cid=${encodeURIComponent(metadataCID)}`
            );
            if (res.ok) {
              const meta = await res.json();
              gatewayUrl =
                meta?.gatewayUrl || meta?.ipfsGatewayUrl || undefined;
              fileType = meta?.fileInfo?.mimeType || undefined;
            }
          } catch {}

          results.push({
            id: Number(fileId).toString(),
            name: name,
            size: size,
            type: fileType || "unknown",
            lastModified: new Date(timestamp * 1000),
            owner: owner,
            sharedWith: Array(sharedCount).fill("shared-user"), // Placeholder for shared count display
            permissions: "admin",
            versions: [],
            cid: metadataCID,
            gatewayUrl: gatewayUrl,
            encrypted: isEncrypted,
          });
        } catch (error) {
          console.error(`Error processing file ID ${fileId}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error("Error loading files from blockchain:", error);
      return [];
    }
  };

  // Initialize files from storage and IPFS when wallet address changes
  useEffect(() => {
    const initializeFiles = async () => {
      try {
        setIsLoading(true);
        setIpfsError(null);

        if (walletAddress) {
          // User is logged in, try to retrieve their files from blockchain first
          const blockchainFiles = await loadFilesFromBlockchain();
          if (blockchainFiles.length > 0) {
            setFiles(blockchainFiles);
          } else {
            // Fallback to IPFS and storage if no blockchain files
            const userFiles = await retrieveUserFilesFromIPFS(walletAddress);
            if (userFiles.length > 0) {
              setFiles(userFiles);
            } else {
              // If no user files, check if there are any stored files
              const storedFiles = getFilesFromStorage(walletAddress);
              if (storedFiles.length > 0) {
                setFiles(storedFiles);
              } else {
                // No files found, start with empty list
                setFiles([]);
              }
            }
          }
        } else {
          // No wallet connected, check for demo files
          const storedFiles = getFilesFromStorage("demo-user");
          if (storedFiles.length > 0) {
            setFiles(storedFiles);
          } else {
            // If no stored files, use mock files for demonstration
            setFiles([]);
          }
        }
      } catch (error) {
        console.error("Error initializing files:", error);
        setIpfsError(
          "Failed to load files from IPFS. Some files may not be accessible."
        );
        // Fallback to stored files
        const fallbackFiles = getFilesFromStorage(walletAddress || "demo-user");
        setFiles(fallbackFiles.length > 0 ? fallbackFiles : []);
      } finally {
        setIsLoading(false);
      }
    };

    // Only initialize if we have a wallet address or if this is the first load
    if (walletAddress !== null) {
      initializeFiles();
    }
  }, [walletAddress]);

  // Load files shared with the connected wallet
  useEffect(() => {
    const loadShared = async () => {
      if (!walletAddress) {
        setSharedFiles([]);
        return;
      }
      try {
        setIsLoadingShared(true);
        // Detect chain from MetaMask
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
        const rpcUrl =
          process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

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
          "function getTotalFiles() view returns (uint256)",
          "function hasReadAccess(uint256, address) view returns (bool)",
          "function getFileInfo(uint256) view returns (string, string, uint256, address, uint256, bool, string, bool, string)",
        ]);
        const contract = getContract({
          address: contractAddress,
          abi,
          client: { public: publicClient, wallet: walletClient as any },
        }) as any;

        const total = Number(await contract.read.getTotalFiles());
        const results: AppFile[] = [];
        for (let i = 1; i <= total; i++) {
          try {
            const canRead = await contract.read.hasReadAccess([
              BigInt(i),
              account,
            ]);
            if (!canRead) continue;
            const info = (await contract.read.getFileInfo([BigInt(i)])) as [
              string,
              string,
              bigint,
              string,
              bigint,
              boolean,
              string,
              boolean,
              string
            ];
            const metadataCID = info[6];
            const name = info[1];
            const size = Number(info[2]);
            const encrypted = info[7];
            // Fetch metadata from our API to get gateway URL if needed
            let gatewayUrl: string | undefined = undefined;
            try {
              const res = await fetch(
                `/api/ipfs/retrieve?cid=${encodeURIComponent(metadataCID)}`
              );
              if (res.ok) {
                const meta = await res.json();
                gatewayUrl =
                  meta?.gatewayUrl || meta?.ipfsGatewayUrl || undefined;
              }
            } catch {}
            // Get shared count for this file (how many people the owner has shared it with)
            const sharedCount = await getSharedUsersCount(i);

            results.push({
              id: String(i),
              name,
              size,
              type: "unknown",
              lastModified: new Date(Number(info[4]) * 1000),
              owner: info[3],
              sharedWith: Array(sharedCount).fill("shared-user"), // Show actual shared count
              permissions: "read",
              versions: [],
              cid: metadataCID,
              gatewayUrl,
              encrypted,
            } as AppFile);
          } catch {}
        }
        setSharedFiles(results);
      } catch (err) {
        console.error("Failed to load shared files:", err);
        setSharedFiles([]);
      } finally {
        setIsLoadingShared(false);
      }
    };
    loadShared();
  }, [walletAddress]);

  // Function to refresh shared counts for existing files
  const refreshSharedCounts = async () => {
    if (!walletAddress || files.length === 0) return;

    try {
      setIsLoadingSharedCounts(true);
      const updatedFiles = await Promise.all(
        files.map(async (file) => {
          // Try to get fileId from the file's cid by looking it up on-chain
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
            const rpcUrl =
              process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

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
            ]);
            const contract = getContract({
              address: contractAddress,
              abi,
              client: { public: publicClient, wallet: walletClient as any },
            }) as any;

            const fileId = await contract.read.hashToFileId([file.cid]);
            if (fileId && fileId !== BigInt(0)) {
              const sharedCount = await getSharedUsersCount(Number(fileId));
              return {
                ...file,
                sharedWith: Array(sharedCount).fill("shared-user"),
              };
            }
          } catch (error) {
            console.error(
              `Error refreshing shared count for file ${file.name}:`,
              error
            );
          }
          return file;
        })
      );

      setFiles(updatedFiles);
    } catch (error) {
      console.error("Error refreshing shared counts:", error);
    } finally {
      setIsLoadingSharedCounts(false);
    }
  };

  const handleAction = async (action: string, file: AppFile) => {
    try {
      setSelectedFile(file);
      if (action === "share") setShareOpen(true);
      if (action === "permissions") setPermissionsOpen(true);
      if (action === "versions") setVersionsOpen(true);
      if (action === "download") {
        // Open enhanced download dialog for secure retrieve+decrypt
        setDecryptOpen(true);
        return;
      }
      if (action === "delete") {
        // Show confirmation dialog
        const isConfirmed = confirm(
          `Are you sure you want to delete "${file.name}"?\n\nThis will:\n• Remove the file from your dashboard\n• Delete the file from IPFS permanently\n• This action cannot be undone`
        );

        if (!isConfirmed) return;

        try {
          // Show loading state for this specific file
          setDeletingFile(file.id);

          // First, delete from IPFS if it has a CID
          if (file.cid) {
            const deleteResponse = await fetch("/api/ipfs/delete", {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                cid: file.cid,
                fileName: file.name,
              }),
            });

            if (!deleteResponse.ok) {
              const errorData = await deleteResponse.json().catch(() => ({}));
              throw new Error(
                (errorData as any).message ||
                  `Failed to delete file from IPFS: ${deleteResponse.statusText}`
              );
            }

            const deleteResult = await deleteResponse.json();
            console.log("IPFS deletion result:", deleteResult);
          }

          // Then remove from local storage and state
          const updatedFiles = files.filter((f) => f.id !== file.id);
          setFiles(updatedFiles);

          // Save updated files to storage for current user
          const currentUserId = walletAddress || "demo-user";
          saveFilesToStorage(updatedFiles, currentUserId);

          // Show success message
          alert(
            `File "${file.name}" has been successfully deleted from both IPFS and your dashboard.`
          );
        } catch (error) {
          console.error("Error deleting file:", error);

          // Show error message
          const errorMessage =
            error instanceof Error
              ? error.message
              : typeof error === "string"
              ? error
              : JSON.stringify(error);
          alert(
            `Failed to delete file: ${errorMessage}\n\nThe file has been removed from your dashboard but may still exist on IPFS.`
          );

          // Even if IPFS deletion fails, remove from local storage
          const updatedFiles = files.filter((f) => f.id !== file.id);
          setFiles(updatedFiles);
          const currentUserId = walletAddress || "demo-user";
          saveFilesToStorage(updatedFiles, currentUserId);
        } finally {
          setDeletingFile(null);
        }
      }
    } catch (err) {
      console.error("Action handler error:", err);
      const readable =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : JSON.stringify(err);
      alert(`Action failed: ${readable}`);
    }
  };

  const handleAddNewFile = (newFile: AppFile) => {
    const updatedFiles = [newFile, ...files];
    setFiles(updatedFiles);
    // Save updated files to storage for current user
    const currentUserId = walletAddress || "demo-user";
    saveFilesToStorage(updatedFiles, currentUserId);
    // Clear any previous IPFS errors since we just uploaded successfully
    setIpfsError(null);
  };

  const handleLogout = () => {
    setProfileDropdownOpen(false);
    setLogoutOpen(true);
  };

  const confirmLogout = () => {
    // Don't clear files from storage - keep them for IPFS retrieval on next login
    // Only clear the current user session
    localStorage.removeItem("walletAddress");
    setWalletAddress(null);
    setFiles([]);
    setIpfsError(null);
    setLogoutOpen(false);
    // Redirect to login page
    window.location.href = "/login";
  };

  // Function to refresh files from IPFS
  const refreshFilesFromIPFS = async () => {
    try {
      setIsRefreshing(true);
      setIpfsError(null);

      if (walletAddress) {
        // Refresh files from blockchain first, then fallback to IPFS
        const blockchainFiles = await loadFilesFromBlockchain();
        if (blockchainFiles.length > 0) {
          setFiles(blockchainFiles);
        } else {
          const userFiles = await retrieveUserFilesFromIPFS(walletAddress);
          setFiles(userFiles);
        }
      } else {
        const storedFiles = getFilesFromStorage("demo-user");
        setFiles(storedFiles);
      }
    } catch (error) {
      console.error("Error refreshing files:", error);
      setIpfsError(
        "Failed to refresh files from IPFS. Some files may not be accessible."
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to clear all user data (for account deletion)
  const clearAllUserData = () => {
    if (walletAddress) {
      clearFilesFromStorage(walletAddress);
    }
    clearFilesFromStorage("demo-user");
    setFiles([]);
    setIpfsError(null);
  };

  // Function to handle user switching (when wallet changes)
  const handleUserSwitch = async (newWalletAddress: string | null) => {
    try {
      setIsLoading(true);
      setIpfsError(null);

      if (newWalletAddress) {
        // New user logged in, retrieve their files from blockchain first
        const blockchainFiles = await loadFilesFromBlockchain();
        if (blockchainFiles.length > 0) {
          setFiles(blockchainFiles);
        } else {
          const userFiles = await retrieveUserFilesFromIPFS(newWalletAddress);
          setFiles(userFiles);
        }
      } else {
        // No wallet, show demo files
        const storedFiles = getFilesFromStorage("demo-user");
        setFiles(storedFiles);
      }
    } catch (error) {
      console.error("Error switching users:", error);
      setIpfsError(
        "Failed to load user files. Some files may not be accessible."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Watch for wallet address changes and handle user switching
  useEffect(() => {
    if (walletAddress) {
      handleUserSwitch(walletAddress);
    }
  }, [walletAddress]);

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "files", label: "My Files", icon: Folder },
    { id: "shared", label: "Shared With Me", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-primary">BlockShare</h1>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4">
          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-300 ease-in-out transform ${
                    activeSection === item.id
                      ? "bg-primary text-primary-foreground scale-105 shadow-lg"
                      : "text-foreground hover:bg-accent hover:scale-102"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-transform duration-300 ${
                      activeSection === item.id ? "rotate-12" : ""
                    }`}
                  />
                  <span className="font-bold">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-foreground hover:bg-accent transition-all duration-300 ease-in-out transform hover:scale-102">
            <Settings className="h-5 w-5 transition-transform duration-300 hover:rotate-90" />
            <span className="font-bold">Settings</span>
          </button>

          <div
            className="flex items-center space-x-3 mt-4 p-3 bg-accent rounded-lg cursor-pointer hover:bg-accent/80 transition-colors duration-200 relative"
            onClick={() => setProfileDropdownOpen(!isProfileDropdownOpen)}
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                {walletAddress ? `Wallet Connected` : `Not Connected`}
              </p>
              <p className="text-xs font-bold text-muted-foreground truncate">
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : `Connect your wallet`}
              </p>
            </div>

            {/* Profile Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="absolute -top-16 left-full ml-2 transform -translate-y-1/2 bg-white rounded-lg shadow-xl border border-border z-50 min-w-48">
                <div className="p-2 space-y-1">
                  <div className="px-3 py-2 text-sm font-medium text-foreground border-b border-border">
                    My Account
                  </div>
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded flex items-center space-x-2 relative"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setProfileInfoOpen(true);
                    }}
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to clear all your data? This will remove all stored files and cannot be undone."
                        )
                      ) {
                        clearAllUserData();
                        setProfileDropdownOpen(false);
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded flex items-center space-x-2"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span>Clear All Data</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center space-x-2"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}

            {/* Profile Info Dropdown - Independent */}
            {isProfileInfoOpen && (
              <div className="absolute -top-16 left-full ml-2 transform -translate-y-1/2 bg-white rounded-lg shadow-xl border border-border z-50 min-w-64">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center space-x-3 pb-3 border-b border-border">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">
                        {walletAddress ? "Wallet Connected" : "Not Connected"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {walletAddress ? walletAddress : "No wallet connected"}
                      </p>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Status
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          walletAddress ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {walletAddress ? "Connected" : "Disconnected"}
                      </span>
                    </div>

                    {walletAddress && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          Wallet Address
                        </span>
                        <span className="text-xs font-mono text-foreground">
                          {walletAddress.slice(0, 8)}...
                          {walletAddress.slice(-6)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Files Uploaded
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {files.length}
                      </span>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setProfileInfoOpen(false)}
                    className="w-full text-xs text-center text-muted-foreground hover:text-foreground py-1 border-t border-border"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-6 border-b border-border bg-white">
          <h1 className="text-2xl font-bold text-foreground transition-all duration-300 ease-in-out transform hover:scale-105">
            {activeSection === "dashboard" && "Dashboard"}
            {activeSection === "files" && "My Files"}
            {activeSection === "shared" && "Shared With Me"}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex space-x-2">
              <Button
                onClick={() => setUploadOpen(true)}
                className="btn-3d btn-3d-primary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <Button
                onClick={() => setDecryptOpen(true)}
                variant="outline"
                className="btn-3d btn-3d-secondary"
              >
                <Lock className="mr-2 h-4 w-4" />
                Decrypt File
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <div className="transition-all duration-500 ease-in-out">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600">Loading your files...</p>
                </div>
              </div>
            ) : (
              <>
                {activeSection === "files" && (
                  <div className="animate-in slide-in-from-left-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Your Files
                      </h2>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await refreshFilesFromIPFS();
                          await refreshSharedCounts();
                        }}
                        disabled={isRefreshing || isLoadingSharedCounts}
                        className="btn-3d btn-3d-secondary"
                      >
                        {isRefreshing || isLoadingSharedCounts ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            {isRefreshing
                              ? "Refreshing..."
                              : "Updating shares..."}
                          </>
                        ) : (
                          "Refresh Files"
                        )}
                      </Button>
                    </div>
                    {ipfsError && (
                      <div
                        className="bg-red-100 border border-red-200 text-red-800 px-4 py-3 rounded relative mb-4"
                        role="alert"
                      >
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline"> {ipfsError}</span>
                      </div>
                    )}
                    <FileList
                      files={files}
                      onAction={handleAction}
                      deletingFile={deletingFile}
                    />
                  </div>
                )}
                {activeSection === "dashboard" && (
                  <div className="animate-in slide-in-from-right-4 duration-500">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Welcome to BlockShare
                      </h2>
                      <p className="text-gray-600">
                        Your secure blockchain-powered file management system
                      </p>
                    </div>

                    {/* Dashboard Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                      <div className="card-3d card-3d-icon bg-white p-6 rounded-lg border shadow-sm">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <svg
                              className="w-6 h-6 text-blue-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">
                              Total Files
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {files.length}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="card-3d card-3d-icon bg-white p-6 rounded-lg border shadow-sm">
                        <div className="flex items-center">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <svg
                              className="w-6 h-6 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">
                              IPFS Files
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {files.filter((f) => f.cid).length}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="card-3d card-3d-icon bg-white p-6 rounded-lg border shadow-sm">
                        <div className="flex items-center">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <svg
                              className="w-6 h-6 text-purple-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">
                              Blockchain Files
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {files.filter((f) => f.cid).length}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="card-3d card-3d-icon bg-white p-6 rounded-lg border shadow-sm">
                        <div className="flex items-center">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <svg
                              className="w-6 h-6 text-yellow-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h6a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                              />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">
                              Storage Used
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {(
                                files.reduce(
                                  (acc, file) => acc + file.size,
                                  0
                                ) /
                                (1024 * 1024)
                              ).toFixed(1)}
                              MB
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Files Section */}
                    <div className="bg-white rounded-lg border shadow-sm">
                      <div className="p-6 border-b border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900">
                          Recent Files
                        </h3>
                        <p className="text-sm text-gray-600">
                          Your most recently uploaded files
                        </p>
                      </div>

                      {files.length > 0 ? (
                        <div className="p-6">
                          <FileList
                            files={files.slice(0, 3)}
                            onAction={handleAction}
                            deletingFile={deletingFile}
                          />
                        </div>
                      ) : (
                        <div className="p-12 text-center">
                          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <svg
                              className="w-8 h-8 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No files yet
                          </h3>
                          <p className="text-gray-600 mb-4">
                            Get started by uploading your first file
                          </p>
                          <Button
                            onClick={() => setUploadOpen(true)}
                            className="btn-3d btn-3d-primary"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Upload Your First File
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeSection === "shared" && (
                  <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Shared With Me
                      </h2>
                      <Button
                        variant="outline"
                        onClick={() => setWalletAddress((prev) => prev)}
                        disabled={isLoadingShared}
                        className="btn-3d btn-3d-secondary"
                      >
                        {isLoadingShared ? "Refreshing..." : "Refresh"}
                      </Button>
                    </div>
                    {isLoadingShared ? (
                      <div className="flex items-center justify-center h-40 text-muted-foreground">
                        Loading shared files...
                      </div>
                    ) : sharedFiles.length > 0 ? (
                      <FileList
                        files={sharedFiles}
                        onAction={handleAction}
                        deletingFile={deletingFile}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        Files shared with you will appear here.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <FileUploadDialog
        isOpen={isUploadOpen}
        setIsOpen={setUploadOpen}
        onFileUploaded={handleAddNewFile}
        userId={walletAddress || "demo-user"}
        walletAddress={walletAddress || undefined}
      />

      <EnhancedDownloadDialog
        isOpen={isDecryptOpen}
        setIsOpen={setDecryptOpen}
        userAddress={walletAddress || ""}
        metadataCID={activeSection === "shared" ? selectedFile?.cid : ""}
        fileCID={activeSection === "files" ? selectedFile?.cid || "" : ""}
        fileName={selectedFile?.name || ""}
      />

      {selectedFile && (
        <>
          <ShareDialog
            isOpen={isShareOpen}
            setIsOpen={(open) => {
              setShareOpen(open);
              if (!open) {
                // Dialog closed, refresh shared counts
                refreshSharedCounts();
              }
            }}
            file={selectedFile}
          />
          <PermissionsDialog
            isOpen={isPermissionsOpen}
            setIsOpen={setPermissionsOpen}
            file={selectedFile}
          />
          <VersionHistorySheet
            isOpen={isVersionsOpen}
            setIsOpen={setVersionsOpen}
            file={selectedFile}
          />
        </>
      )}

      {/* Logout Confirmation Popup */}
      {isLogoutOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-80 max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">
                Confirm Logout
              </h2>
              <button
                onClick={() => setLogoutOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Confirmation Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-foreground">Are you sure?</p>
                  <p className="text-sm text-muted-foreground">
                    You will be logged out and redirected to the login page.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setLogoutOpen(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardClient />;
}
