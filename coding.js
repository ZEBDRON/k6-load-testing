import http from "k6/http";
import { check } from "k6";
import moment from "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import encoding from "k6/encoding";
import { sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { SharedArray } from "k6/data";
import { browser } from "k6/browser";
import { uploadFile, generateMD5 } from "./azure-file-upload.js";
import {
  createInvitation,
  createSession,
  uploadTranscript,
  getAuthToken,
  parseLoginUrl,
  parseFullLoginUrl,
  getFullLoginUrl,
  handleResponse,
  createConversation,
  sendMessage,
  ApiClient,
} from "./theory.js";

export const options = {
  scenarios: {
    parallel_requests: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "45m",
      options: {
        browser: {
          type: "chromium",
        },
      },
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
  noConnectionReuse: true,
};

const PROBLEM_LANGUAGE = "Java";

const VOICE_FILE_PATH = "voice_files";
const voiceFiles = {
  first: open(`${VOICE_FILE_PATH}/1.wav`, "b"),
  second: open(`${VOICE_FILE_PATH}/2.wav`, "b"),
  third: open(`${VOICE_FILE_PATH}/3.wav`, "b"),
  fourth: open(`${VOICE_FILE_PATH}/4.wav`, "b"),
  skip: open(`${VOICE_FILE_PATH}/skip.wav`, "b"),
};

const APPROACH_ITER = 3; // Number of iterations for the approach phase

// File metadata in SharedArray
const INTERVIEW_ITER = new SharedArray("interview_iterations", function () {
  return [
    { key: "first", delay: [35, 50] },
    { key: "skip", delay: [7, 10] },
    { key: "second", delay: [35, 50] },
    { key: "skip", delay: [7, 10] },
    { key: "third", delay: [35, 50] },
    { key: "skip", delay: [7, 10] },
    { key: "fourth", delay: [35, 50] },
    { key: "skip", delay: [7, 10] },
  ];
});

const AZURE_REMOTE_FILE_PATH = "project/src/main/java/Main.java"; // The file path in the file share

const LOCAL_USER = "http://localhost:9024";
const LOCAL_INTERVIEW = "http://localhost:9025";
const LOCAL_IDE = "http://localhost:9026";
const LOCAL_EDITOR_URL = "http://localhost:9026/vscode";
const AZURE_STORAGE_ACCOUNT_NAME = "codeserverstoragedev";

// const LOCAL_USER = "https://qa-interview.geektrust.in/userservice";
// const LOCAL_INTERVIEW = "https://qa-interview.geektrust.in/interviewservice";
// const LOCAL_IDE = "https://qa-interview.geektrust.in/ideservice";
// const LOCAL_EDITOR_URL = "https://qa-interview.geektrust.in/vscode";
// const AZURE_STORAGE_ACCOUNT_NAME = "codeserverstorageqa";

// const LOCAL_USER = "https://interview.geektrust.com/userservice";
// const LOCAL_INTERVIEW = "https://interview.geektrust.com/interviewservice";
// const LOCAL_IDE = "https://interview.geektrust.com/ideservice";
// const LOCAL_EDITOR_URL = "https://interview.geektrust.com/vscode";
// const AZURE_STORAGE_ACCOUNT_NAME = "codeserverstorageaccount";

const SAS_TOKEN = "";
const BASE_URL = `${LOCAL_USER}`;
const COMMON_HEADERS = {
  "Content-Type": "application/json",
};

// ----------------------------
// TEST ACTIONS
// ----------------------------

export function getProblemStatement(apiClient, email, loginCode, invitationId) {
  const url = `/api/v1/problem`;
  sleep(randomIntBetween(3, 6));
  const res = apiClient.get(url);
  handleResponse(res, "Problem");
  check(res, {
    "[Problem] Status 200": (r) => r.status === 200,
  });

  return res.json();
}

export function getIDE(apiClient) {
  const url = `/api/v1/ide?language=${PROBLEM_LANGUAGE}`;
  sleep(randomIntBetween(3, 6));
  const res = apiClient.get(url);
  handleResponse(res, "IDE");
  check(res, {
    "[IDE] Status 200": (r) => r.status === 200,
  });

  return res.json();
}

function getSession(apiClient) {
  const url = `/api/v1/session`;
  sleep(randomIntBetween(3, 6));
  const res = apiClient.get(url);
  handleResponse(res, "Session");
  check(res, {
    "[Session] Status 200": (r) => r.status === 200,
  });

  return res.json();
}

// ----------------------------
// MAIN EXECUTION FLOW
// ----------------------------
export default function () {
  let userAPI = new ApiClient(BASE_URL, COMMON_HEADERS);
  // 1. Create invitation and get login URL
  const loginUrl = createInvitation(userAPI, "coffee-beans-jsr-fd8e2be9");
  console.log("Received login URL:", loginUrl);
  sleep(2);
  //   2. Parse login URL parameters
  const params = parseLoginUrl(loginUrl);
  if (!params) {
    throw new Error("Failed to parse login URL parameters");
  }

  console.log("Parsed parameters:", JSON.stringify(params, null, 2));

  // 3. Perform login with extracted parameters
  const fullLoginUrl = getFullLoginUrl(
    userAPI,
    params.shortCode,
    params.loginCode
  );
  console.log("Login successful. Url:", fullLoginUrl);
  sleep(2);

  const nParams = parseFullLoginUrl(fullLoginUrl);
  if (!nParams) {
    throw new Error("Failed to parse full login URL parameters");
  }

  console.log("Parsed parameters:", JSON.stringify(nParams, null, 2));

  const authToken = getAuthToken(
    userAPI,
    nParams.email,
    nParams.loginCode,
    nParams.invitationId
  );
  // 4. Update headers for authenticated requests
  COMMON_HEADERS["Authorization"] = `Bearer ${authToken}`;
  sleep(2);

  const interviewAPI = new ApiClient(LOCAL_INTERVIEW, COMMON_HEADERS);

  createSession(interviewAPI);
  sleep(5);
  createConversation(interviewAPI);
  sleep(5);
  sendMessage(interviewAPI, "Let's start");
  sleep(5);
  getProblemStatement(interviewAPI);
  //   sleep(300); //Candidate understands the problem statement
  sleep(5);
  sendMessage(interviewAPI, "I understand");
  sleep(5);
  sendMessage(
    interviewAPI,
    "I will start by modeling the domain entities. Define an enum Destination to represent valid destinations (PARIS, TOKYO, CAIRO) along with their respective one-way ticket costs. Create another enum TripType to represent the trip type (ROUND, ONE_WAY), and include a cost multiplier method (e.g., 2x for round trips). Implement a TravelCostCalculator class that takes in the number of travelers, destination, and trip type, and performs the core logic to compute the total cost using these enums. The main class (TravelCostApp) should handle parsing and validating the command-line input, converting strings to enums in a case-insensitive way, handling invalid inputs gracefully using exceptions or fallback messages, and then invoking the calculator to output the result in the required format. Use helper methods to encapsulate input validation and parsing to keep the main method clean and readable. This modular approach not only ensures clarity and testability but also adheres to single-responsibility and open/closed principles."
  );
  //   sleep(15); // Time to load the code editor
  sleep(5);
  sendMessage(
    interviewAPI,
    `I will handle invalid inputs by first checking if the entered destination or trip type matches any of the expected values. For example, I would compare the input destination string against a list or set of valid destinations like "Paris", "Tokyo", and "Cairo", ignoring case if needed. Similarly, I would check if the trip type is either "round" or "one-way". If the input doesn’t match any of these, I would print an error message like "Invalid destination" or "Invalid trip type" and stop the program using System.exit(1) or return early.`
  );
  sleep(5);
  for (let i = 0; i < APPROACH_ITER; i++) {
    console.log(`Approach Iteration: ${i + 1} of ${APPROACH_ITER}`);
    const session = getSession(interviewAPI);
    console.log("Session: ====", JSON.stringify(session));
    if (session.driverBot === "TaskRunnerBot") {
      sendMessage(interviewAPI, "Start Coding");
      break;
    } else {
      sendMessage(
        interviewAPI,
        "I don't know. proceed to the first coding task"
      );
    }
  }
  sleep(10);
  // sleep(30); // Candidate writes code
  //Checking if the code editor is loaded
  const MAX_RETRIES = 10;
  const RETRY_INTERVAL_SECONDS = 3;
  const ideAPI = new ApiClient(LOCAL_IDE, COMMON_HEADERS);
  let ideResponse = null;
  let retries = 0;
  // Wait until ideResponse is not null/empty, with a max retry limit
  while (!ideResponse && retries < MAX_RETRIES) {
    ideResponse = getIDE(ideAPI);
    if (ideResponse) {
      break;
    }
    console.log(
      `IDE response not ready, retrying... (${retries + 1}/${MAX_RETRIES})`
    );
    sleep(RETRY_INTERVAL_SECONDS);
    retries++;
  }
  if (!ideResponse) {
    console.warn("IDE response still not available after retries. Skipping.");
    return;
  }
  console.log("IDE Response: ====", JSON.stringify(ideResponse));
  (async () => {
    const context = await browser.newContext();
    await context.grantPermissions(["camera", "microphone"]);
    const page = await context.newPage();
    await page.goto(LOCAL_EDITOR_URL);

    browser.closeContext(context);
  })();
  sleep(5);

  const fileShareName = generateMD5(nParams.email);
  uploadFile(
    AZURE_STORAGE_ACCOUNT_NAME,
    fileShareName,
    AZURE_REMOTE_FILE_PATH,
    "travelCost",
    SAS_TOKEN
  );
  sleep(15);
  const reviewResults = sendMessage(interviewAPI, "Review Code");
  console.log("Review Results: ====", JSON.stringify(reviewResults));
  sleep(5);
  if (reviewResults && reviewResults.length > 0) {
    sendMessage(interviewAPI, "Explain this comment", reviewResults[0].comment);
  }
  sleep(5);
  sendMessage(interviewAPI, "Move to follow-up questions");
  // sleep(5);
  // INTERVIEW_ITER.forEach(({ key, delay }) => {
  //   sleep(randomIntBetween(delay[0], delay[1]));
  //   const fileData = getAudioFile(key);
  //   const transcript = uploadTranscript(api, nParams.email, fileData);
  //   if (transcript) sendMessage(api, transcript);
  // });
}
