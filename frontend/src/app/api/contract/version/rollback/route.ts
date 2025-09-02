import { NextRequest, NextResponse } from "next/server";
import { getWriteContract, getPublic, getReadContract } from "@/lib/contract";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { fileId, versionIndex, userAddress } = body as {
      fileId?: number;
      versionIndex?: number;
      userAddress?: string;
    };

    if (!fileId || versionIndex === undefined || !userAddress) {
      return NextResponse.json(
        {
          error: "Missing required fields: fileId, versionIndex, userAddress",
        },
        { status: 400 }
      );
    }

    if (fileId <= 0 || versionIndex < 0) {
      return NextResponse.json(
        {
          error: "Invalid fileId or versionIndex",
        },
        { status: 400 }
      );
    }

    try {
      const write = getWriteContract();

      // Perform rollback operation
      const txHash = await write.write.rollbackFile([
        BigInt(fileId),
        BigInt(versionIndex),
      ]);

      // Wait for confirmation
      const publicClient = getPublic();
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      // Get updated file info after rollback
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

      return NextResponse.json({
        success: true,
        txHash,
        blockNumber: Number(receipt.blockNumber),
        fileId: fileId,
        versionIndex: versionIndex,
        rolledBackTo: {
          metadataCID: fileInfo[6],
          fileHash: fileInfo[0],
          fileSize: Number(fileInfo[2]),
          timestamp: Number(fileInfo[4]),
        },
        message: `Successfully rolled back to version ${versionIndex + 1}`,
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
