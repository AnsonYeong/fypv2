export interface AppFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  owner: string;
  sharedWith: string[];
  permissions: "read" | "write" | "admin";
  versions: FileVersion[];
}

export interface FileVersion {
  id: string;
  version: number;
  timestamp: Date;
  size: number;
  changes: string;
}

export const mockFiles: AppFile[] = [
  {
    id: "1",
    name: "Project Proposal.pdf",
    size: 2048576,
    type: "pdf",
    lastModified: new Date("2024-01-15"),
    owner: "John Doe",
    sharedWith: ["Jane Smith", "Bob Johnson"],
    permissions: "read",
    versions: [
      {
        id: "v1",
        version: 1,
        timestamp: new Date("2024-01-10"),
        size: 1024000,
        changes: "Initial version",
      },
      {
        id: "v2",
        version: 2,
        timestamp: new Date("2024-01-15"),
        size: 2048576,
        changes: "Updated budget section",
      },
    ],
  },
  {
    id: "2",
    name: "Design Mockups.sketch",
    size: 15728640,
    type: "sketch",
    lastModified: new Date("2024-01-12"),
    owner: "Jane Smith",
    sharedWith: ["John Doe"],
    permissions: "write",
    versions: [
      {
        id: "v1",
        version: 1,
        timestamp: new Date("2024-01-12"),
        size: 15728640,
        changes: "Initial design",
      },
    ],
  },
  {
    id: "3",
    name: "Meeting Notes.docx",
    size: 512000,
    type: "docx",
    lastModified: new Date("2024-01-14"),
    owner: "Bob Johnson",
    sharedWith: [],
    permissions: "admin",
    versions: [
      {
        id: "v1",
        version: 1,
        timestamp: new Date("2024-01-14"),
        size: 512000,
        changes: "Initial notes",
      },
    ],
  },
];

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
