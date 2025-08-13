"use client";

import React from "react";
import { AppFile, formatFileSize, formatDate } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Download,
  Share,
  Settings,
  History,
  Trash2,
} from "lucide-react";

interface FileListProps {
  files: AppFile[];
  onAction: (action: string, file: AppFile) => void;
}

export function FileList({ files, onAction }: FileListProps) {
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "pdf":
        return "📄";
      case "docx":
        return "📝";
      case "sketch":
        return "🎨";
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
          <div className="col-span-2">Actions</div>
        </div>
        {files.map((file) => (
          <div
            key={file.id}
            className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 border-b last:border-b-0"
          >
            <div className="col-span-6 flex items-center space-x-2">
              <span className="text-2xl">{getFileIcon(file.type)}</span>
              <div>
                <div className="font-medium text-blue-700">{file.name}</div>
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
            <div className="col-span-2 flex items-center space-x-0.5 justify-start pl-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction("download", file)}
                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 p-1"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction("share", file)}
                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 p-1"
              >
                <Share className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction("permissions", file)}
                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 p-1"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction("versions", file)}
                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 p-1"
              >
                <History className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction("delete", file)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
