import { NextRequest, NextResponse } from "next/server";
import { retrieveMetadata } from "@/lib/metadata-upload";
import { verifyFileAccess } from "@/lib/metadata-upload";
import { getReadContract } from "@/lib/contract";

// Utility function to validate Ethereum address format
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Utility function to validate IPFS CID format
function isValidIPFSCID(cid: string): boolean {
  return (
    cid.startsWith("Qm") || cid.startsWith("bafy") || cid.startsWith("bafk")
  );
}

// Rate limiting helper (simple in-memory, consider Redis for production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(identifier);

  if (!userRequests || now > userRequests.resetTime) {
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return false;
  }

  if (userRequests.count >= RATE_LIMIT) {
    return true;
  }

  userRequests.count++;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { metadataCID, userAddress } = await request.json();

    // Validate input parameters
    if (!metadataCID) {
      return NextResponse.json(
        { error: "metadataCID is required" },
        { status: 400 }
      );
    }

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress is required" },
        { status: 400 }
      );
    }

    // Validate CID format
    if (!isValidIPFSCID(metadataCID)) {
      return NextResponse.json(
        { error: "Invalid IPFS CID format. Must start with Qm, bafy, or bafk" },
        { status: 400 }
      );
    }

    // Validate Ethereum address format
    if (!isValidEthereumAddress(userAddress)) {
      return NextResponse.json(
        { error: "Invalid Ethereum address format" },
        { status: 400 }
      );
    }

    // Rate limiting check
    if (isRateLimited(userAddress)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    try {
      // First, verify the user has access to this file (uses hashToFileId + hasReadAccess internally)
      const hasAccess = await verifyFileAccess(
        metadataCID,
        userAddress,
        "read"
      );

      if (!hasAccess) {
        return NextResponse.json(
          {
            error:
              "Access denied. You don't have permission to view this file.",
          },
          { status: 403 }
        );
      }

      // Retrieve metadata from IPFS
      const metadata = await retrieveMetadata(metadataCID);

      // Get additional blockchain information
      try {
        const contract = getReadContract();
        const fileIdBig = (await contract.read.metadataToFileId([
          metadataCID,
        ])) as bigint;

        if (fileIdBig !== BigInt(0)) {
          // Get file info from blockchain
          const fileInfo = (await contract.read.getFileInfo([
            fileIdBig,
          ])) as unknown as [
            string,
            string,
            bigint,
            string,
            bigint,
            boolean,
            string
          ];

          // Enhance metadata with blockchain data
          const enhancedMetadata = {
            ...metadata,
            blockchain: {
              ...metadata.blockchain,
              fileId: Number(fileIdBig),
              blockchainFileInfo: {
                fileHash: fileInfo[0],
                fileName: fileInfo[1],
                fileSize: Number(fileInfo[2]),
                uploader: fileInfo[3],
                timestamp: Number(fileInfo[4]),
                isActive: fileInfo[5],
                metadataCID: fileInfo[6],
              },
            },
          };

          return NextResponse.json({
            success: true,
            metadata: enhancedMetadata,
            message: "Metadata retrieved successfully",
            timestamp: new Date().toISOString(),
            fileId: Number(fileIdBig),
          });
        } else {
          // File exists in metadata but not on blockchain (edge case)
          return NextResponse.json({
            success: true,
            metadata: metadata,
            message:
              "Metadata retrieved successfully (blockchain verification failed)",
            warning: "File not found on blockchain",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (blockchainError) {
        console.error("Blockchain verification error:", blockchainError);

        // Return metadata even if blockchain verification fails
        return NextResponse.json({
          success: true,
          metadata: metadata,
          message: "Metadata retrieved successfully",
          warning: "Blockchain verification failed",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (metadataError) {
      console.error("Metadata retrieval error:", metadataError);

      if (metadataError instanceof Error) {
        if (metadataError.message.includes("Failed to retrieve metadata")) {
          return NextResponse.json(
            { error: "File not found on IPFS or invalid CID" },
            { status: 404 }
          );
        }
      }

      return NextResponse.json(
        { error: "Failed to retrieve metadata from IPFS" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Invalid request: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET method for retrieving metadata without access control (public metadata)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metadataCID = searchParams.get("cid");

    if (!metadataCID) {
      return NextResponse.json(
        { error: "metadataCID query parameter is required" },
        { status: 400 }
      );
    }

    // Validate CID format
    if (!isValidIPFSCID(metadataCID)) {
      return NextResponse.json(
        { error: "Invalid IPFS CID format. Must start with Qm, bafy, or bafk" },
        { status: 400 }
      );
    }

    // Rate limiting for public endpoint (use CID as identifier)
    if (isRateLimited(`public_${metadataCID}`)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    try {
      // Retrieve metadata from IPFS (public access)
      const metadata = await retrieveMetadata(metadataCID);

      // Return only public information (no sensitive data)
      const publicMetadata = {
        version: metadata.version,
        fileInfo: {
          originalName: metadata.fileInfo.originalName,
          originalSize: metadata.fileInfo.originalSize,
          encryptedSize: metadata.fileInfo.encryptedSize,
          mimeType: metadata.fileInfo.mimeType,
          uploadDate: metadata.fileInfo.uploadDate,
          lastModified: metadata.fileInfo.lastModified,
        },
        encryption: {
          algorithm: metadata.encryption.algorithm,
          // Don't expose wrapped key, IV, salt, or iterations
        },
        ipfs: {
          fileCID: metadata.ipfs.fileCID,
          gateway: metadata.ipfs.gateway,
        },
        blockchain: {
          contractAddress: metadata.blockchain.contractAddress,
          timestamp: metadata.blockchain.timestamp,
          // Don't expose uploader address
        },
        access: {
          // Don't expose owner or shared users
          permissions: metadata.access.permissions,
        },
        integrity: {
          // Don't expose hashes
        },
      };

      return NextResponse.json({
        success: true,
        metadata: publicMetadata,
        message: "Public metadata retrieved successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (metadataError) {
      console.error("Metadata retrieval error:", metadataError);

      if (metadataError instanceof Error) {
        if (metadataError.message.includes("Failed to retrieve metadata")) {
          return NextResponse.json(
            { error: "File not found on IPFS or invalid CID" },
            { status: 404 }
          );
        }
      }

      return NextResponse.json(
        { error: "Failed to retrieve metadata from IPFS" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Invalid request: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
