# Metadata Retrieval API

This API allows you to retrieve metadata from IPFS using a CID (Content Identifier) with proper access control and blockchain verification.

## Endpoints

### POST `/api/contract/retrieve`

Retrieves metadata with full access control and blockchain verification.

**Request Body:**

```json
{
  "metadataCID": "QmExampleMetadataCID...",
  "userAddress": "0x1234567890abcdef..."
}
```

**Response (Success):**

```json
{
  "success": true,
  "metadata": {
    "version": "1.0.0",
    "fileInfo": {
      "originalName": "document.pdf",
      "originalSize": 1048576,
      "encryptedSize": 1048704,
      "mimeType": "application/pdf",
      "uploadDate": "2024-01-15T10:30:00.000Z",
      "lastModified": "2024-01-15T10:25:00.000Z"
    },
    "encryption": {
      "algorithm": "AES-GCM-256",
      "keyWrapped": "base64_encoded_wrapped_key",
      "iv": "base64_encoded_iv",
      "salt": "base64_encoded_salt",
      "iterations": 100000
    },
    "ipfs": {
      "fileCID": "QmEncryptedFileCID...",
      "gateway": "https://gateway.pinata.cloud/ipfs/QmEncryptedFileCID..."
    },
    "blockchain": {
      "contractAddress": "0x...",
      "fileId": 123,
      "uploader": "0x...",
      "timestamp": 1705312200,
      "blockchainFileInfo": {
        "fileHash": "QmMetadataCID...",
        "fileName": "document.pdf",
        "fileSize": 1048576,
        "uploader": "0x...",
        "timestamp": 1705312200,
        "isActive": true,
        "metadataCID": "QmMetadataCID..."
      }
    },
    "access": {
      "owner": "0x...",
      "sharedWith": ["0x...", "0x..."],
      "permissions": {
        "read": true,
        "write": false,
        "share": true,
        "delete": true
      }
    },
    "integrity": {
      "originalHash": "sha256_hash",
      "encryptedHash": "sha256_hash",
      "metadataHash": "sha256_hash"
    }
  },
  "message": "Metadata retrieved successfully",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "fileId": 123
}
```

**Response (Access Denied):**

```json
{
  "error": "Access denied. You don't have permission to view this file."
}
```

**Response (Rate Limited):**

```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

### GET `/api/contract/retrieve?cid=QmExampleCID...`

Retrieves public metadata without access control (no sensitive information).

**Query Parameters:**

- `cid`: The IPFS CID of the metadata

**Response (Success):**

```json
{
  "success": true,
  "metadata": {
    "version": "1.0.0",
    "fileInfo": {
      "originalName": "document.pdf",
      "originalSize": 1048576,
      "encryptedSize": 1048704,
      "mimeType": "application/pdf",
      "uploadDate": "2024-01-15T10:30:00.000Z",
      "lastModified": "2024-01-15T10:25:00.000Z"
    },
    "encryption": {
      "algorithm": "AES-GCM-256"
    },
    "ipfs": {
      "fileCID": "QmEncryptedFileCID...",
      "gateway": "https://gateway.pinata.cloud/ipfs/QmEncryptedFileCID..."
    },
    "blockchain": {
      "contractAddress": "0x...",
      "timestamp": 1705312200
    },
    "access": {
      "permissions": {
        "read": true,
        "write": false,
        "share": true,
        "delete": true
      }
    }
  },
  "message": "Public metadata retrieved successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Features

### 🔐 Access Control

- **POST endpoint**: Full access control with user authentication
- **GET endpoint**: Public access (no sensitive data exposed)

### 🔍 Blockchain Integration

- Verifies file existence on blockchain
- Retrieves additional blockchain information
- Cross-references IPFS metadata with blockchain data

### 🛡️ Security Features

- **Input Validation**: CID and Ethereum address format validation
- **Rate Limiting**: 100 requests per minute per user/CID
- **Access Verification**: Checks user permissions before returning data
- **Data Sanitization**: Public endpoint removes sensitive information

### 📊 Error Handling

- Comprehensive error messages
- Proper HTTP status codes
- Detailed logging for debugging

## Usage Examples

### Frontend JavaScript

```javascript
// Retrieve metadata with access control
const response = await fetch("/api/contract/retrieve", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    metadataCID: "QmExampleMetadataCID...",
    userAddress: "0x1234567890abcdef...",
  }),
});

const result = await response.json();
if (result.success) {
  console.log("File metadata:", result.metadata);
  console.log("File ID:", result.fileId);
} else {
  console.error("Error:", result.error);
}
```

### Public Metadata Retrieval

```javascript
// Retrieve public metadata
const response = await fetch("/api/contract/retrieve?cid=QmExampleCID...");
const result = await response.json();

if (result.success) {
  console.log("Public file info:", result.metadata.fileInfo);
  console.log("File type:", result.metadata.encryption.algorithm);
} else {
  console.error("Error:", result.error);
}
```

### cURL Examples

```bash
# POST with access control
curl -X POST http://localhost:3000/api/contract/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "metadataCID": "QmExampleMetadataCID...",
    "userAddress": "0x1234567890abcdef..."
  }'

# GET public metadata
curl "http://localhost:3000/api/contract/retrieve?cid=QmExampleCID..."
```

## Rate Limiting

- **POST endpoint**: 100 requests per minute per user address
- **GET endpoint**: 100 requests per minute per CID
- Rate limit window: 1 minute
- Exceeded limit returns HTTP 429 status

## Error Codes

- **400**: Bad Request (missing parameters, invalid format)
- **403**: Forbidden (access denied)
- **404**: Not Found (file not found on IPFS)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

## Security Considerations

1. **Access Control**: Always verify user permissions before returning sensitive data
2. **Input Validation**: Validate all input parameters to prevent injection attacks
3. **Rate Limiting**: Prevent abuse and ensure fair usage
4. **Data Sanitization**: Public endpoints should never expose sensitive information
5. **Error Handling**: Don't expose internal system details in error messages

## Production Considerations

1. **Rate Limiting**: Consider using Redis for distributed rate limiting
2. **Caching**: Implement caching for frequently accessed metadata
3. **Monitoring**: Add metrics and alerting for API usage
4. **Logging**: Implement structured logging for better debugging
5. **Health Checks**: Add health check endpoints for monitoring
