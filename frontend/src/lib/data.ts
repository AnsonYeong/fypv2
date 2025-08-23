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
  cid?: string;
  gatewayUrl?: string;
}

export interface FileVersion {
  id: string;
  version: number;
  timestamp: Date;
  size: number;
  changes: string;
}

// Storage keys
const FILES_STORAGE_KEY = "blockshare_user_files";
const USER_ID_KEY = "blockshare_user_id";
const USER_FILES_PREFIX = "blockshare_files_user_";

// File storage and retrieval functions
export const saveFilesToStorage = (files: AppFile[], userId: string) => {
  try {
    const filesData = files.map((file) => ({
      ...file,
      lastModified: file.lastModified.toISOString(),
      versions: file.versions.map((version) => ({
        ...version,
        timestamp: version.timestamp.toISOString(),
      })),
    }));

    // Store files per user
    localStorage.setItem(
      `${USER_FILES_PREFIX}${userId}`,
      JSON.stringify(filesData)
    );
    localStorage.setItem(USER_ID_KEY, userId);
  } catch (error) {
    console.error("Error saving files to storage:", error);
  }
};

export const getFilesFromStorage = (userId?: string): AppFile[] => {
  try {
    const currentUserId = userId || localStorage.getItem(USER_ID_KEY);
    if (!currentUserId) return [];

    const filesData = localStorage.getItem(
      `${USER_FILES_PREFIX}${currentUserId}`
    );
    if (!filesData) return [];

    const parsedFiles = JSON.parse(filesData);
    return parsedFiles.map((file: any) => ({
      ...file,
      lastModified: new Date(file.lastModified),
      versions: file.versions.map((version: any) => ({
        ...version,
        timestamp: new Date(version.timestamp),
      })),
    }));
  } catch (error) {
    console.error("Error retrieving files from storage:", error);
    return [];
  }
};

export const clearFilesFromStorage = (userId?: string) => {
  try {
    const currentUserId = userId || localStorage.getItem(USER_ID_KEY);
    if (currentUserId) {
      localStorage.removeItem(`${USER_FILES_PREFIX}${currentUserId}`);
    }
    localStorage.removeItem(USER_ID_KEY);
  } catch (error) {
    console.error("Error clearing files from storage:", error);
  }
};

// Function to retrieve all files for a user from IPFS
export const retrieveUserFilesFromIPFS = async (
  userId: string
): Promise<AppFile[]> => {
  try {
    // Get stored files for the user
    const storedFiles = getFilesFromStorage(userId);

    // Filter files that have IPFS CIDs
    const ipfsFiles = storedFiles.filter((file) => file.cid);

    if (ipfsFiles.length === 0) {
      return storedFiles;
    }

    // Extract CIDs for batch retrieval
    const cids = ipfsFiles.map((file) => file.cid!);

    // Retrieve multiple files from IPFS via our API
    const ipfsResults = await retrieveMultipleFilesFromIPFS(cids);

    // Map IPFS results back to stored files and update metadata
    const verifiedFiles = ipfsFiles.map((file) => {
      const ipfsResult = ipfsResults.find((result) => result.cid === file.cid);

      if (ipfsResult && !("error" in ipfsResult)) {
        // Update file with latest IPFS metadata
        return {
          ...file,
          size: ipfsResult.size || file.size,
          type: ipfsResult.type || file.type,
          gatewayUrl: ipfsResult.gatewayUrl || file.gatewayUrl,
          lastModified: ipfsResult.lastModified || file.lastModified,
        };
      } else if (ipfsResult && "error" in ipfsResult) {
        console.warn(`File ${file.cid} has error:`, ipfsResult.error);
        // Keep file even if IPFS retrieval fails, but mark it
        return {
          ...file,
          // You could add an error flag here if needed
        };
      }

      return file; // Keep file as is if no IPFS result found
    });

    return verifiedFiles;
  } catch (error) {
    console.error("Error retrieving user files from IPFS:", error);
    return getFilesFromStorage(userId); // Fallback to stored files
  }
};

// Function to retrieve file metadata from IPFS via our API
export const retrieveFileFromIPFS = async (
  cid: string
): Promise<Partial<AppFile> | null> => {
  try {
    const response = await fetch(
      `/api/ipfs/retrieve?cid=${encodeURIComponent(cid)}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const fileData = await response.json();
    return {
      cid: fileData.cid,
      gatewayUrl: fileData.gatewayUrl,
      size: fileData.size,
      type: fileData.type,
      name: fileData.name,
      lastModified: fileData.lastModified
        ? new Date(fileData.lastModified)
        : new Date(),
    };
  } catch (error) {
    console.error("Error retrieving file from IPFS:", error);
    return null;
  }
};

// Function to retrieve multiple files from IPFS via our API
export const retrieveMultipleFilesFromIPFS = async (
  cids: string[]
): Promise<Array<Partial<AppFile> | { cid: string; error: string }>> => {
  try {
    const response = await fetch("/api/ipfs/retrieve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cids }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();
    return result.files.map((file: any) => {
      if (file.error) {
        return { cid: file.cid, error: file.error };
      }

      return {
        cid: file.cid,
        gatewayUrl: file.gatewayUrl,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
          ? new Date(file.lastModified)
          : new Date(),
      };
    });
  } catch (error) {
    console.error("Error retrieving multiple files from IPFS:", error);
    return cids.map((cid) => ({
      cid,
      error: error instanceof Error ? error.message : "Unknown error",
    }));
  }
};

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
