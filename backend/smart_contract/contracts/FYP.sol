// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract FileHashStorage {
    struct FileRecord {
        string fileHash;        // IPFS hash or file content hash
        string fileName;        // Original file name
        uint256 fileSize;       // File size in bytes
        address uploader;       // Address of the user who uploaded
        uint256 timestamp;      // When the file was uploaded
        bool isActive;          // Whether the file record is active
        address[] sharedWith;   // Array of addresses that have access
    }
    
    // Mapping from file ID to file record
    mapping(uint256 => FileRecord) public files;
    
    // Mapping from user address to their file IDs
    mapping(address => uint256[]) public userFiles;
    
    // Mapping from hash to file ID (to prevent duplicate uploads)
    mapping(string => uint256) public hashToFileId;
    
    // Counter for file IDs
    uint256 public nextFileId = 1;
    
    // Contract owner
    address public owner;
    
    // Events
    event FileUploaded(
        uint256 indexed fileId,
        string fileHash,
        string fileName,
        address indexed uploader,
        uint256 timestamp
    );
    
    event FileShared(
        uint256 indexed fileId,
        address indexed sharedBy,
        string sharedWith
    );
    
    event FileDeactivated(
        uint256 indexed fileId,
        address indexed deactivatedBy
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can call this function");
        _;
    }
    
    modifier onlyFileOwner(uint256 _fileId) {
        require(files[_fileId].uploader == msg.sender, "Only file owner can perform this action");
        _;
    }
    
    modifier fileExists(uint256 _fileId) {
        require(_fileId > 0 && _fileId < nextFileId, "File does not exist");
        require(files[_fileId].isActive, "File is not active");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Upload a file hash to the blockchain
     * @param _fileHash The hash of the file (IPFS hash or content hash)
     * @param _fileName The original name of the file
     * @param _fileSize The size of the file in bytes
     * @return fileId The ID assigned to the uploaded file
     */
    function uploadFileHash(
        string memory _fileHash,
        string memory _fileName,
        uint256 _fileSize
    ) public returns (uint256) {
        require(bytes(_fileHash).length > 0, "File hash cannot be empty");
        require(bytes(_fileName).length > 0, "File name cannot be empty");
        require(_fileSize > 0, "File size must be greater than 0");
        require(hashToFileId[_fileHash] == 0, "File with this hash already exists");
        
        uint256 fileId = nextFileId;
        nextFileId++;
        
        files[fileId] = FileRecord({
            fileHash: _fileHash,
            fileName: _fileName,
            fileSize: _fileSize,
            uploader: msg.sender,
            timestamp: block.timestamp,
            isActive: true,
            sharedWith: new address[](0)
        });
        
        userFiles[msg.sender].push(fileId);
        hashToFileId[_fileHash] = fileId;
        
        emit FileUploaded(fileId, _fileHash, _fileName, msg.sender, block.timestamp);
        
        return fileId;
    }
    
    /**
     * @dev Get file information by file ID
     * @param _fileId The ID of the file
     * @return fileHash The hash of the file
     * @return fileName The name of the file
     * @return fileSize The size of the file
     * @return uploader The address of the uploader
     * @return timestamp When the file was uploaded
     * @return isActive Whether the file is active
     */
    function getFileInfo(uint256 _fileId) 
        public 
        view 
        fileExists(_fileId)
        returns (
            string memory fileHash,
            string memory fileName,
            uint256 fileSize,
            address uploader,
            uint256 timestamp,
            bool isActive
        ) 
    {
        FileRecord memory file = files[_fileId];
        return (
            file.fileHash,
            file.fileName,
            file.fileSize,
            file.uploader,
            file.timestamp,
            file.isActive
        );
    }
    
    /**
     * @dev Get file hash by file ID
     * @param _fileId The ID of the file
     * @return The hash of the file
     */
    function getFileHash(uint256 _fileId) 
        public 
        view 
        fileExists(_fileId)
        returns (string memory) 
    {
        return files[_fileId].fileHash;
    }
    
    /**
     * @dev Get all file IDs owned by a user
     * @param _user The address of the user
     * @return Array of file IDs owned by the user
     */
    function getUserFiles(address _user) public view returns (uint256[] memory) {
        return userFiles[_user];
    }
    
    /**
     * @dev Share a file with another user
     * @param _fileId The ID of the file to share
     * @param _userAddress The address to share the file with
     */
    function shareFile(uint256 _fileId, address _userAddress) 
        public 
        onlyFileOwner(_fileId)
        fileExists(_fileId)
    {
        require(_userAddress != address(0), "User address cannot be zero address");
        
        files[_fileId].sharedWith.push(_userAddress);
        
        emit FileShared(_fileId, msg.sender, addressToString(_userAddress));
    }
    
    /**
     * @dev Get the list of users a file is shared with
     * @param _fileId The ID of the file
     * @return Array of user addresses that the file is shared with
     */
    function getSharedUsers(uint256 _fileId) 
        public 
        view 
        fileExists(_fileId)
        returns (address[] memory) 
    {
        return files[_fileId].sharedWith;
    }
    
    /**
     * @dev Deactivate a file (soft delete)
     * @param _fileId The ID of the file to deactivate
     */
    function deactivateFile(uint256 _fileId) 
        public 
        onlyFileOwner(_fileId)
        fileExists(_fileId)
    {
        files[_fileId].isActive = false;
        
        emit FileDeactivated(_fileId, msg.sender);
    }
    
    /**
     * @dev Verify if a hash exists in the system
     * @param _fileHash The hash to verify
     * @return exists Whether the hash exists
     * @return fileId The file ID if it exists (0 if not)
     */
    function verifyHash(string memory _fileHash) 
        public 
        view 
        returns (bool exists, uint256 fileId) 
    {
        fileId = hashToFileId[_fileHash];
        exists = fileId > 0 && files[fileId].isActive;
        return (exists, fileId);
    }
    
    /**
     * @dev Get the total number of files uploaded
     * @return The total count of files
     */
    function getTotalFiles() public view returns (uint256) {
        return nextFileId - 1;
    }
    
    /**
     * @dev Check if a user has access to a file
     * @param _fileId The ID of the file
     * @param _userAddress The address of the user to check
     * @return Whether the user has access to the file
     */
    function hasAccess(uint256 _fileId, address _userAddress) 
        public 
        view 
        fileExists(_fileId)
        returns (bool) 
    {
        FileRecord memory file = files[_fileId];
        
        // Owner always has access
        if (file.uploader == _userAddress) {
            return true;
        }
        
        // Check if user is in shared list
        for (uint256 i = 0; i < file.sharedWith.length; i++) {
            if (file.sharedWith[i] == _userAddress) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Convert address to string
     * @param _addr The address to convert
     * @return The string representation of the address
     */
    function addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}
