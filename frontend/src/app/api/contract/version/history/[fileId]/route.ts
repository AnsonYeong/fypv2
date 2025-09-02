import { NextRequest, NextResponse } from "next/server";
import { getReadContract } from "@/lib/contract";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId: fileIdStr } = await params;
    const fileId = parseInt(fileIdStr);

    if (isNaN(fileId) || fileId <= 0) {
      return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    try {
      const contract = getReadContract();

      // Get version history from blockchain
      const versions = (await contract.read.getFileVersions([
        BigInt(fileId),
      ])) as string[];

      // Get current file info
      const fileInfo = (await contract.read.getFileInfo([BigInt(fileId)])) as [
        string, // fileHash
        string, // fileName
        bigint, // fileSize
        string, // uploader
        bigint, // timestamp
        boolean, // isActive
        string, // metadataCID
        boolean, // isEncrypted
        string, // masterKeyHash
        bigint // versionCount
      ];

      return NextResponse.json({
        success: true,
        fileId: fileId,
        versions: versions,
        currentVersion: fileInfo[6], // metadataCID
        versionCount: Number(fileInfo[9]), // versionCount
        fileInfo: {
          fileName: fileInfo[1],
          fileSize: Number(fileInfo[2]),
          uploader: fileInfo[3],
          timestamp: Number(fileInfo[4]),
          isActive: fileInfo[5],
          isEncrypted: fileInfo[7],
        },
        message: "Version history retrieved successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (contractError) {
      console.error("Contract error:", contractError);
      return NextResponse.json(
        {
          success: false,
          error:
            contractError instanceof Error
              ? contractError.message
              : "Contract error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
