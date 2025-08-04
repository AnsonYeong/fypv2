"use client";

import React, { useState } from "react";
import { AppFile, mockFiles } from "@/lib/data";
import { FileList } from "./file-list";
import { FileUploadDialog } from "./file-upload-dialog";
import { ShareDialog } from "./share-dialog";
import { PermissionsDialog } from "./permissions-dialog";
import { VersionHistorySheet } from "./version-history-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Home,
  Folder,
  Users,
  Settings,
  User,
} from "lucide-react";

export function DashboardClient() {
  const [files, setFiles] = useState<AppFile[]>(mockFiles);
  const [selectedFile, setSelectedFile] = useState<AppFile | null>(null);
  const [activeSection, setActiveSection] = useState("files");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isShareOpen, setShareOpen] = useState(false);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);
  const [isVersionsOpen, setVersionsOpen] = useState(false);
  const [isProfileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isProfileInfoOpen, setProfileInfoOpen] = useState(false);
  const [isLogoutOpen, setLogoutOpen] = useState(false);

  // Get wallet address from localStorage or session
  React.useEffect(() => {
    const storedAddress = localStorage.getItem("walletAddress");
    if (storedAddress) {
      setWalletAddress(storedAddress);
    }
  }, []);

  const handleAction = (action: string, file: AppFile) => {
    setSelectedFile(file);
    if (action === "share") setShareOpen(true);
    if (action === "permissions") setPermissionsOpen(true);
    if (action === "versions") setVersionsOpen(true);
    if (action === "delete") {
      setFiles(files.filter((f) => f.id !== file.id));
    }
  };

  const handleAddNewFile = (newFile: AppFile) => {
    setFiles([newFile, ...files]);
  };

  const handleLogout = () => {
    setProfileDropdownOpen(false);
    setLogoutOpen(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("walletAddress");
    setWalletAddress(null);
    setLogoutOpen(false);
    // Redirect to login page
    window.location.href = "/login";
  };

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
          <h1 className="text-2xl font-bold text-primary">BlockShare</h1>
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search files..."
                className="pl-10 w-80 bg-background"
              />
            </div>
            <Button
              onClick={() => setUploadOpen(true)}
              className="!bg-blue-600 hover:!bg-blue-700 text-white border-2 border-blue-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Upload File
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <div className="transition-all duration-500 ease-in-out">
            {activeSection === "files" && (
              <div className="animate-in slide-in-from-left-4 duration-500">
                <FileList files={files} onAction={handleAction} />
              </div>
            )}
            {activeSection === "dashboard" && (
              <div className="animate-in slide-in-from-right-4 duration-500 text-center text-muted-foreground">
                <h2 className="text-xl font-bold mb-2">
                  Welcome to BlockShare
                </h2>
                <p className="font-bold">
                  Your dashboard overview will appear here.
                </p>
              </div>
            )}
            {activeSection === "shared" && (
              <div className="animate-in slide-in-from-bottom-4 duration-500 text-center text-muted-foreground">
                <h2 className="text-xl font-bold mb-2">Shared With Me</h2>
                <p className="font-bold">
                  Files shared with you will appear here.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      <FileUploadDialog
        isOpen={isUploadOpen}
        setIsOpen={setUploadOpen}
        onFileUploaded={handleAddNewFile}
      />

      {selectedFile && (
        <>
          <ShareDialog
            isOpen={isShareOpen}
            setIsOpen={setShareOpen}
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
