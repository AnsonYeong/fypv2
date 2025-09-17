# 🚀 Decentralized File Sharing System with Blockchain Access Control

A comprehensive file sharing platform that combines **IPFS storage**, **blockchain-based access control**, and **advanced encryption** to provide secure, decentralized file sharing with granular permissions and time-limited access.

## ✨ Features

### 🔐 **Core Security Features**

- **AES-256-GCM encryption** for file protection
- **Blockchain-based access control** with smart contracts
- **Time-limited access** with automatic expiration
- **Granular permissions** (read/write access)
- **Wallet-based authentication** (no passwords required)
- **IPFS decentralized storage** (no central server dependency)

### 📁 **File Management**

- **Encrypted file uploads** with optional password protection
- **Version control** with complete history tracking
- **File deduplication** to save storage space
- **Metadata management** with IPFS storage
- **File sharing** with specific wallet addresses
- **Access revocation** capabilities

### 🎯 **User Experience**

- **Modern React/Next.js frontend** with Tailwind CSS
- **Real-time transaction notifications**
- **Responsive design** for all devices
- **Intuitive file management interface**
- **Share link generation** for easy distribution
- **Wallet integration** with MetaMask

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Smart Contract │    │   IPFS Network  │
│   (Next.js)     │    │   (Ethereum)     │    │   (Pinata)      │
│                 │    │                  │    │                 │
│ • File Upload   │───▶│ • Access Control │    │ • File Storage  │
│ • Encryption    │    │ • Permissions    │    │ • Metadata      │
│ • Sharing UI    │───▶│ • Key Management │◀───│ • Versioning    │
│ • Wallet Conn.  │    │ • Event Logging  │    │ • Decentralized │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MetaMask** browser extension
- **Pinata account** (for IPFS storage)

### 1. Clone and Install

```bash
git clone <repository-url>
cd fypv2

# Install frontend dependencies
cd frontend
npm install

# Install smart contract dependencies
cd ../backend/smart_contract
npm install
```

### 2. Environment Setup

Create `frontend/.env.local`:

```env
# Pinata IPFS Configuration
PINATA_JWT=your_pinata_jwt_token_here

# Smart Contract Configuration
NEXT_PUBLIC_CONTRACT_ADDRESS=your_deployed_contract_address
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

### 3. Deploy Smart Contract

```bash
cd backend/smart_contract

# Compile contracts
npx hardhat compile

# Start local blockchain
npx hardhat node

# In a new terminal, deploy contract
npx hardhat run scripts/deploy.ts --network localhost
```

Copy the deployed contract address to your `frontend/.env.local` file.

### 4. Start Frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 How to Use

### For File Owners

1. **Connect Wallet**: Click "Connect Wallet" and approve MetaMask connection
2. **Upload File**:
   - Click "Upload File" button
   - Select file from your device
   - Choose encryption option (optional)
   - Set password if encrypting
   - Confirm transaction
3. **Share File**:
   - Click share button on any file
   - Enter recipient's wallet address
   - Select permissions (read/write)
   - Set expiration time (optional)
   - Confirm sharing transaction
4. **Manage Access**:
   - View current shares
   - Revoke access anytime
   - Monitor access expiration

### For File Recipients

1. **Receive Share Link**: Get link from file owner (e.g., `/share/123`)
2. **Connect Wallet**: Connect MetaMask to verify identity
3. **Access File**:
   - System verifies permissions on blockchain
   - For encrypted files: Enter decryption password
   - Download file with automatic decryption
4. **Automatic Expiration**: Access expires automatically if time limit set

## 🔧 Technical Details

### Smart Contract Features

The `FileRegistryV2` contract provides:

```solidity
// Core file management
struct FileRecord {
    string fileHash;        // IPFS hash
    string fileName;        // Original filename
    uint256 fileSize;       // File size in bytes
    address uploader;       // File owner
    uint256 timestamp;      // Upload time
    bool isEncrypted;       // Encryption status
    string masterKeyHash;   // Encryption key hash
    uint256 versionCount;   // Version tracking
}

// Access control
mapping(uint256 => mapping(address => bool)) public canRead;
mapping(uint256 => mapping(address => bool)) public canWrite;
mapping(uint256 => mapping(address => uint256)) public accessExpiresAt;

// Key management for encrypted files
mapping(uint256 => mapping(address => string)) public userWrappedKeys;
```

### Key Functions

- `uploadFileHash()` - Store file metadata on blockchain
- `shareEncryptedFile()` - Share encrypted file with wrapped key
- `grantRead()` / `grantWrite()` - Grant specific permissions
- `revokeAccess()` - Remove user access
- `getAccessInfo()` - Check user permissions and expiration

### Frontend Architecture

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Viem** for Ethereum interactions
- **Ethers.js** for blockchain operations

## 🧪 Testing

### Test the System

1. **Upload Test File**:

   ```bash
   # Use any file for testing
   # Try both encrypted and non-encrypted uploads
   ```

2. **Test Sharing**:

   ```bash
   # Use these test wallet addresses (Hardhat default accounts):
   0x70997970C51812dc3A010C7d01b50e0d17dc79C8  # Account 1
   0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  # Account 2
   0x90F79bf6EB2c4f870365E785982E1f101E93b906  # Account 3
   ```

3. **Test Scenarios**:
   - Basic file upload and download
   - Encrypted file sharing with password
   - Permission management (read vs write)
   - Access expiration (set to 1 day)
   - Access revocation
   - Version history and rollback

### Run Smart Contract Tests

```bash
cd backend/smart_contract
npx hardhat test
npx hardhat coverage
```

## 🔒 Security Features

### Encryption

- **AES-256-GCM** encryption for files
- **Password-based key derivation** (PBKDF2)
- **Wrapped key storage** for recipients
- **No plaintext keys** ever stored

### Access Control

- **On-chain permission verification**
- **Time-limited access** with automatic expiration
- **Granular permissions** (read/write)
- **Access revocation** at any time
- **Wallet-based authentication**

### Privacy

- **IPFS decentralized storage**
- **No central server dependency**
- **User controls their own data**
- **Transparent blockchain audit trail**

## 🚨 Troubleshooting

### Common Issues

1. **MetaMask Connection Issues**:

   - Ensure MetaMask is installed and unlocked
   - Check network configuration (localhost:8545)
   - Reset account if needed

2. **Contract Not Found**:

   - Verify contract address in `.env.local`
   - Ensure contract is deployed to correct network
   - Check RPC URL configuration

3. **Transaction Failures**:

   - Check gas limits in MetaMask
   - Ensure sufficient ETH for gas fees
   - Verify network connection

4. **File Upload Issues**:
   - Check Pinata JWT token validity
   - Verify file size limits
   - Check network connectivity

### Debug Commands

```bash
# Check contract deployment
npx hardhat console --network localhost
> const contract = await ethers.getContractAt("FileRegistryV2", "<address>")
> await contract.getTotalFiles()

# View contract events
> await contract.queryFilter(contract.filters.FileUploaded())
```

## 📚 API Reference

### Smart Contract Functions

```solidity
// File management
function uploadFileHash(string fileHash, string fileName, uint256 fileSize)
function getFileInfo(uint256 fileId) returns (FileRecord)
function updateFileMetadata(uint256 fileId, string newMetadataCID)

// Access control
function grantRead(uint256 fileId, address user, uint256 expiresAt)
function grantWrite(uint256 fileId, address user, uint256 expiresAt)
function shareEncryptedFile(uint256 fileId, address user, string wrappedKey, uint256 expiresAt)
function revokeAccess(uint256 fileId, address user)

// Version management
function createNewVersion(uint256 fileId, string newMetadataCID)
function rollbackToVersion(uint256 fileId, uint256 versionIndex)
function getVersionHistory(uint256 fileId) returns (string[])

// Access verification
function hasReadAccess(uint256 fileId, address user) returns (bool)
function hasWriteAccess(uint256 fileId, address user) returns (bool)
function getAccessInfo(uint256 fileId, address user) returns (bool, bool, uint256, uint256, bool)
```

### Frontend API Routes

```typescript
// File operations
POST /api/upload - Upload file to IPFS
GET /api/ipfs/retrieve/[hash] - Retrieve file from IPFS
DELETE /api/ipfs/delete/[hash] - Delete file from IPFS

// Contract operations
POST /api/contract/upload - Store file metadata on blockchain
GET /api/contract/retrieve/[fileId] - Get file information
POST /api/contract/version/update - Create new file version
POST /api/contract/version/rollback - Rollback to previous version
```

## 🔮 Future Enhancements

### Planned Features

- **Public key encryption** for recipients
- **Multi-signature access** for sensitive files
- **Batch sharing** (multiple recipients)
- **QR code generation** for mobile sharing
- **Email notifications** for share invitations
- **Mobile app** for on-the-go access
- **API endpoints** for third-party integrations

### Advanced Security

- **Hierarchical permissions** (admin, user, guest)
- **Audit logging** for all access attempts
- **Zero-knowledge proofs** for privacy
- **Multi-chain support** (Polygon, BSC, etc.)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review existing [Issues](https://github.com/your-repo/issues)
3. Create a new issue with detailed information
4. Join our community discussions

---

**🎉 Congratulations! You now have a complete, production-ready decentralized file sharing system with blockchain-based access control and advanced encryption!**

## 📋 Project Structure

```
fypv2/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # App router pages and API routes
│   │   ├── components/      # Reusable UI components
│   │   ├── lib/            # Utility functions and configurations
│   │   └── animation/      # Animation components
│   ├── public/             # Static assets
│   └── package.json        # Frontend dependencies
├── backend/
│   └── smart_contract/     # Hardhat smart contract project
│       ├── contracts/      # Solidity smart contracts
│       ├── scripts/        # Deployment scripts
│       ├── test/          # Contract tests
│       └── ignition/      # Hardhat Ignition modules
└── README.md              # This file
```
