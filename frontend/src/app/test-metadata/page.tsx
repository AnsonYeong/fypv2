"use client";

import { useState } from "react";
import {
  generateSHA256,
  generateSalt,
  generateIV,
  wrapKeyWithPassword,
  unwrapKeyWithPassword,
  createFileMetadata,
  validateMetadata,
  exportMetadata,
  importMetadata,
  FileMetadata,
} from "@/lib/metadata";

export default function TestMetadataPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [metadataJson, setMetadataJson] = useState("");
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  // Test basic functions
  const testBasicFunctions = () => {
    try {
      // Test SHA-256
      const hash = generateSHA256("Hello World!");
      addTestResult(`✅ SHA-256: ${hash.substring(0, 16)}...`);

      // Test salt generation
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      addTestResult(`✅ Salt 1: ${salt1.substring(0, 16)}...`);
      addTestResult(`✅ Salt 2: ${salt2.substring(0, 16)}...`);
      addTestResult(`✅ Salts different: ${salt1 !== salt2}`);

      // Test IV generation
      const iv1 = generateIV();
      const iv2 = generateIV();
      addTestResult(`✅ IV 1: ${iv1.substring(0, 16)}...`);
      addTestResult(`✅ IV 2: ${iv2.substring(0, 16)}...`);
      addTestResult(`✅ IVs different: ${iv1 !== iv2}`);

      // Test key wrapping
      const originalKey =
        "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
      const wrappedKey = wrapKeyWithPassword(
        originalKey,
        "test-password",
        salt1
      );
      addTestResult(`✅ Key wrapped: ${wrappedKey.substring(0, 16)}...`);

      const unwrappedKey = unwrapKeyWithPassword(
        wrappedKey,
        "test-password",
        salt1
      );
      addTestResult(
        `✅ Key unwrapped: ${
          unwrappedKey === originalKey ? "✅ Match" : "❌ Mismatch"
        }`
      );
    } catch (error) {
      addTestResult(`❌ Error: ${error}`);
    }
  };

  // Generate metadata for selected file
  const generateMetadata = async () => {
    if (!selectedFile || !password) {
      addTestResult("❌ Please select a file and enter a password");
      return;
    }

    try {
      addTestResult("🔄 Generating metadata...");

      // Create a mock encrypted file (in real app, this would be the actual encrypted file)
      const encryptedContent = `ENCRYPTED_${selectedFile.name}_${Date.now()}`;
      const encryptedFile = new File(
        [encryptedContent],
        `${selectedFile.name}.encrypted`,
        {
          type: "application/octet-stream",
        }
      );

      // Generate a mock encryption key
      const encryptionKey =
        "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
      const iv = generateIV();

      // Create metadata
      const generatedMetadata = await createFileMetadata(
        selectedFile,
        encryptedFile,
        "QmMockFileHash123", // Mock IPFS CID
        encryptionKey,
        iv,
        password,
        "0x1234567890123456789012345678901234567890", // Mock uploader address
        "0xContractAddress123" // Mock contract address
      );

      addTestResult("✅ Metadata generated successfully!");

      // Debug: Check metadata object immediately after generation
      addTestResult(`🔍 Debug - Metadata object check:`);
      addTestResult(`  - Has integrity: ${!!generatedMetadata.integrity}`);
      addTestResult(
        `  - Has metadataHash: ${!!generatedMetadata.integrity.metadataHash}`
      );
      addTestResult(
        `  - metadataHash value: "${generatedMetadata.integrity.metadataHash}"`
      );
      addTestResult(
        `  - metadataHash length: ${generatedMetadata.integrity.metadataHash.length}`
      );

      // Debug: Log the entire metadata object
      console.log("🔍 Full Generated Metadata:", generatedMetadata);
      console.log("🔍 Integrity Section:", generatedMetadata.integrity);

      // Set state
      setMetadata(generatedMetadata);
      addTestResult("✅ Metadata set to state");

      // Export to JSON
      const json = exportMetadata(generatedMetadata);
      setMetadataJson(json);
      addTestResult("✅ Metadata exported to JSON");

      // Debug: Check what's in the JSON
      console.log("🔍 Exported JSON:", json);
      const parsedJson = JSON.parse(json);
      console.log("🔍 Parsed JSON integrity:", parsedJson.integrity);

      // Debug: Check metadata before validation
      addTestResult("🔍 Pre-validation check:");
      addTestResult(
        `  - metadataHash exists: ${!!generatedMetadata.integrity.metadataHash}`
      );
      addTestResult(
        `  - metadataHash value: "${generatedMetadata.integrity.metadataHash}"`
      );
      addTestResult(
        `  - metadataHash length: ${generatedMetadata.integrity.metadataHash.length}`
      );

      // CRITICAL: Check if the object is being mutated
      addTestResult("🔍 CRITICAL - Object reference check:");
      addTestResult(
        `  - metadataHash before validation: "${generatedMetadata.integrity.metadataHash}"`
      );
      addTestResult(
        `  - Object keys: ${Object.keys(generatedMetadata.integrity).join(
          ", "
        )}`
      );
      addTestResult(
        `  - integrity object type: ${typeof generatedMetadata.integrity}`
      );

      // Validate metadata
      const isValid = validateMetadata(generatedMetadata);
      addTestResult(`✅ Metadata validation: ${isValid ? "PASS" : "FAIL"}`);

      // CRITICAL: Check if object was modified during validation
      addTestResult("🔍 CRITICAL - Post-validation check:");
      addTestResult(
        `  - metadataHash after validation: "${generatedMetadata.integrity.metadataHash}"`
      );
      addTestResult(
        `  - Was object modified? ${
          generatedMetadata.integrity.metadataHash === ""
            ? "YES - Object was modified!"
            : "NO - Object preserved"
        }`
      );

      // Debug: Show metadata hash after validation
      addTestResult(
        `🔍 Post-validation metadataHash: ${generatedMetadata.integrity.metadataHash}`
      );

      // Debug: Show validation details
      if (!isValid) {
        addTestResult("🔍 Validation failed - checking hash calculation...");
        addTestResult(
          `🔍 Current metadataHash: "${generatedMetadata.integrity.metadataHash}"`
        );

        // Create a copy for hash calculation WITHOUT modifying the original
        // Use structuredClone for safe deep copying (modern browsers)
        const metadataForHash = structuredClone
          ? structuredClone(generatedMetadata)
          : JSON.parse(JSON.stringify(generatedMetadata));
        metadataForHash.integrity.metadataHash = "";

        const metadataString = JSON.stringify(
          metadataForHash,
          Object.keys(metadataForHash).sort()
        );
        const calculatedHash = generateSHA256(metadataString);
        addTestResult(`🔍 Calculated Hash: ${calculatedHash}`);
        addTestResult(
          `🔍 Stored Hash: ${generatedMetadata.integrity.metadataHash}`
        );
        addTestResult(
          `🔍 Hash Match: ${
            calculatedHash === generatedMetadata.integrity.metadataHash
          }`
        );
      }
    } catch (error) {
      addTestResult(`❌ Error generating metadata: ${error}`);
    }
  };

  // Test import/export
  const testImportExport = () => {
    if (!metadataJson) {
      addTestResult("❌ No metadata JSON to test");
      return;
    }

    try {
      const imported = importMetadata(metadataJson);
      addTestResult("✅ Metadata imported successfully");
      addTestResult(`✅ Imported version: ${imported.version}`);
      addTestResult(`✅ Imported filename: ${imported.fileInfo.originalName}`);

      // Validate imported metadata
      const isValid = validateMetadata(imported);
      addTestResult(
        `✅ Imported metadata validation: ${isValid ? "PASS" : "FAIL"}`
      );
    } catch (error) {
      addTestResult(`❌ Import error: ${error}`);
    }
  };

  // Download metadata.json file
  const downloadMetadata = () => {
    if (!metadataJson) {
      addTestResult("❌ No metadata JSON to download");
      return;
    }

    try {
      const blob = new Blob([metadataJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `metadata-${selectedFile?.name || "file"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addTestResult("✅ Metadata.json downloaded successfully!");
    } catch (error) {
      addTestResult(`❌ Download error: ${error}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🧪 Test Metadata Generation</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">📁 File Selection</h2>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full p-2 border rounded"
            />
            {selectedFile && (
              <div className="mt-2 text-sm text-gray-600">
                Selected: {selectedFile.name} ({selectedFile.size} bytes)
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">🔐 Password</h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password for key wrapping"
              className="w-full p-2 border rounded"
            />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">🧪 Test Functions</h2>
            <div className="space-y-2">
              <button
                onClick={testBasicFunctions}
                className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Test Basic Functions
              </button>
              <button
                onClick={generateMetadata}
                disabled={!selectedFile || !password}
                className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
              >
                Generate Metadata
              </button>
              <button
                onClick={testImportExport}
                disabled={!metadataJson}
                className="w-full p-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
              >
                Test Import/Export
              </button>
              <button
                onClick={downloadMetadata}
                disabled={!metadataJson}
                className="w-full p-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
              >
                Download Metadata.json
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">📊 Test Results</h2>
            <div className="bg-gray-100 p-4 rounded max-h-64 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-500">
                  No test results yet. Run some tests to see results here.
                </p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono mb-1">
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>

          {metadata && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">
                📋 Generated Metadata
              </h2>
              <div className="bg-gray-100 p-4 rounded max-h-64 overflow-y-auto">
                <pre className="text-xs">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {metadataJson && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">📄 Metadata JSON</h2>
              <div className="bg-gray-100 p-4 rounded max-h-64 overflow-y-auto">
                <pre className="text-xs">{metadataJson}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
