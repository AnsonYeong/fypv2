import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface IPFSFileResponse {
  cid: string;
  gatewayUrl: string;
  size: number;
  type: string;
  name?: string;
  lastModified?: Date;
  encrypted?: boolean;
  originalSize?: number;
}

interface DecryptRequest {
  cid: string;
  key: string;
  iv: string;
  filename?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get("cid");

    if (!cid) {
      return NextResponse.json(
        { error: "CID parameter is required" },
        { status: 400 }
      );
    }

    // Try to fetch file from Pinata IPFS gateway
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
      method: "HEAD", // Use HEAD request to get metadata without downloading content
      headers: {
        "User-Agent": "BlockShare/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "File not found on IPFS",
          details: response.statusText,
          status: response.status,
        },
        { status: 404 }
      );
    }

    // Extract file metadata from response headers
    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type");
    const lastModified = response.headers.get("last-modified");
    const contentDisposition = response.headers.get("content-disposition");

    // Try to extract filename from content-disposition header
    let filename = "";
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Check if file appears to be encrypted (has .encrypted extension)
    const isEncrypted =
      filename.includes(".encrypted") ||
      contentType === "application/octet-stream";

    // If this is a JSON file (likely metadata), download and parse it
    if (contentType && contentType.includes("json")) {
      console.log("📋 Detected JSON file, downloading and parsing content...");

      // Download the actual JSON content
      const contentResponse = await fetch(
        `https://gateway.pinata.cloud/ipfs/${cid}`,
        {
          method: "GET",
          headers: {
            "User-Agent": "BlockShare/1.0",
          },
        }
      );

      if (!contentResponse.ok) {
        throw new Error(
          `Failed to download JSON content: ${contentResponse.statusText}`
        );
      }

      const jsonContent = await contentResponse.json();
      console.log("✅ JSON content parsed successfully");

      // Return the parsed JSON content instead of just metadata
      return NextResponse.json(jsonContent);
    }

    // For non-JSON files, return the metadata structure
    const fileData: IPFSFileResponse = {
      cid,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
      size: contentLength ? parseInt(contentLength) : 0,
      type: contentType ? contentType.split("/")[1] || "unknown" : "unknown",
      name: filename || `file-${cid.slice(0, 8)}`,
      lastModified: lastModified ? new Date(lastModified) : new Date(),
      encrypted: isEncrypted,
    };

    return NextResponse.json(fileData);
  } catch (error) {
    console.error("Error retrieving file from IPFS:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve file from IPFS",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST method to decrypt and retrieve encrypted files
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a decryption request
    if (body.key && body.iv && body.cid) {
      return await handleDecryption(body);
    }

    // Check if this is a multiple files request
    if (body.cids) {
      return await handleMultipleFiles(body.cids);
    }

    return NextResponse.json(
      {
        error:
          "Invalid request. Either provide 'key', 'iv', 'cid' for decryption or 'cids' array for multiple files",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in POST request:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle decryption of encrypted files
async function handleDecryption(request: DecryptRequest) {
  try {
    const { cid, key, iv, filename } = request;

    console.log(
      "Decrypting file:",
      cid,
      "with key length:",
      key.length,
      "IV length:",
      iv.length
    );

    // Download the encrypted file from IPFS
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
      method: "GET",
      headers: {
        "User-Agent": "BlockShare/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Failed to download encrypted file from IPFS",
          details: response.statusText,
          status: response.status,
        },
        { status: 404 }
      );
    }

    // Get the encrypted file as array buffer
    const encryptedBuffer = await response.arrayBuffer();
    console.log("Downloaded encrypted file, size:", encryptedBuffer.byteLength);

    // Convert hex strings back to Uint8Arrays
    const keyBytes = new Uint8Array(
      key.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const ivBytes = new Uint8Array(
      iv.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    console.log(
      "Converted key bytes:",
      keyBytes.length,
      "IV bytes:",
      ivBytes.length
    );

    // Import the encryption key
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    console.log("Crypto key imported successfully");

    // Decrypt the file
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      cryptoKey,
      encryptedBuffer
    );
    console.log(
      "File decrypted successfully, size:",
      decryptedBuffer.byteLength
    );

    // Convert to base64 for transmission - handle binary files properly
    let decryptedBase64: string;
    try {
      // For text files, try the string conversion first
      decryptedBase64 = btoa(
        String.fromCharCode(...new Uint8Array(decryptedBuffer))
      );
    } catch (error) {
      // For binary files (like PDFs), use a more robust approach
      const bytes = new Uint8Array(decryptedBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      decryptedBase64 = btoa(binary);
    }

    // Determine original filename (remove .encrypted extension)
    let originalFilename = filename;

    // If no filename provided, try to extract from CID or use a default
    if (!originalFilename) {
      // Check if the CID might contain the original filename
      if (cid.includes(".")) {
        originalFilename = cid.split(".").pop() || "decrypted-file";
      } else {
        // Use a more descriptive default name
        originalFilename = `decrypted-file-${cid.slice(0, 8)}`;
      }
    }

    const cleanFilename = originalFilename.replace(/\.encrypted$/, "");

    // Add better logging for debugging
    console.log("Final filename:", cleanFilename);
    console.log("Decrypted data length:", decryptedBase64.length);

    return NextResponse.json({
      success: true,
      cid,
      filename: cleanFilename,
      decryptedSize: decryptedBuffer.byteLength,
      encryptedSize: encryptedBuffer.byteLength,
      decryptedData: decryptedBase64,
      message: "File decrypted successfully",
    });
  } catch (error) {
    console.error("Decryption error:", error);
    return NextResponse.json(
      {
        error: "File decryption failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle multiple files retrieval (existing functionality)
async function handleMultipleFiles(cids: string[]) {
  try {
    if (!Array.isArray(cids) || cids.length === 0) {
      return NextResponse.json(
        { error: "cids array is required" },
        { status: 400 }
      );
    }

    // Retrieve multiple files concurrently
    const filePromises = cids.map(async (cid: string) => {
      try {
        const response = await fetch(
          `https://gateway.pinata.cloud/ipfs/${cid}`,
          {
            method: "HEAD",
            headers: {
              "User-Agent": "BlockShare/1.0",
            },
          }
        );

        if (!response.ok) {
          return {
            cid,
            error: `File not found: ${response.statusText}`,
            status: response.status,
          };
        }

        const contentLength = response.headers.get("content-length");
        const contentType = response.headers.get("content-type");
        const lastModified = response.headers.get("last-modified");

        return {
          cid,
          gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
          size: contentLength ? parseInt(contentLength) : 0,
          type: contentType
            ? contentType.split("/")[1] || "unknown"
            : "unknown",
          lastModified: lastModified ? new Date(lastModified) : new Date(),
        };
      } catch (error) {
        return {
          cid,
          error: `Failed to retrieve: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    });

    const results = await Promise.all(filePromises);

    return NextResponse.json({
      files: results,
      total: results.length,
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
    });
  } catch (error) {
    console.error("Error retrieving multiple files from IPFS:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve files from IPFS",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/*
Example usage of the decryption API:

POST /api/ipfs/retrieve
{
  "cid": "your-encrypted-file-cid",
  "key": "your-encryption-key-hex", 
  "iv": "your-iv-hex",
  "filename": "optional-original-filename"
}

Response:
{
  "success": true,
  "cid": "your-file-cid",
  "filename": "original-filename",
  "decryptedSize": 1234,
  "encryptedSize": 1234,
  "decryptedData": "base64-encoded-file-content",
  "message": "File decrypted successfully"
}
*/
