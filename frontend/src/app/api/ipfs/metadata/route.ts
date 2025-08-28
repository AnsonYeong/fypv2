import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface PinataJSONResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const pinataJWT = process.env.PINATA_JWT;
    if (!pinataJWT) {
      return NextResponse.json(
        { error: "Server misconfigured: PINATA_JWT is not set" },
        { status: 500 }
      );
    }

    // Accept either raw JSON body or multipart with a 'metadata' field
    let metadata: unknown;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      metadata = await request.json();
    } else if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const raw = form.get("metadata");
      if (typeof raw === "string") {
        metadata = JSON.parse(raw);
      } else if (raw instanceof File) {
        const text = await raw.text();
        metadata = JSON.parse(text);
      } else {
        return NextResponse.json(
          { error: "Provide 'metadata' as JSON or string in form-data" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        {
          error: "Unsupported content type. Use application/json or form-data.",
        },
        { status: 415 }
      );
    }

    // Basic validation: must be an object with some expected fields
    if (!metadata || typeof metadata !== "object") {
      return NextResponse.json(
        { error: "Invalid metadata: must be a JSON object" },
        { status: 400 }
      );
    }

    // Pin JSON to IPFS via Pinata
    const pinataBody = {
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: { name: "metadata.json" },
      pinataContent: metadata,
    };

    const response = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJWT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pinataBody),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Pinata pinJSONToIPFS failed",
          details: text || response.statusText,
        },
        { status: response.status }
      );
    }

    const json = (await response.json()) as PinataJSONResponse;
    const cid = json.IpfsHash;

    return NextResponse.json({
      success: true,
      metadataCID: cid,
      ipfsUrl: `ipfs://${cid}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
      size: json.PinSize,
      timestamp: json.Timestamp,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to upload metadata to IPFS",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
