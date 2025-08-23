"use client";

import React from "react";
import { AppFile, formatFileSize, formatDate } from "@/lib/data";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

interface FileListProps {
  files: AppFile[];
  onAction: (action: string, file: AppFile) => void;
  deletingFile?: string | null;
}

export function FileList({ files, onAction, deletingFile }: FileListProps) {
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
      <div className="rounded-lg border">
        <div className="grid grid-cols-12 gap-4 p-4 font-bold text-sm text-black border-b">
          <div className="col-span-6">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2 text-center pr-20">Actions</div>
        </div>
        <AnimatedList
          items={files.map((file) => file.name)}
          onItemSelect={(itemName, index) => {
            const file = files[index];
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
                <div className="col-span-6 flex items-center space-x-2">
                  <span className="text-2xl">{getFileIcon(file.type)}</span>
                  <div>
                    <div className="font-medium text-blue-700 flex items-center space-x-2">
                      <span>{file.name}</span>
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
