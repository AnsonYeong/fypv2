import { NextRequest, NextResponse } from "next/server";
import { getWriteContract, getReadContract, getPublic } from "@/lib/contract";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { fileHash, fileName, fileSize, metadataCID, uploaderAddress } =
      body as {
        fileHash?: string;
        fileName?: string;
        fileSize?: number;
        metadataCID?: string;
        uploaderAddress?: string;
      };

    if (!fileHash || !fileName || !fileSize || !metadataCID) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: fileHash, fileName, fileSize, metadataCID",
        },
        { status: 400 }
      );
    }

    try {
      const write = getWriteContract();
      // Store metadataCID as the on-chain hash to keep a direct mapping
      const txHash = await (write as any).write.uploadFileHash([
        metadataCID, // _fileHash
        fileName, // _fileName
        BigInt(fileSize), // _fileSize
        metadataCID, // _metadataCID
        false, // _isEncrypted (default to false for now)
        "0x", // _masterKeyHash (empty for non-encrypted files)
      ]);

      // Wait for confirmation
      const publicClient = getPublic();
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      // Resolve fileId via mapping
      const read = getReadContract();
      const fileId = (await (read as any).read.hashToFileId([
        metadataCID,
      ])) as bigint;

      let storedCID: string | null = null;
      let fileIdNumber: number | null = null;
      if (fileId && fileId > BigInt(0)) {
        fileIdNumber = Number(fileId);
        const fileInfo = (await (read as any).read.getFileInfo([fileId])) as [
          string, // fileHash
          string, // fileName
          bigint, // fileSize
          string, // uploader
          bigint, // timestamp
          boolean, // isActive
          string, // metadataCID
          boolean, // isEncrypted
          string // masterKeyHash
        ];
        storedCID = fileInfo[6];

        // If client provided their wallet address, grant them read access immediately
        if (uploaderAddress && /^0x[a-fA-F0-9]{40}$/.test(uploaderAddress)) {
          try {
            await (write as any).write.grantRead([
              fileId,
              uploaderAddress as unknown as `0x${string}`,
            ]);
          } catch (grantErr) {
            // Non-fatal: proceed even if granting fails
            console.warn("Grant read failed:", grantErr);
          }
        }
      }

      return NextResponse.json({
        success: true,
        txHash,
        blockNumber: Number(receipt.blockNumber),
        fileId: fileIdNumber,
        storedCID,
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
