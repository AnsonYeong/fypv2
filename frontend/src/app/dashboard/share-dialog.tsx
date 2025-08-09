"use client";

import React, { useState } from "react";
import { AppFile } from "@/lib/data";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Mail, Copy } from "lucide-react";

interface ShareDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  file: AppFile;
}

export function ShareDialog({ isOpen, setIsOpen, file }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");

  const handleShare = () => {
    if (email) {
      // In a real app, this would send an invitation
      console.log(
        `Sharing ${file.name} with ${email} (${permission} permission)`
      );
      setEmail("");
      setIsOpen(false);
    }
  };

  const generateShareLink = () => {
    const link = `${window.location.origin}/share/${file.id}`;
    navigator.clipboard.writeText(link);
    // You could add a toast notification here
  };

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={`Share "${file.name}"`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Email address
          </label>
          <div className="flex space-x-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address..."
            />
            <Button onClick={handleShare} disabled={!email}>
              <UserPlus className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Permission</label>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as "read" | "write")}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="read">Can view</option>
            <option value="write">Can edit</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <label className="block text-sm font-medium mb-2">Share link</label>
          <div className="flex space-x-2">
            <Input
              value={`${window.location.origin}/share/${file.id}`}
              readOnly
            />
            <Button variant="outline" onClick={generateShareLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
        </div>

        {file.sharedWith.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Currently shared with
            </label>
            <div className="space-y-2">
              {file.sharedWith.map((user, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{user}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-600">
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
