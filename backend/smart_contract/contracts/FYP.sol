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
        string metadataCID;     // Always points to latest metadata.json
        bool isEncrypted;       // Whether the file is encrypted
        string masterKeyHash;   // Hash of the master encryption key
        uint256 versionCount;   // Number of versions
    }

    mapping(uint256 => FileRecord) public files;
    mapping(address => uint256[]) public userFiles;
    mapping(string => uint256) public hashToFileId;
    mapping(string => uint256) public metadataToFileId; // Maps metadata CID to file ID

    // version history: fileId => list of metadataCIDs
    mapping(uint256 => string[]) public fileVersions;

    // permissions
    mapping(uint256 => mapping(address => bool)) public canRead;
    mapping(uint256 => mapping(address => bool)) public canWrite;

    // wrapped keys per user
    mapping(uint256 => mapping(address => string)) public userWrappedKeys;

    // access management
    mapping(uint256 => mapping(address => uint256)) public accessGrantedAt;
    mapping(uint256 => mapping(address => uint256)) public accessExpiresAt;

    // track users with access
    mapping(uint256 => address[]) public fileUsersWithAccess;
    mapping(uint256 => mapping(address => uint256)) public userAccessIndex;

    uint256 public nextFileId = 1;
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
        uint256 version,
        uint256 timestamp,
        address indexed updatedBy
    );

    event FileVersioned(
        uint256 indexed fileId,
        string oldCID,
        string newCID,
        uint256 version,
        uint256 timestamp,
        address indexed updatedBy
    );

    event FileRolledBack(uint256 indexed fileId, string restoredCID, uint256 version, address indexed restoredBy);
    event FileDeactivated(uint256 indexed fileId, address indexed deactivatedBy);
    event ReadGranted(uint256 indexed fileId, address indexed grantedTo, uint256 expiresAt);
    event WriteGranted(uint256 indexed fileId, address indexed grantedTo, uint256 expiresAt);
    event AccessRevoked(uint256 indexed fileId, address indexed revokedFrom);
    event KeyShared(uint256 indexed fileId, address indexed sharedWith, string wrappedKey);

    constructor() {
        owner = msg.sender;
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
        _;
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
        require(bytes(_metadataCID).length > 0, "metadataCID cannot be empty");
        require(hashToFileId[_fileHash] == 0, "File with this hash already exists");

        uint256 fileId = nextFileId++;
        files[fileId] = FileRecord({
            fileHash: _fileHash,
            fileName: _fileName,
            fileSize: _fileSize,
            uploader: msg.sender,
            timestamp: block.timestamp,
            isActive: true,
            metadataCID: _metadataCID,
            isEncrypted: _isEncrypted,
            masterKeyHash: _masterKeyHash,
            versionCount: 1
        });

        userFiles[msg.sender].push(fileId);
        hashToFileId[_fileHash] = fileId;
        metadataToFileId[_metadataCID] = fileId;

        // init version history
        fileVersions[fileId].push(_metadataCID);

        // owner full access
        canRead[fileId][msg.sender] = true;
        canWrite[fileId][msg.sender] = true;
        accessGrantedAt[fileId][msg.sender] = block.timestamp;

        emit FileUploaded(fileId, _fileHash, _fileName, msg.sender, block.timestamp, _metadataCID, _isEncrypted);
        return fileId;
    }

    /**
     * @dev Update file metadata (creates a new version)
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
        string memory oldCID = file.metadataCID;

        // Update the metadataToFileId mapping for the new metadata CID
        metadataToFileId[_newMetadataCID] = _fileId;

        file.fileHash = _newFileHash;
        file.fileSize = _newFileSize;
        file.metadataCID = _newMetadataCID;
        file.timestamp = block.timestamp;
        file.versionCount++;

        fileVersions[_fileId].push(_newMetadataCID);

        emit FileUpdated(_fileId, _newFileHash, _newMetadataCID, _newFileSize, file.versionCount, block.timestamp, msg.sender);
        emit FileVersioned(_fileId, oldCID, _newMetadataCID, file.versionCount, block.timestamp, msg.sender);
    }

    /**
     * @dev Rollback to a previous version
     */
    function rollbackFile(uint256 _fileId, uint256 _versionIndex) public fileExists(_fileId) onlyFileOwner(_fileId) {
        require(_versionIndex < fileVersions[_fileId].length, "Invalid version index");

        string memory restoreCID = fileVersions[_fileId][_versionIndex];
        files[_fileId].metadataCID = restoreCID;
        files[_fileId].timestamp = block.timestamp;

        emit FileRolledBack(_fileId, restoreCID, _versionIndex + 1, msg.sender);
    }

    function getFileVersions(uint256 _fileId) public view fileExists(_fileId) returns (string[] memory) {
        return fileVersions[_fileId];
    }

    /**
     * @dev Grant read access with optional expiration
     */
    function grantRead(uint256 _fileId, address _user, uint256 _expiresAt) public onlyFileOwner(_fileId) fileExists(_fileId) {
        require(_user != address(0), "Invalid user address");
        require(_expiresAt == 0 || _expiresAt > block.timestamp, "Expiration must be in the future");

        canRead[_fileId][_user] = true;
        accessGrantedAt[_fileId][_user] = block.timestamp;
        accessExpiresAt[_fileId][_user] = _expiresAt;

        if (userAccessIndex[_fileId][_user] == 0) {
            fileUsersWithAccess[_fileId].push(_user);
            userAccessIndex[_fileId][_user] = fileUsersWithAccess[_fileId].length;
        }

        emit ReadGranted(_fileId, _user, _expiresAt);
    }

    /**
     * @dev Grant write access with optional expiration
     */
    function grantWrite(uint256 _fileId, address _user, uint256 _expiresAt) public onlyFileOwner(_fileId) fileExists(_fileId) {
        require(_user != address(0), "Invalid user address");
        require(_expiresAt == 0 || _expiresAt > block.timestamp, "Expiration must be in the future");

        canWrite[_fileId][_user] = true;
        accessGrantedAt[_fileId][_user] = block.timestamp;
        accessExpiresAt[_fileId][_user] = _expiresAt;

        if (userAccessIndex[_fileId][_user] == 0) {
            fileUsersWithAccess[_fileId].push(_user);
            userAccessIndex[_fileId][_user] = fileUsersWithAccess[_fileId].length;
        }

        emit WriteGranted(_fileId, _user, _expiresAt);
    }

    /**
     * @dev Share encrypted file with wrapped key
     */
    function shareEncryptedFile(uint256 _fileId, address _user, string memory _wrappedKey, uint256 _expiresAt)
        public onlyFileOwner(_fileId) fileExists(_fileId) {
        require(files[_fileId].isEncrypted, "File is not encrypted");
        require(_user != address(0), "Invalid user address");
        require(bytes(_wrappedKey).length > 0, "Wrapped key cannot be empty");

        canRead[_fileId][_user] = true;
        accessGrantedAt[_fileId][_user] = block.timestamp;
        accessExpiresAt[_fileId][_user] = _expiresAt;

        if (userAccessIndex[_fileId][_user] == 0) {
            fileUsersWithAccess[_fileId].push(_user);
            userAccessIndex[_fileId][_user] = fileUsersWithAccess[_fileId].length;
        }

        userWrappedKeys[_fileId][_user] = _wrappedKey;

        emit ReadGranted(_fileId, _user, _expiresAt);
        emit KeyShared(_fileId, _user, _wrappedKey);
    }

    /**
     * @dev Revoke all access from a user
     */
    function revokeAccess(uint256 _fileId, address _user) public onlyFileOwner(_fileId) fileExists(_fileId) {
        canRead[_fileId][_user] = false;
        canWrite[_fileId][_user] = false;
        accessExpiresAt[_fileId][_user] = 0;
        delete userWrappedKeys[_fileId][_user];

        uint256 userIndex = userAccessIndex[_fileId][_user];
        if (userIndex > 0) {
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

    function deactivateFile(uint256 _fileId) public onlyFileOwner(_fileId) fileExists(_fileId) {
        files[_fileId].isActive = false;
        emit FileDeactivated(_fileId, msg.sender);
    }

    function getWrappedKey(uint256 _fileId) public view hasValidAccess(_fileId, msg.sender) returns (string memory) {
        require(files[_fileId].isEncrypted, "File is not encrypted");
        string memory wrappedKey = userWrappedKeys[_fileId][msg.sender];
        require(bytes(wrappedKey).length > 0, "No wrapped key found for user");
        return wrappedKey;
    }

    function isAccessExpired(uint256 _fileId, address _user) public view returns (bool) {
        uint256 expiresAt = accessExpiresAt[_fileId][_user];
        return expiresAt > 0 && expiresAt <= block.timestamp;
    }

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

    // --- Getters ---
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
            string memory masterKeyHash,
            uint256 versionCount
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
            file.masterKeyHash,
            file.versionCount
        );
    }

    function getUserFiles(address _user) public view returns (uint256[] memory) {
        return userFiles[_user];
    }

    function hasReadAccess(uint256 _fileId, address _user) public view returns (bool) {
        return (files[_fileId].uploader == _user || canRead[_fileId][_user]) && !isAccessExpired(_fileId, _user);
    }

    function hasWriteAccess(uint256 _fileId, address _user) public view returns (bool) {
        return (files[_fileId].uploader == _user || canWrite[_fileId][_user]) && !isAccessExpired(_fileId, _user);
    }

    function getTotalFiles() public view returns (uint256) {
        return nextFileId - 1;
    }

    function getUsersWithAccess(uint256 _fileId) public view fileExists(_fileId) returns (address[] memory) {
        return fileUsersWithAccess[_fileId];
    }
}
