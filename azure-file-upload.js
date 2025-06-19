import http from "k6/http";
import { check } from "k6";
import crypto from "k6/crypto";

// const sasToken =
//   "";

// ✅ Use open() in init context
const solutionFiles = {
  java: open("./code_solutions/java/Main.java", "b"), // Load the file as binary
  react: open("./code_solutions/react/App.js", "b"), // Load the file as binary
};

export function uploadFile(
  accountName,
  shareName,
  remoteFilePath,
  problemId,
  sasToken
) {
  console.log(
    `Uploading file for account: ${accountName}, share: ${shareName}, path: ${remoteFilePath}, problemId: ${problemId}`
  );
  const fileData = solutionFiles[problemId];
  let file;
  file = new Uint8Array(fileData); // Convert to Uint8Array if needed
  console.log(`File size: ${file.length} bytes`);
  const baseUrl = `https://${accountName}.file.core.windows.net/${shareName}/${remoteFilePath}?${sasToken}`;

  console.log(`Base URL: ${baseUrl}`);

  // Step 1: Create empty file (set file length = content length)
  const createFileRes = http.put(baseUrl, null, {
    headers: {
      "x-ms-type": "File",
      "x-ms-content-length": file.length.toString(),
      "x-ms-version": "2022-11-02",
    },
  });

  console.log(createFileRes.status, createFileRes.body);

  check(createFileRes, {
    "✅ File created": (res) => res.status === 201,
  });

  // Step 2: Upload content using range
  const uploadRes = http.put(`${baseUrl}&comp=range`, file, {
    headers: {
      "x-ms-write": "update",
      "x-ms-range": `bytes=0-${file.length - 1}`,
      "Content-Type": "application/octet-stream",
      "x-ms-version": "2022-11-02",
    },
  });

  console.log(uploadRes.status, uploadRes.body);

  check(uploadRes, {
    "✅ Range uploaded": (res) => res.status === 201,
  });
}

export function generateMD5(input) {
  return crypto.md5(input, "hex");
}

export default function () {
  const AZURE_STORAGE_ACCOUNT_NAME = "your_storage_account_name";
  const AZURE_REMOTE_FILE_PATH = "project/src/main/java/Main.java"; // The file path in the file share

  // Example usage
  const fileShareName = generateMD5("sebin@geektrust.in");
  const problemId = "travelCost"; // Use the key from solutionFiles
  const sasToken = "";
  uploadFile(
    AZURE_STORAGE_ACCOUNT_NAME,
    fileShareName,
    AZURE_REMOTE_FILE_PATH,
    problemId,
    sasToken
  );
  console.log(
    `File uploaded successfully to ${AZURE_STORAGE_ACCOUNT_NAME}/${fileShareName}/${AZURE_REMOTE_FILE_PATH}`
  );
}
