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
        string metadataCID
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
    event ReadGranted(uint256 indexed fileId, address indexed grantedTo);
    event WriteGranted(uint256 indexed fileId, address indexed grantedTo);
    event AccessRevoked(uint256 indexed fileId, address indexed revokedFrom);

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
     */
    function uploadFileHash(
        string memory _fileHash,
        string memory _fileName,
        uint256 _fileSize,
        string memory _metadataCID
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
            metadataCID: _metadataCID
        });

        userFiles[msg.sender].push(fileId);
        hashToFileId[_fileHash] = fileId;

        // Grant owner full access
        canRead[fileId][msg.sender] = true;
        canWrite[fileId][msg.sender] = true;

        emit FileUploaded(fileId, _fileHash, _fileName, msg.sender, block.timestamp, _metadataCID);
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
     * @dev Grant read access
     */
    function grantRead(uint256 _fileId, address _user)
        public
        onlyFileOwner(_fileId)
        fileExists(_fileId)
    {
        canRead[_fileId][_user] = true;
        emit ReadGranted(_fileId, _user);
    }

    /**
     * @dev Grant write access
     */
    function grantWrite(uint256 _fileId, address _user)
        public
        onlyFileOwner(_fileId)
        fileExists(_fileId)
    {
        canWrite[_fileId][_user] = true;
        emit WriteGranted(_fileId, _user);
    }

    /**
     * @dev Revoke all access from a user
     */
    function revokeAccess(uint256 _fileId, address _user)
        public
        onlyFileOwner(_fileId)
        fileExists(_fileId)
    {
        canRead[_fileId][_user] = false;
        canWrite[_fileId][_user] = false;
        emit AccessRevoked(_fileId, _user);
    }

    /**
     * @dev Deactivate a file (soft delete)
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
     * @dev Getters
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
            bool isActive,
            string memory metadataCID
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
            file.metadataCID
        );
    }

    function getUserFiles(address _user) public view returns (uint256[] memory) {
        return userFiles[_user];
    }

    function hasReadAccess(uint256 _fileId, address _user) public view returns (bool) {
        return files[_fileId].uploader == _user || canRead[_fileId][_user];
    }

    function hasWriteAccess(uint256 _fileId, address _user) public view returns (bool) {
        return files[_fileId].uploader == _user || canWrite[_fileId][_user];
    }

    function getTotalFiles() public view returns (uint256) {
        return nextFileId - 1;
    }
}
