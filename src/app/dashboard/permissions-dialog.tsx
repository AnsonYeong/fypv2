"use client";

import React, { useState } from "react";
import { AppFile } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, User, Lock, Unlock } from "lucide-react";

interface PermissionsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  file: AppFile;
}

export function PermissionsDialog({
  isOpen,
  setIsOpen,
  file,
}: PermissionsDialogProps) {
  const [permission, setPermission] = useState(file.permissions);

  const handleSave = () => {
    // In a real app, this would update the file permissions
    console.log(`Updated permissions for ${file.name} to ${permission}`);
    setIsOpen(false);
  };

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={`Permissions for "${file.name}"`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Current Permission Level
          </label>
          <select
            value={permission}
            onChange={(e) =>
              setPermission(e.target.value as "read" | "write" | "admin")
            }
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="read">Read only</option>
            <option value="write">Read & Write</option>
            <option value="admin">Full access</option>
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-medium">Owner</div>
              <div className="text-sm text-gray-600">{file.owner}</div>
            </div>
            <div className="ml-auto">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                Admin
              </span>
            </div>
          </div>

          {file.sharedWith.map((user, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-3 bg-gray-50 rounded"
            >
              <User className="h-5 w-5 text-gray-600" />
              <div>
                <div className="font-medium">{user}</div>
                <div className="text-sm text-gray-600">Shared user</div>
              </div>
              <div className="ml-auto">
                <select className="px-2 py-1 text-xs border rounded">
                  <option value="read">Read</option>
                  <option value="write">Write</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center space-x-2 mb-2">
            <Lock className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">Advanced Settings</span>
          </div>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input type="checkbox" className="rounded" />
              <span className="text-sm">Require password for access</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" className="rounded" />
              <span className="text-sm">Allow public access</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" className="rounded" />
              <span className="text-sm">Track access logs</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </Dialog>
  );
}
