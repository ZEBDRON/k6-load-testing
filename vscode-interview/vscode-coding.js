import http from "k6/http";
import { check } from "k6";
import { sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { SharedArray } from "k6/data";
import { uploadFile, generateMD5 } from "../azure-file-upload.js";
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
} from "../theory-interview/theory.js";

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
    http_req_duration: ["p(90)<3000"],
  },
  noConnectionReuse: true,
};

const PROBLEM_LANGUAGE = "Java";

const APPROACH_VOICE_FILE_PATH = "../voice_files/java/approach";
const FOLLOW_UP_VOICE_FILE_PATH = "../voice_files/java/follow_up";

const approachVoiceFiles = {
  approach: open(`${APPROACH_VOICE_FILE_PATH}/approach.wav`, "b"),
  follow_up: open(`${APPROACH_VOICE_FILE_PATH}/approach-follow-up.wav`, "b"),
  proceed: open(`${APPROACH_VOICE_FILE_PATH}/proceed-to-editor.wav`, "b"),
};

const firstGoalVoiceFiles = {
  first: open(`${FOLLOW_UP_VOICE_FILE_PATH}/first-goal.wav`, "b"),
  second: open(`${FOLLOW_UP_VOICE_FILE_PATH}/first-goal-1.wav`, "b"),
  dont_know: open(`${FOLLOW_UP_VOICE_FILE_PATH}/dont-know.wav`, "b"),
};

const secondGoalVoiceFiles = {
  first: open(`${FOLLOW_UP_VOICE_FILE_PATH}/second-goal.wav`, "b"),
  second: open(`${FOLLOW_UP_VOICE_FILE_PATH}/second-goal-1.wav`, "b"),
};

const APPROACH_MSG_LIMIT = 3; // Number of iterations for the approach phase

const FIRST_GOAL_ITER = new SharedArray(
  "first_goal_iterations_vscode",
  function () {
    return [
      { key: "first", delay: [35, 50] },
      { key: "second", delay: [7, 10] },
      { key: "third", delay: [35, 50] },
      { key: "dont_know", delay: [7, 10] },
    ];
  }
);

const SECOND_GOAL_ITER = new SharedArray(
  "second_goal_iterations_vscode",
  function () {
    return [
      { key: "first", delay: [35, 50] },
      { key: "second", delay: [7, 10] },
      { key: "third", delay: [35, 50] },
      { key: "dont_know", delay: [7, 10] },
    ];
  }
);

const AZURE_REMOTE_FILE_PATH = "project/src/main/java/Main.java"; // The file path in the file share

const LOCAL_USER = "http://localhost:9024";
const LOCAL_INTERVIEW = "http://localhost:9025";
const LOCAL_IDE = "http://localhost:9026";
const LOCAL_EDITOR_URL = "http://localhost:9026/vscode";
const AZURE_STORAGE_ACCOUNT_NAME = "codeserverstoragedev";

const SAS_TOKEN = "";
const BASE_URL = `${LOCAL_USER}`;
const COMMON_HEADERS = {
  "Content-Type": "application/json",
};

// ----------------------------
// HELPER FUNCTIONS
// ----------------------------

// ----------------------------
// TEST ACTIONS
// ----------------------------

export function getProblemStatement(apiClient) {
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

export function expireInterview(apiClient, email, invitationId) {
  // 1. Expire Invitation
  const payload = { email, invitationId };

  let expireRes = apiClient.post("/api/v1/invitation/expire", payload);
  console.log(
    `Expiring invitation for email: ${email}, invitationId: ${invitationId}`
  );
  handleResponse(expireRes, "Expire Invitation");
  check(expireRes, {
    "[Expire Invitation] Status 204": (r) => r.status === 204,
  });

  if (expireRes.status === 204) {
    // 2. End Interview Session
    let sessionRes = apiClient.delete("/api/v1/session");
    handleResponse(sessionRes, "End Session");
    check(sessionRes, {
      "[End Session] Status 204": (r) => r.status === 204,
    });
  } else {
    console.error("Error expiring invitation", expireRes.status);
  }

  sleep(1); // Pause to simulate real user wait
}

export function deleteIDE(apiClient) {
  let ideRes = apiClient.delete("/api/v1/ide");
  handleResponse(ideRes, "Delete IDE");
  check(ideRes, {
    "[Delete IDE] Status 204": (r) => r.status === 204,
  });
  if (ideRes.status === 204) {
    console.log("Interview session expired and IDE deleted successfully.");
  } else {
    console.error("Error deleting IDE", ideRes.status);
  }
}

function getFirstGoalAudioFile(key) {
  if (!firstGoalVoiceFiles[key]) {
    throw new Error(`Audio file ${key} not found`);
  }
  return firstGoalVoiceFiles[key];
}

function getSecondGoalAudioFile(key) {
  if (!secondGoalVoiceFiles[key]) {
    throw new Error(`Audio file ${key} not found`);
  }
  return secondGoalVoiceFiles[key];
}

// ----------------------------
// MAIN EXECUTION FLOW
// ----------------------------
export default async function () {
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
  let transcript = uploadTranscript(
    interviewAPI,
    nParams.email,
    approachVoiceFiles.approach
  );
  if (transcript) sendMessage(interviewAPI, transcript);
  // sendMessage(
  //   interviewAPI,
  //   "I will start by modeling the domain entities. Define an enum Destination to represent valid destinations (PARIS, TOKYO, CAIRO) along with their respective one-way ticket costs. Create another enum TripType to represent the trip type (ROUND, ONE_WAY), and include a cost multiplier method (e.g., 2x for round trips). Implement a TravelCostCalculator class that takes in the number of travelers, destination, and trip type, and performs the core logic to compute the total cost using these enums. The main class (TravelCostApp) should handle parsing and validating the command-line input, converting strings to enums in a case-insensitive way, handling invalid inputs gracefully using exceptions or fallback messages, and then invoking the calculator to output the result in the required format. Use helper methods to encapsulate input validation and parsing to keep the main method clean and readable. This modular approach not only ensures clarity and testability but also adheres to single-responsibility and open/closed principles."
  // );
  sleep(15); // Time to load the code editor
  sleep(5);
  transcript = uploadTranscript(
    interviewAPI,
    nParams.email,
    approachVoiceFiles.follow_up
  );
  if (transcript) sendMessage(interviewAPI, transcript);
  sleep(5);
  for (let i = 0; i < APPROACH_MSG_LIMIT; i++) {
    const session = getSession(interviewAPI);
    console.log("Session: ====", JSON.stringify(session));
    if (session.driverBot === "TaskRunnerBot") {
      sendMessage(interviewAPI, "Start Coding");
      break;
    } else {
      transcript = uploadTranscript(
        interviewAPI,
        nParams.email,
        approachVoiceFiles.proceed
      );
      if (transcript) sendMessage(interviewAPI, transcript);
    }
  }
  sleep(10);
  sleep(60); // Candidate writes code
  //Checking if the code editor is loaded
  const MAX_RETRIES = 10;
  const RETRY_INTERVAL_SECONDS = 20;
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
  const response = http.post(
    "http://localhost:8000/set-editor-url",
    JSON.stringify({ ideUrl: `${LOCAL_EDITOR_URL}/${ideResponse.id}/` }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  // Check if the response is OK
  if (!response || response.status !== 200) {
    // throw new Error(`Failed to set container ID: ${response}`);
    console.error(`Failed to set container ID: ${response.statusText}`);
  }

  sleep(10);

  const fileShareName = generateMD5(nParams.email);
  uploadFile(
    AZURE_STORAGE_ACCOUNT_NAME,
    fileShareName,
    AZURE_REMOTE_FILE_PATH,
    "java",
    SAS_TOKEN
  );
  sleep(15);
  const reviewResult = sendMessage(interviewAPI, "Review Code");
  console.log("Review Results: ====", JSON.stringify(reviewResult));
  sleep(5);
  if (
    reviewResult &&
    reviewResult.comments &&
    reviewResult.comments.length > 0
  ) {
    sendMessage(
      interviewAPI,
      `Explain this comment: ${reviewResult.comments[0]}`
    );
  }
  sleep(5);
  sendMessage(interviewAPI, "Move to follow-up questions");
  sleep(40); // Candidate waits for follow-up questions
  for (let i = 0; i < FIRST_GOAL_ITER.length; i++) {
    const { key, delay } = FIRST_GOAL_ITER[i];
    sleep(randomIntBetween(delay[0], delay[1]));
    const fileData = getFirstGoalAudioFile(key);
    const transcript = uploadTranscript(interviewAPI, nParams.email, fileData);
    if (transcript) sendMessage(interviewAPI, transcript);
  }
  sleep(5);
  for (let i = 0; i < SECOND_GOAL_ITER.length; i++) {
    const { key, delay } = SECOND_GOAL_ITER[i];
    sleep(randomIntBetween(delay[0], delay[1]));
    const fileData = getSecondGoalAudioFile(key);
    const transcript = uploadTranscript(interviewAPI, nParams.email, fileData);
    if (transcript) sendMessage(interviewAPI, transcript);
    const session = getSession(interviewAPI);
    console.log("Session: ====", JSON.stringify(session));
    if (session.slug === "session-ended") {
      break;
    }
  }
  sleep(5);
  expireInterview(interviewAPI, nParams.email, nParams.invitationId);
  deleteIDE(ideAPI);
  const browserRes = http.post(
    "http://localhost:8000/close-browser",
    null, // No body needed
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status !== 200) {
    console.error(
      `❌ Failed to close browser: ${response.status} - ${response.body}`
    );
  } else {
    console.log(`✅ Browser closed successfully`);
  }
}
