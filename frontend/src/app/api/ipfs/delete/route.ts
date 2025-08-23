import { NextRequest, NextResponse } from "next/server";

interface DeleteRequest {
  cid: string;
  fileName?: string;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  cid: string;
  fileName?: string;
  timestamp: string;
}

export async function DELETE(request: NextRequest) {
  try {
    // Parse the request body
    const body: DeleteRequest = await request.json();
    const { cid, fileName } = body;

    // Validate required parameters
    if (!cid) {
      return NextResponse.json(
        {
          success: false,
          error: "CID parameter is required",
          message: "Please provide a valid file CID to delete",
        },
        { status: 400 }
      );
    }

    // Validate CID format (basic check)
    if (!cid.startsWith("Qm") && !cid.startsWith("bafy")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid CID format",
          message: "CID must be a valid IPFS hash starting with Qm or bafy",
        },
        { status: 400 }
      );
    }

    // Get Pinata API credentials from environment variables
    const pinataJWT = process.env.PINATA_JWT;

    if (!pinataJWT) {
      console.error("PINATA_JWT not configured");
      return NextResponse.json(
        {
          success: false,
          error: "IPFS service not configured",
          message: "File deletion service is temporarily unavailable",
        },
        { status: 500 }
      );
    }

    // Call Pinata API to unpin the file from IPFS
    const pinataResponse = await fetch(
      `https://api.pinata.cloud/pinning/unpin/${cid}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${pinataJWT}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Handle Pinata API response
    if (!pinataResponse.ok) {
      const errorData = await pinataResponse.json().catch(() => ({}));

      // Handle specific Pinata error cases
      if (pinataResponse.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: "File not found on IPFS",
            message:
              "The specified file was not found or has already been deleted",
            cid,
            fileName,
          },
          { status: 404 }
        );
      }

      if (pinataResponse.status === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized",
            message: "You do not have permission to delete this file",
            cid,
            fileName,
          },
          { status: 403 }
        );
      }

      // Generic error response
      return NextResponse.json(
        {
          success: false,
          error: "IPFS deletion failed",
          message:
            errorData.error ||
            `Failed to delete file: ${pinataResponse.statusText}`,
          cid,
          fileName,
        },
        { status: pinataResponse.status }
      );
    }

    // Success response
    const successResponse: DeleteResponse = {
      success: true,
      message: "File successfully deleted from IPFS",
      cid,
      fileName,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `File deleted from IPFS: ${cid}${fileName ? ` (${fileName})` : ""}`
    );

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    console.error("Error in IPFS delete API:", error);

    // Handle different types of errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format",
          message: "Request body must be valid JSON",
        },
        { status: 400 }
      );
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "Network error",
          message: "Failed to connect to IPFS service. Please try again.",
        },
        { status: 503 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "An unexpected error occurred while deleting the file",
      },
      { status: 500 }
    );
  }
}

// Also support POST method for compatibility
export async function POST(request: NextRequest) {
  return DELETE(request);
}
