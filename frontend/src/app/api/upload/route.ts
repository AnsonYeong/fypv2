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
    const shouldEncrypt = incoming.get("encrypt") === "true"; // New parameter for encryption

    // Version update parameters
    const isVersionUpdate = incoming.get("isVersionUpdate") === "true";
    const originalFileId = incoming.get("originalFileId") as string;
    const originalMetadataCID = incoming.get("originalMetadataCID") as string;
    const originalBlockchainFileId = incoming.get(
      "originalBlockchainFileId"
    ) as string;

    console.log("Encryption requested:", shouldEncrypt); // Debug log

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send as form-data with field 'file'." },
        { status: 400 }
      );
    }

    let fileToUpload = file;
    let encryptionData = null;
    let originalFileName = file.name;

    // If encryption is requested, encrypt the file
    if (shouldEncrypt) {
      console.log("Starting file encryption..."); // Debug log
      try {
        const { encryptedFile, key, iv } = await encryptFile(file);
        console.log("Encryption successful, key length:", key.length); // Debug log
        fileToUpload = encryptedFile;
        encryptionData = { key, iv };
        originalFileName = file.name; // Keep original name for reference
        console.log(
          "File encrypted, original size:",
          file.size,
          "encrypted size:",
          encryptedFile.size
        ); // Debug log
      } catch (encryptError) {
        console.error("Encryption error:", encryptError); // Debug log
        return NextResponse.json(
          { error: "File encryption failed", details: String(encryptError) },
          { status: 500 }
        );
      }
    } else {
      console.log("No encryption requested, using original file"); // Debug log
    }

    const pinataFormData = new FormData();
    const filename =
      typeof name === "string" && name.trim().length > 0
        ? name
        : fileToUpload.name;
    pinataFormData.append("file", fileToUpload, filename);

    // Enhanced metadata with encryption info
    const metadata = {
      name: filename,
      originalName: originalFileName,
      encrypted: shouldEncrypt,
      originalSize: file.size,
      encryptedSize: fileToUpload.size,
      uploadDate: new Date().toISOString(),
    };

    pinataFormData.append("pinataMetadata", JSON.stringify(metadata));

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
      encrypted: shouldEncrypt,
      originalSize: file.size,
      encryptionData: encryptionData
        ? {
            key: encryptionData.key,
            iv: encryptionData.iv,
            algorithm: "AES-GCM-256",
          }
        : null,
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

// File encryption helper function
async function encryptFile(file: File) {
  try {
    console.log("Encrypting file:", file.name, "size:", file.size); // Debug log

    // Generate encryption key (AES-GCM 256-bit)
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    console.log("Encryption key generated"); // Debug log

    // Generate random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    console.log("IV generated, length:", iv.length); // Debug log

    // Read file as array buffer
    const fileBuffer = await file.arrayBuffer();
    console.log("File read as buffer, size:", fileBuffer.byteLength); // Debug log

    // Encrypt the file using AES-GCM
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      fileBuffer
    );
    console.log("File encrypted, encrypted size:", encryptedBuffer.byteLength); // Debug log

    // Convert encrypted data to blob
    const encryptedBlob = new Blob([encryptedBuffer]);
    console.log("Encrypted blob created, size:", encryptedBlob.size); // Debug log

    // Export key for storage (convert to hex string)
    const exportedKey = await crypto.subtle.exportKey("raw", key);
    const keyHex = Array.from(new Uint8Array(exportedKey))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    console.log("Key exported, hex length:", keyHex.length); // Debug log

    // Convert IV to hex string
    const ivHex = Array.from(iv)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    console.log("IV converted to hex, length:", ivHex.length); // Debug log

    // Create encrypted file with .encrypted extension
    const encryptedFile = new File([encryptedBlob], file.name + ".encrypted", {
      type: "application/octet-stream",
    });
    console.log(
      "Encrypted file created:",
      encryptedFile.name,
      "size:",
      encryptedFile.size
    ); // Debug log

    return {
      encryptedFile,
      key: keyHex,
      iv: ivHex,
    };
  } catch (error) {
    console.error("Encryption function error:", error); // Debug log
    throw new Error(`Encryption failed: ${error}`);
  }
}
