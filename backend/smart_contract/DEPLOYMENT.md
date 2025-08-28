# 🚀 FileHashStorage Smart Contract Deployment Guide

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Hardhat CLI

## 🔧 Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Compile the contract:**
   ```bash
   npx hardhat compile
   ```

## 🧪 Testing

1. **Run tests:**

   ```bash
   npx hardhat test
   ```

2. **Run tests with coverage:**
   ```bash
   npx hardhat coverage
   ```

## 🚀 Deployment

### Option 1: Local Development Network

1. **Start local Hardhat node:**

   ```bash
   npx hardhat node
   ```

2. **Deploy using Ignition (recommended):**

   ```bash
   npx hardhat ignition deploy ignition/modules/FileHashStorage.ts --network localhost
   ```

3. **Or deploy using script:**
   ```bash
   npx hardhat run scripts/deploy.ts --network localhost
   ```

### Option 2: Testnet (Sepolia)

1. **Set environment variables:**

   ```bash
   export PRIVATE_KEY="your_private_key_here"
   export SEPOLIA_URL="your_sepolia_rpc_url"
   export ETHERSCAN_API_KEY="your_etherscan_api_key"
   ```

2. **Deploy to Sepolia:**

   ```bash
   npx hardhat run scripts/deploy.ts --network sepolia
   ```

3. **Verify on Etherscan:**
   ```bash
   npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
   ```

### Option 3: Mainnet

1. **Set environment variables:**

   ```bash
   export PRIVATE_KEY="your_private_key_here"
   export MAINNET_URL="your_mainnet_rpc_url"
   export ETHERSCAN_API_KEY="your_etherscan_api_key"
   ```

2. **Deploy to mainnet:**
   ```bash
   npx hardhat run scripts/deploy.ts --network mainnet
   ```

## 📊 Contract Functions

### Core Functions

- `uploadFileHash(string fileHash, string fileName, uint256 fileSize)` - Upload a file hash
- `getFileInfo(uint256 fileId)` - Get file information
- `verifyHash(string fileHash)` - Verify if a hash exists
- `shareFile(uint256 fileId, address userAddress)` - Share file with user
- `hasAccess(uint256 fileId, address userAddress)` - Check user access

### View Functions

- `getTotalFiles()` - Get total number of files
- `getUserFiles(address user)` - Get user's file IDs
- `getSharedUsers(uint256 fileId)` - Get users file is shared with

## 🔍 Verification

After deployment, verify the contract:

1. **Check deployment:**

   ```bash
   npx hardhat verify --network <network> <contract_address>
   ```

2. **Test basic functions:**
   - Upload a test file hash
   - Verify the hash exists
   - Check file information

## 📝 Environment Variables

Create a `.env` file:

```env
PRIVATE_KEY=your_private_key_here
SEPOLIA_URL=https://sepolia.infura.io/v3/your_project_id
MAINNET_URL=https://mainnet.infura.io/v3/your_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
REPORT_GAS=true
```

## 🚨 Security Notes

- Never commit private keys to version control
- Use testnets for development and testing
- Verify contract code on Etherscan after deployment
- Test thoroughly before mainnet deployment

## 🆘 Troubleshooting

### Common Issues:

1. **Compilation errors**: Check Solidity version compatibility
2. **Deployment failures**: Verify network configuration and gas settings
3. **Verification failures**: Ensure contract address and constructor arguments are correct

### Get Help:

- Check Hardhat documentation: https://hardhat.org/
- Review Solidity documentation: https://docs.soliditylang.org/
- Check network status and gas prices
