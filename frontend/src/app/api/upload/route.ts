import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return NextResponse.json(
        { error: "Server misconfigured: PINATA_JWT is not set" },
        { status: 500 }
      );
    }

    const incoming = await request.formData();
    const file = incoming.get("file");
    const name = incoming.get("name");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send as form-data with field 'file'." },
        { status: 400 }
      );
    }

    const pinataFormData = new FormData();
    // Pass through the file; use the provided name or the original file name
    const filename =
      typeof name === "string" && name.trim().length > 0 ? name : file.name;
    pinataFormData.append("file", file, filename);

    // Optional: set metadata with the name
    pinataFormData.append("pinataMetadata", JSON.stringify({ name: filename }));

    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: pinataFormData,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Pinata upload failed", details: text },
        { status: response.status }
      );
    }

    const json = await response.json();
    // Pinata returns IpfsHash (CID)
    const cid: string = json.IpfsHash;

    return NextResponse.json({
      cid,
      ipfsUrl: `ipfs://${cid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
      size: json.PinSize,
      timestamp: json.Timestamp,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
