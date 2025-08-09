"use client";

import React from "react";
import { AppFile, formatFileSize, formatDate } from "@/lib/data";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History, Download, Clock, FileText } from "lucide-react";

interface VersionHistorySheetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  file: AppFile;
}

export function VersionHistorySheet({
  isOpen,
  setIsOpen,
  file,
}: VersionHistorySheetProps) {
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
              {file.versions.length} versions • {formatFileSize(file.size)}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {file.versions.map((version, index) => (
            <div
              key={version.id}
              className={`p-4 border rounded-lg ${
                index === 0 ? "border-blue-200 bg-blue-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <History className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">Version {version.version}</span>
                  {index === 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {formatFileSize(version.size)}
                  </span>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
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
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="text-sm text-gray-600 mb-3">
            Version history helps you track changes and restore previous
            versions of your files.
          </div>
          <div className="space-y-2">
            <Button variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download all versions
            </Button>
            <Button variant="outline" className="w-full">
              <History className="h-4 w-4 mr-2" />
              Compare versions
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
