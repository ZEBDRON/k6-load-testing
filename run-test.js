// run-test.js
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

try {
  const { stdout } = await execAsync("k6 run browser_test.js");
  const match = stdout.match(/CONTAINER_ID: (.*)/);
  if (!match) throw new Error("No Container ID found");

  const containerId = match[1].trim();
  console.log(`Launching Playwright with Container ID: ${containerId}`);

  const { stdout: pwOut } = await execAsync(
    `node open-editor.js "${containerId}"`
  );
  console.log(pwOut);
} catch (err) {
  console.error("Error:", err.message);
}
