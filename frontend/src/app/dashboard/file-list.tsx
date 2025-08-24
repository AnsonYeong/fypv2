"use client";

import React, { useState, useMemo } from "react";
import { AppFile, formatFileSize, formatDate } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Dock, { DockItemData } from "@/animation/dock";
import AnimatedList from "@/animation/animatedlist";
import "@/Dock.css";
import "@/AnimatedList.css";
import {
  MoreHorizontal,
  Download,
  Share,
  Settings,
  History,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";

interface FileListProps {
  files: AppFile[];
  onAction: (action: string, file: AppFile) => void;
  deletingFile?: string | null;
}

export function FileList({ files, onAction, deletingFile }: FileListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;

    const query = searchQuery.toLowerCase();
    return files.filter((file) => {
      return (
        file.name.toLowerCase().includes(query) ||
        file.type.toLowerCase().includes(query) ||
        file.owner.toLowerCase().includes(query) ||
        (file.encrypted ? "encrypted" : "plain").includes(query) ||
        formatFileSize(file.size).toLowerCase().includes(query)
      );
    });
  }, [files, searchQuery]);

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "pdf":
        return "📄";
      case "docx":
        return "📝";
      case "sketch":
        return "🎨";
      case "png":
        return "🖼️";
      default:
        return "📁";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Search files by name, type, owner, or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-2 w-full border border-black focus:ring-blue-500 focus:border-blue-500"
        />
        {searchQuery && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={() => setSearchQuery("")}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-gray-600">
          Found {filteredFiles.length} file
          {filteredFiles.length !== 1 ? "s" : ""} matching "{searchQuery}"
        </div>
      )}

      <div className="rounded-lg border">
        <div className="grid grid-cols-12 gap-4 p-4 font-bold text-sm text-black border-b">
          <div className="col-span-4">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2 text-center pr-8">Status</div>
          <div className="col-span-2 text-center pr-20">Actions</div>
        </div>
        <AnimatedList
          items={filteredFiles.map((file) => file.name)}
          onItemSelect={(itemName, index) => {
            const file = filteredFiles[index];
            if (file) {
              // You can add any selection logic here
              console.log("Selected file:", file);
            }
          }}
          showGradients={true}
          enableArrowNavigation={true}
          displayScrollbar={true}
          className="!w-full !max-w-none"
          itemClassName="!bg-transparent !p-0 !m-0 !border-0"
          renderItem={(itemName, index) => {
            const file = files[index];
            const isDeleting = deletingFile === file.id;

            return (
              <div
                className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 border-b last:border-b-0 transition-all duration-200 ${
                  isDeleting ? "bg-red-50 opacity-75" : ""
                }`}
              >
                <div className="col-span-4 flex items-center space-x-2">
                  <span className="text-2xl">{getFileIcon(file.type)}</span>
                  <div>
                    <div className="font-medium text-blue-700 flex items-center space-x-2">
                      <span>{file.name}</span>
                      {file.encrypted && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          🔐 Encrypted
                        </span>
                      )}
                      {isDeleting && (
                        <div className="flex items-center space-x-1 text-xs text-red-600">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Deleting...</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {file.owner} • {file.sharedWith.length} shared
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-green-600 font-medium">
                  {formatFileSize(file.size)}
                </div>
                <div className="col-span-2 text-sm text-red-600 font-medium">
                  {formatDate(file.lastModified)}
                </div>
                <div className="col-span-2 flex items-center justify-center">
                  {file.encrypted ? (
                    <div className="flex flex-col items-center space-y-1 text-xs">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-green-700 font-medium text-center">
                        🔐 Encrypted
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-1 text-xs">
                      <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                      <span className="text-gray-500 text-center">
                        📄 Plain
                      </span>
                    </div>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-end pr-8">
                  <Dock
                    items={[
                      {
                        icon: <Download className="h-5 w-5 text-yellow-600" />,
                        label: "Download",
                        onClick: () => onAction("download", file),
                        className: isDeleting
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      },
                      {
                        icon: <Share className="h-5 w-5 text-yellow-600" />,
                        label: "Share",
                        onClick: () => onAction("share", file),
                        className: isDeleting
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      },
                      {
                        icon: <Settings className="h-5 w-5 text-yellow-600" />,
                        label: "Permissions",
                        onClick: () => onAction("permissions", file),
                        className: isDeleting
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      },
                      {
                        icon: <History className="h-5 w-5 text-yellow-600" />,
                        label: "Versions",
                        onClick: () => onAction("versions", file),
                        className: isDeleting
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      },
                      {
                        icon: isDeleting ? (
                          <Loader2 className="h-5 w-5 animate-spin text-red-600" />
                        ) : (
                          <Trash2 className="h-5 w-5 text-red-600" />
                        ),
                        label: "Delete",
                        onClick: () => onAction("delete", file),
                        className: isDeleting
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      },
                    ]}
                    className="!relative !bottom-auto !left-auto !transform-none"
                    distance={150}
                    magnification={60}
                    baseItemSize={40}
                    dockHeight={60}
                    panelHeight={50}
                  />
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
