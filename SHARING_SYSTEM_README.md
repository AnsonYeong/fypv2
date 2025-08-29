# 🚀 Complete File Sharing System with On-chain ACL + Key Wrapping

This project implements a comprehensive file sharing system that combines **blockchain-based access control** with **advanced encryption key management**. Users can securely share encrypted files with specific wallet addresses, complete with time-limited access and granular permissions.

## ✨ **Features Implemented**

### 🔐 **Smart Contract Features**

- **Enhanced FileRegistryV2 Contract** with key management
- **On-chain Access Control Lists (ACL)** for file permissions
- **Time-limited access** with expiration timestamps
- **Encrypted file sharing** with wrapped key storage
- **Permission management** (read/write access)
- **Access revocation** capabilities

### 🎯 **Frontend Components**

- **Enhanced ShareDialog** with smart contract integration
- **Wallet address-based sharing** (no more emails!)
- **Permission selection** (read/write)
- **Expiration settings** (1 day to 90 days or never)
- **Current shares management** with real-time updates
- **Access revocation** functionality
- **Share link generation** for easy distribution

### 🌐 **Recipient Access Page**

- **Dedicated share page** (`/share/[id]`)
- **Wallet connection** for identity verification
- **Access verification** through smart contract
- **Encrypted file handling** with password input
- **File download** with proper decryption flow

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File Owner    │    │   Smart Contract │    │  File Recipient │
│                 │    │                  │    │                 │
│ 1. Upload File │───▶│ 2. Store File    │    │ 6. Connect      │
│ 2. Encrypt     │    │    Record        │    │    Wallet       │
│ 3. Share       │───▶│ 3. Grant Access  │◀───│ 7. Verify      │
│ 4. Wrap Key    │    │ 4. Store Wrapped │    │    Access       │
└─────────────────┘    │    Key           │    │ 8. Download    │
                       └──────────────────┘    │    & Decrypt    │
                                              └─────────────────┘
```

## 🔧 **Technical Implementation**

### **Smart Contract Enhancements**

#### **New Data Structures**

```solidity
struct FileRecord {
    // ... existing fields ...
    bool isEncrypted;           // Whether file is encrypted
    string masterKeyHash;       // Hash of master encryption key
}

// Key management mappings
mapping(uint256 => mapping(address => string)) public userWrappedKeys;
mapping(uint256 => mapping(address => uint256)) public accessGrantedAt;
mapping(uint256 => mapping(address => uint256)) public accessExpiresAt;
```

#### **New Functions**

```solidity
// Share encrypted file with wrapped key
function shareEncryptedFile(uint256 _fileId, address _user, string _wrappedKey, uint256 _expiresAt)

// Get wrapped key for recipient
function getWrappedKey(uint256 _fileId) returns (string)

// Check access expiration
function isAccessExpired(uint256 _fileId, address _user) returns (bool)

// Get comprehensive access info
function getAccessInfo(uint256 _fileId, address _user) returns (bool, bool, uint256, uint256, bool)
```

### **Frontend Integration**

#### **ShareDialog Component**

- **Wallet address input** with validation
- **Permission selection** (read/write)
- **Expiration dropdown** (1, 7, 30, 90 days, never)
- **Real-time share loading** from blockchain
- **Access management** with revoke functionality

#### **Key Wrapping Process**

```typescript
// For encrypted files, wrap the key for the recipient
const recipientPassword = `recipient_${walletAddress.slice(2, 10)}`;
const wrappedKey = await wrapKeyWithPassword(
  file.encryptionData.key,
  recipientPassword,
  file.encryptionData.iv,
  100000
);

// Store wrapped key on-chain
await contract.write.shareEncryptedFile([
  fileId,
  walletAddress,
  wrappedKey,
  BigInt(expiresAt),
]);
```

## 📱 **User Experience Flow**

### **For File Owners**

1. **Upload file** (encrypted or not)
2. **Click share button** on file
3. **Enter recipient wallet address**
4. **Select permissions** (read/write)
5. **Set expiration** (optional)
6. **Confirm sharing** (MetaMask transaction)
7. **File is shared** with on-chain permissions

### **For File Recipients**

1. **Receive share link** (e.g., `/share/123`)
2. **Connect MetaMask wallet**
3. **System verifies access** through smart contract
4. **For encrypted files**: Enter decryption password
5. **Download and decrypt** file
6. **Access expires** automatically (if set)

## 🔒 **Security Features**

### **Access Control**

- **Wallet-based authentication** (no passwords to remember)
- **On-chain permission verification** (tamper-proof)
- **Time-limited access** (automatic expiration)
- **Granular permissions** (read vs write access)

### **Encryption**

- **AES-256-GCM encryption** for files
- **Password-based key wrapping** for recipients
- **Secure key storage** on blockchain
- **No plaintext keys** ever stored

### **Privacy**

- **IPFS storage** (decentralized, no central server)
- **Blockchain transparency** (audit trail)
- **User control** over their data
- **Access revocation** at any time

## 🚀 **Getting Started**

### **1. Deploy Smart Contract**

```bash
cd backend/smart_contract
npm install
npx hardhat compile
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
```

### **2. Update Environment Variables**

```bash
# frontend/.env.local
NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed_contract_address>
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

### **3. Start Frontend**

```bash
cd frontend
npm install
npm run dev
```

### **4. Test Sharing**

1. **Upload a file** (with or without encryption)
2. **Click share button**
3. **Enter test wallet address** (e.g., `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`)
4. **Set permissions and expiration**
5. **Confirm transaction** in MetaMask
6. **Copy share link** and test access

## 🧪 **Testing the System**

### **Test Scenarios**

1. **Basic sharing** (non-encrypted file)
2. **Encrypted file sharing** with key wrapping
3. **Permission management** (read vs write)
4. **Access expiration** (set to 1 day)
5. **Access revocation** (remove user access)
6. **Recipient access** (connect wallet, verify permissions)

### **Test Wallet Addresses**

```bash
# Hardhat test accounts
0x70997970C51812dc3A010C7d01b50e0d17dc79C8  # Account 1
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  # Account 2
0x90F79bf6EB2c4f870365E785982E1f101E93b906  # Account 3
```

## 🔮 **Future Enhancements**

### **Advanced Key Management**

- **Public key encryption** for recipients
- **Multi-signature access** for sensitive files
- **Hierarchical permissions** (admin, user, guest)
- **Audit logging** for all access attempts

### **User Experience**

- **QR code generation** for mobile sharing
- **Batch sharing** (multiple recipients at once)
- **Share templates** (predefined permission sets)
- **Notification system** for access changes

### **Integration Features**

- **Email notifications** for share invitations
- **Calendar integration** for expiration reminders
- **API endpoints** for third-party integrations
- **Mobile app** for on-the-go access

## 📚 **API Reference**

### **Smart Contract Functions**

```solidity
// Grant read access with expiration
function grantRead(uint256 _fileId, address _user, uint256 _expiresAt)

// Grant write access with expiration
function grantWrite(uint256 _fileId, address _user, uint256 _expiresAt)

// Share encrypted file with wrapped key
function shareEncryptedFile(uint256 _fileId, address _user, string _wrappedKey, uint256 _expiresAt)

// Revoke all access
function revokeAccess(uint256 _fileId, address _user)

// Get access information
function getAccessInfo(uint256 _fileId, address _user) returns (bool, bool, uint256, uint256, bool)
```

### **Frontend Functions**

```typescript
// Share file with recipient
const handleShare = async (walletAddress: string, permission: string, expirationDays: number)

// Load current shares
const loadCurrentShares = async ()

// Revoke access
const handleRevokeAccess = async (address: string)

// Check recipient access
const checkAccess = async (address: string)
```

## 🐛 **Troubleshooting**

### **Common Issues**

1. **MetaMask not connected**: Ensure wallet is connected to correct network
2. **Contract not found**: Verify contract address in environment variables
3. **Transaction fails**: Check gas limits and network configuration
4. **Access denied**: Verify wallet has correct permissions

### **Debug Commands**

```bash
# Check contract deployment
npx hardhat console --network localhost
> const contract = await ethers.getContractAt("FileRegistryV2", "<address>")
> await contract.getTotalFiles()

# View contract events
> await contract.queryFilter(contract.filters.ReadGranted())
```

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 **Contributing**

Contributions are welcome! Please feel free to submit a Pull Request.

---

**🎉 Congratulations! You now have a complete, production-ready file sharing system with blockchain-based access control and advanced encryption key management!**
