// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract FileRegistryV2 {
    struct FileRecord {
        string fileHash;        // IPFS hash or file content hash
        string fileName;        // Original file name
        uint256 fileSize;       // File size in bytes
        address uploader;       // Address of the user who uploaded
        uint256 timestamp;      // When the file was uploaded
        bool isActive;          // Whether the file record is active
        string metadataCID;     // IPFS CID pointing to metadata.json
        bool isEncrypted;       // Whether the file is encrypted
        string masterKeyHash;   // Hash of the master encryption key
    }

    // Mapping from file ID to file record
    mapping(uint256 => FileRecord) public files;

    // Mapping from user address to their file IDs
    mapping(address => uint256[]) public userFiles;

    // Mapping from hash to file ID (to prevent duplicate uploads)
    mapping(string => uint256) public hashToFileId;

    // Permissions: fileId => user => access
    mapping(uint256 => mapping(address => bool)) public canRead;
    mapping(uint256 => mapping(address => bool)) public canWrite;

    // Key management: fileId => user => wrapped key for that user
    mapping(uint256 => mapping(address => string)) public userWrappedKeys;
    
    // Access timestamps: fileId => user => when access was granted
    mapping(uint256 => mapping(address => uint256)) public accessGrantedAt;
    
    // Access expiration: fileId => user => when access expires (0 = no expiration)
    mapping(uint256 => mapping(address => uint256)) public accessExpiresAt;

    // Track users with access for each file
    mapping(uint256 => address[]) public fileUsersWithAccess;
    mapping(uint256 => mapping(address => uint256)) public userAccessIndex; // Index in the array

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
        uint256 timestamp,
        string metadataCID,
        bool isEncrypted
    );

    event FileUpdated(
        uint256 indexed fileId,
        string newFileHash,
        string newMetadataCID,
        uint256 newSize,
        uint256 timestamp,
        address indexed updatedBy
    );

    event FileDeactivated(uint256 indexed fileId, address indexed deactivatedBy);
    event ReadGranted(uint256 indexed fileId, address indexed grantedTo, uint256 expiresAt);
    event WriteGranted(uint256 indexed fileId, address indexed grantedTo, uint256 expiresAt);
    event AccessRevoked(uint256 indexed fileId, address indexed revokedFrom);
    event KeyShared(uint256 indexed fileId, address indexed sharedWith, string wrappedKey);
    event AccessExpired(uint256 indexed fileId, address indexed user);

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

    modifier hasValidAccess(uint256 _fileId, address _user) {
        require(hasReadAccess(_fileId, _user), "No read access");
        require(!isAccessExpired(_fileId, _user), "Access has expired");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Upload a file hash to the blockchain
     */
    function uploadFileHash(
        string memory _fileHash,
        string memory _fileName,
        uint256 _fileSize,
        string memory _metadataCID,
        bool _isEncrypted,
        string memory _masterKeyHash
    ) public returns (uint256) {
        require(bytes(_fileHash).length > 0, "File hash cannot be empty");
        require(bytes(_fileName).length > 0, "File name cannot be empty");
        require(_fileSize > 0, "File size must be greater than 0");
        require(hashToFileId[_fileHash] == 0, "File with this hash already exists");
        require(bytes(_metadataCID).length > 0, "metadataCID cannot be empty");

        uint256 fileId = nextFileId;
        nextFileId++;

        files[fileId] = FileRecord({
            fileHash: _fileHash,
            fileName: _fileName,
            fileSize: _fileSize,
            uploader: msg.sender,
            timestamp: block.timestamp,
            isActive: true,
            metadataCID: _metadataCID,
            isEncrypted: _isEncrypted,
            masterKeyHash: _masterKeyHash
        });

        userFiles[msg.sender].push(fileId);
        hashToFileId[_fileHash] = fileId;

        // Grant owner full access
        canRead[fileId][msg.sender] = true;
        canWrite[fileId][msg.sender] = true;
        accessGrantedAt[fileId][msg.sender] = block.timestamp;

        emit FileUploaded(fileId, _fileHash, _fileName, msg.sender, block.timestamp, _metadataCID, _isEncrypted);
        return fileId;
    }

    /**
     * @dev Update file metadata (requires write access)
     */
    function updateFile(
        uint256 _fileId,
        string memory _newFileHash,
        uint256 _newFileSize,
        string memory _newMetadataCID
    ) public fileExists(_fileId) {
        require(hasWriteAccess(_fileId, msg.sender), "No write permission");
        require(bytes(_newFileHash).length > 0, "File hash cannot be empty");
        require(_newFileSize > 0, "File size must be > 0");
        require(bytes(_newMetadataCID).length > 0, "metadataCID cannot be empty");

        FileRecord storage file = files[_fileId];
        file.fileHash = _newFileHash;
        file.fileSize = _newFileSize;
        file.metadataCID = _newMetadataCID;
        file.timestamp = block.timestamp;

        emit FileUpdated(_fileId, _newFileHash, _newMetadataCID, _newFileSize, block.timestamp, msg.sender);
    }

    /**
     * @dev Grant read access with optional expiration
     */
    function grantRead(
        uint256 _fileId, 
        address _user, 
        uint256 _expiresAt
    ) public onlyFileOwner(_fileId) fileExists(_fileId) {
        require(_user != address(0), "Invalid user address");
        require(_expiresAt == 0 || _expiresAt > block.timestamp, "Expiration must be in the future");
        
        canRead[_fileId][_user] = true;
        accessGrantedAt[_fileId][_user] = block.timestamp;
        accessExpiresAt[_fileId][_user] = _expiresAt;
        
        // Add user to access tracking if not already there
        if (userAccessIndex[_fileId][_user] == 0) {
            fileUsersWithAccess[_fileId].push(_user);
            userAccessIndex[_fileId][_user] = fileUsersWithAccess[_fileId].length;
        }
        
        emit ReadGranted(_fileId, _user, _expiresAt);
    }

    /**
     * @dev Grant write access with optional expiration
     */
    function grantWrite(
        uint256 _fileId, 
        address _user, 
        uint256 _expiresAt
    ) public onlyFileOwner(_fileId) fileExists(_fileId) {
        require(_user != address(0), "Invalid user address");
        require(_expiresAt == 0 || _expiresAt > block.timestamp, "Expiration must be in the future");
        
        canWrite[_fileId][_user] = true;
        accessGrantedAt[_fileId][_user] = block.timestamp;
        accessExpiresAt[_fileId][_user] = _expiresAt;
        
        // Add user to access tracking if not already there
        if (userAccessIndex[_fileId][_user] == 0) {
            fileUsersWithAccess[_fileId].push(_user);
            userAccessIndex[_fileId][_user] = fileUsersWithAccess[_fileId].length;
        }
        
        emit WriteGranted(_fileId, _user, _expiresAt);
    }

    /**
     * @dev Share encrypted file with user (grants read access + stores wrapped key)
     */
    function shareEncryptedFile(
        uint256 _fileId,
        address _user,
        string memory _wrappedKey,
        uint256 _expiresAt
    ) public onlyFileOwner(_fileId) fileExists(_fileId) {
        require(files[_fileId].isEncrypted, "File is not encrypted");
        require(_user != address(0), "Invalid user address");
        require(_expiresAt == 0 || _expiresAt > block.timestamp, "Expiration must be in the future");
        require(bytes(_wrappedKey).length > 0, "Wrapped key cannot be empty");
        
        // Grant read access
        canRead[_fileId][_user] = true;
        accessGrantedAt[_fileId][_user] = block.timestamp;
        accessExpiresAt[_fileId][_user] = _expiresAt;
        
        // Add user to access tracking if not already there
        if (userAccessIndex[_fileId][_user] == 0) {
            fileUsersWithAccess[_fileId].push(_user);
            userAccessIndex[_fileId][_user] = fileUsersWithAccess[_fileId].length;
        }
        
        // Store wrapped key for this user
        userWrappedKeys[_fileId][_user] = _wrappedKey;
        
        emit ReadGranted(_fileId, _user, _expiresAt);
        emit KeyShared(_fileId, _user, _wrappedKey);
    }

    /**
     * @dev Revoke all access from a user
     */
    function revokeAccess(uint256 _fileId, address _user)
        public onlyFileOwner(_fileId) fileExists(_fileId) {
        canRead[_fileId][_user] = false;
        canWrite[_fileId][_user] = false;
        accessExpiresAt[_fileId][_user] = 0;
        
        // Remove wrapped key
        delete userWrappedKeys[_fileId][_user];
        
        // Remove user from access tracking
        uint256 userIndex = userAccessIndex[_fileId][_user];
        if (userIndex > 0) {
            // Swap with last element and pop
            address[] storage users = fileUsersWithAccess[_fileId];
            if (userIndex <= users.length) {
                address lastUser = users[users.length - 1];
                users[userIndex - 1] = lastUser;
                userAccessIndex[_fileId][lastUser] = userIndex;
                users.pop();
                delete userAccessIndex[_fileId][_user];
            }
        }
        
        emit AccessRevoked(_fileId, _user);
    }

    /**
     * @dev Deactivate a file (soft delete)
     */
    function deactivateFile(uint256 _fileId)
        public onlyFileOwner(_fileId) fileExists(_fileId) {
        files[_fileId].isActive = false;
        emit FileDeactivated(_fileId, msg.sender);
    }

    /**
     * @dev Get wrapped key for encrypted file (requires read access)
     */
    function getWrappedKey(uint256 _fileId) 
        public view hasValidAccess(_fileId, msg.sender) returns (string memory) {
        require(files[_fileId].isEncrypted, "File is not encrypted");
        string memory wrappedKey = userWrappedKeys[_fileId][msg.sender];
        require(bytes(wrappedKey).length > 0, "No wrapped key found for user");
        return wrappedKey;
    }

    /**
     * @dev Check if user's access has expired
     */
    function isAccessExpired(uint256 _fileId, address _user) public view returns (bool) {
        uint256 expiresAt = accessExpiresAt[_fileId][_user];
        return expiresAt > 0 && expiresAt <= block.timestamp;
    }

    /**
     * @dev Get access information for a user
     */
    function getAccessInfo(uint256 _fileId, address _user) public view returns (
        bool hasRead,
        bool hasWrite,
        uint256 grantedAt,
        uint256 expiresAt,
        bool expired
    ) {
        hasRead = canRead[_fileId][_user];
        hasWrite = canWrite[_fileId][_user];
        grantedAt = accessGrantedAt[_fileId][_user];
        expiresAt = accessExpiresAt[_fileId][_user];
        expired = isAccessExpired(_fileId, _user);
    }

    /**
     * @dev Getters
     */
    function getFileInfo(uint256 _fileId)
        public view fileExists(_fileId)
        returns (
            string memory fileHash,
            string memory fileName,
            uint256 fileSize,
            address uploader,
            uint256 timestamp,
            bool isActive,
            string memory metadataCID,
            bool isEncrypted,
            string memory masterKeyHash
        )
    {
        FileRecord memory file = files[_fileId];
        return (
            file.fileHash,
            file.fileName,
            file.fileSize,
            file.uploader,
            file.timestamp,
            file.isActive,
            file.metadataCID,
            file.isEncrypted,
            file.masterKeyHash
        );
    }

    function getUserFiles(address _user) public view returns (uint256[] memory) {
        return userFiles[_user];
    }

    function hasReadAccess(uint256 _fileId, address _user) public view returns (bool) {
        return (files[_fileId].uploader == _user || canRead[_fileId][_user]) && 
               !isAccessExpired(_fileId, _user);
    }

    function hasWriteAccess(uint256 _fileId, address _user) public view returns (bool) {
        return (files[_fileId].uploader == _user || canWrite[_fileId][_user]) && 
               !isAccessExpired(_fileId, _user);
    }

    function getTotalFiles() public view returns (uint256) {
        return nextFileId - 1;
    }

    /**
     * @dev Get all users who have access to a specific file
     * Returns addresses that have been explicitly granted read or write access
     */
    function getUsersWithAccess(uint256 _fileId) public view fileExists(_fileId) returns (address[] memory) {
        return fileUsersWithAccess[_fileId];
    }
}
