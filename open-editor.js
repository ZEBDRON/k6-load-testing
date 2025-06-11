import http from "k6/http";

const LOCAL_EDITOR_URL = "https://qa-interview.geektrust.in/vscode";

export default async function () {
  const ideResponse = {
    status: "Running",
    id: "3188f316802098a5a4c0534e3b75ce04",
  }; // Simulated response from the IDE API
  const response = http.post(
    "http://localhost:8000/set-editor-url", // Adjust the endpoint as needed
    JSON.stringify({
      ideUrl: `${LOCAL_EDITOR_URL}/${ideResponse.id}/`,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  // Check if the response is OK
  if (!response.status || response.status !== 200) {
    throw new Error(`Failed to set container ID: ${response.statusText}`);
  }
  console.log("✅ Container ID set successfully");
  console.log("🚀 Launching Playwright with Url:");
  const res = http.get(`http://localhost:8000/get-editor-url`);
  if (res.status !== 200) {
    throw new Error(`Failed to get container ID: ${res.status}`);
  }
  const data = JSON.parse(res.body);
  console.log("Container ID:", data.ideUrl);
  console.log("✅ Done");
}
