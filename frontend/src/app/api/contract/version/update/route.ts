import { NextRequest, NextResponse } from "next/server";
import { getWriteContract, getPublic, getReadContract } from "@/lib/contract";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { fileId, newFileHash, newFileSize, newMetadataCID, userAddress } =
      body as {
        fileId?: number;
        newFileHash?: string;
        newFileSize?: number;
        newMetadataCID?: string;
        userAddress?: string;
      };

    if (
      !fileId ||
      !newFileHash ||
      !newFileSize ||
      !newMetadataCID ||
      !userAddress
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: fileId, newFileHash, newFileSize, newMetadataCID, userAddress",
        },
        { status: 400 }
      );
    }

    if (fileId <= 0 || newFileSize <= 0) {
      return NextResponse.json(
        {
          error: "Invalid fileId or newFileSize",
        },
        { status: 400 }
      );
    }

    try {
      const write = getWriteContract();

      // Update file (creates new version)
      const txHash = await write.write.updateFile([
        BigInt(fileId),
        newFileHash,
        BigInt(newFileSize),
        newMetadataCID,
      ]);

      // Wait for confirmation
      const publicClient = getPublic();
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      // Get updated file info after update
      const read = getReadContract();
      const fileInfo = (await read.read.getFileInfo([BigInt(fileId)])) as [
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

      // Get version history
      const versions = (await read.read.getFileVersions([
        BigInt(fileId),
      ])) as string[];

      return NextResponse.json({
        success: true,
        txHash,
        blockNumber: Number(receipt.blockNumber),
        fileId: fileId,
        updatedFile: {
          fileHash: fileInfo[0],
          fileName: fileInfo[1],
          fileSize: Number(fileInfo[2]),
          uploader: fileInfo[3],
          timestamp: Number(fileInfo[4]),
          isActive: fileInfo[5],
          metadataCID: fileInfo[6],
          isEncrypted: fileInfo[7],
          masterKeyHash: fileInfo[8],
          versionCount: Number(fileInfo[9]),
        },
        versions: versions,
        message: `Successfully updated file to version ${Number(fileInfo[9])}`,
        timestamp: new Date().toISOString(),
      });
    } catch (inner) {
      return NextResponse.json(
        {
          success: false,
          error: inner instanceof Error ? inner.message : String(inner),
        },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
