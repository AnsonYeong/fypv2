"use client";

import React, { useState } from "react";
import { AppFile } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";

interface FileUploadDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onFileUploaded: (file: AppFile) => void;
}

export function FileUploadDialog({
  isOpen,
  setIsOpen,
  onFileUploaded,
}: FileUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !fileName) return;
    try {
      setIsUploading(true);
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("name", fileName);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Upload failed: ${err.error || res.statusText}`);
        return;
      }

      const { cid, gatewayUrl } = await res.json();

      const newFile: AppFile = {
        id: Date.now().toString(),
        name: fileName,
        size: selectedFile.size,
        type: selectedFile.name.split(".").pop() || "unknown",
        lastModified: new Date(),
        owner: "Current User",
        sharedWith: [],
        permissions: "admin",
        versions: [
          {
            id: "v1",
            version: 1,
            timestamp: new Date(),
            size: selectedFile.size,
            changes: "Initial upload (pinned to IPFS)",
          },
        ],
        cid,
        gatewayUrl,
      };
      onFileUploaded(newFile);
      setIsOpen(false);
      setSelectedFile(null);
      setFileName("");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} setIsOpen={setIsOpen} title="Upload File">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">File Name</label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Enter file name..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Select File</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <input
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-blue-600 hover:text-blue-700 border-2 border-blue-500 rounded-md px-4 py-2 inline-block hover:bg-blue-50 transition-colors"
            >
              Choose a file
            </label>
            <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
          </div>
          {selectedFile && (
            <div className="mt-2 p-2 bg-gray-50 rounded flex items-center justify-between">
              <span className="text-sm">{selectedFile.name}</span>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !fileName || isUploading}
            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
          >
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
