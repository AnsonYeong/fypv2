import { NextRequest, NextResponse } from "next/server";

interface IPFSFileResponse {
  cid: string;
  gatewayUrl: string;
  size: number;
  type: string;
  name?: string;
  lastModified?: Date;
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

    const fileData: IPFSFileResponse = {
      cid,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
      size: contentLength ? parseInt(contentLength) : 0,
      type: contentType ? contentType.split("/")[1] || "unknown" : "unknown",
      name: filename || `file-${cid.slice(0, 8)}`,
      lastModified: lastModified ? new Date(lastModified) : new Date(),
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

// POST method to retrieve multiple files at once
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cids } = body;

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
