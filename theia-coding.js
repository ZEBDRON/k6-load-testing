import { check } from "k6";
import { sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { SharedArray } from "k6/data";
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
      maxDuration: "35m",
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

const PROBLEM_LANGUAGE = "React";

const APPROACH_VOICE_FILE_PATH = "voice_files/react/approach";
const CODING_QUESTIONS_VOICE_FILE_PATH = "voice_files/react/coding_questions";
const FOLLOW_UP_VOICE_FILE_PATH = "voice_files/react/follow_up";

const approachVoiceFiles = {
  approach: open(`${APPROACH_VOICE_FILE_PATH}/approach.wav`, "b"),
  follow_up: open(`${APPROACH_VOICE_FILE_PATH}/approach-follow-up.wav`, "b"),
  proceed: open(`${APPROACH_VOICE_FILE_PATH}/proceed-to-editor.wav`, "b"),
};

const codingQuestionsVoiceFiles = {
  first: open(`${CODING_QUESTIONS_VOICE_FILE_PATH}/first-question.wav`, "b"),
  second: open(`${CODING_QUESTIONS_VOICE_FILE_PATH}/second-question.wav`, "b"),
};

const firstGoalVoiceFiles = {
  first: open(`${FOLLOW_UP_VOICE_FILE_PATH}/first-goal.wav`, "b"),
  second: open(`${FOLLOW_UP_VOICE_FILE_PATH}/first-goal-1.wav`, "b"),
  // third: open(`${FOLLOW_UP_VOICE_FILE_PATH}/first-goal-2.wav`, "b"),
  dont_know: open(`${FOLLOW_UP_VOICE_FILE_PATH}/dont-know.wav`, "b"),
};

const secondGoalVoiceFiles = {
  first: open(`${FOLLOW_UP_VOICE_FILE_PATH}/second-goal.wav`, "b"),
  second: open(`${FOLLOW_UP_VOICE_FILE_PATH}/second-goal-1.wav`, "b"),
  // third: open(`${FOLLOW_UP_VOICE_FILE_PATH}/second-goal-2.wav`, "b"),
  dont_know: open(`${FOLLOW_UP_VOICE_FILE_PATH}/dont-know.wav`, "b"),
};

const APPROACH_MSG_LIMIT = 3; // Number of iterations for the approach phase

const FIRST_GOAL_ITER = new SharedArray("first_goal_iterations", function () {
  return [
    { key: "first", delay: [35, 50] },
    { key: "second", delay: [7, 10] },
    { key: "dont_know", delay: [7, 10] },
  ];
});

const SECOND_GOAL_ITER = new SharedArray("second_goal_iterations", function () {
  return [
    { key: "first", delay: [35, 50] },
    { key: "second", delay: [7, 10] },
    { key: "dont_know", delay: [7, 10] },
    { key: "dont_know", delay: [7, 10] }, // Adding a fourth iteration for the second goal
    { key: "dont_know", delay: [7, 10] }, // Adding a fifth iteration for the second goal
  ];
});

const AZURE_REACT_REMOTE_FILE_PATH = "project/src/App.js"; // The file path in the file share

// const LOCAL_USER = "http://localhost:9024";
// const LOCAL_INTERVIEW = "http://localhost:9025";
// const LOCAL_IDE = "http://localhost:9026";
// const AZURE_STORAGE_ACCOUNT_NAME = "codeserverstoragedev";

const LOCAL_USER = "https://qa-interview.geektrust.in/userservice";
const LOCAL_INTERVIEW = "https://qa-interview.geektrust.in/interviewservice";
const LOCAL_IDE = "https://qa-interview.geektrust.in/ideservice";
const AZURE_STORAGE_ACCOUNT_NAME = "codeserverstorageqa";

// const LOCAL_USER = "https://interview.geektrust.com/userservice";
// const LOCAL_INTERVIEW = "https://interview.geektrust.com/interviewservice";
// const LOCAL_IDE = "https://interview.geektrust.com/ideservice";
// const AZURE_STORAGE_ACCOUNT_NAME = "codeserverstorageaccount";

const SAS_TOKEN =
  "sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2025-06-12T02:00:27Z&st=2025-06-11T18:00:27Z&spr=https&sig=OcXEcCrPOXJNpAttVvAnb714vAryQZqfrdx3atE%2BB58%3D";
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
  const json = res.json();

  handleResponse(res, "Session");

  check(res, {
    "[Session] Status 200": (r) => r.status === 200,
    "[Session] Has Slug": () => json && typeof json.slug === "string",
  });

  return json;
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

  const loginUrl = createInvitation(userAPI, "crio-react-problem-testing"); // Use the Golang problem set
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
  sleep(10);
  getProblemStatement(interviewAPI);
  // sleep(180); //Candidate understands the problem statement 3 minutes
  sleep(30);
  sendMessage(interviewAPI, "I understand");
  sleep(5);
  let transcript = uploadTranscript(
    interviewAPI,
    nParams.email,
    approachVoiceFiles.approach
  );
  if (transcript) sendMessage(interviewAPI, transcript);
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

  const fileShareName = generateMD5(nParams.email);
  uploadFile(
    AZURE_STORAGE_ACCOUNT_NAME,
    fileShareName,
    AZURE_REACT_REMOTE_FILE_PATH,
    "react",
    SAS_TOKEN
  );

  sleep(20);

  //Coding Questions Phase
  transcript = uploadTranscript(
    interviewAPI,
    nParams.email,
    codingQuestionsVoiceFiles.first
  );
  if (transcript) sendMessage(interviewAPI, transcript);
  sleep(10); //reading the answer

  transcript = uploadTranscript(
    interviewAPI,
    nParams.email,
    codingQuestionsVoiceFiles.second
  );
  if (transcript) sendMessage(interviewAPI, transcript);
  sleep(10); //reading the answer

  //Review Code Phase
  let reviewResult = sendMessage(interviewAPI, "Review Code");
  console.log("Review Results: ====", JSON.stringify(reviewResult));
  sleep(20); // Reading the review results
  if (
    reviewResult &&
    reviewResult.comments &&
    reviewResult.comments.length > 0
  ) {
    sendMessage(
      interviewAPI,
      `Explain this comment: ${reviewResult.comments[0]}`
    );
    sleep(20);
  }

  sendMessage(
    interviewAPI,
    `Explain this comment: key={index} usage – Using the array index as a key can lead to issues if the list changes dynamically.`
  );
  sleep(20);

  reviewResult = sendMessage(interviewAPI, "Review Code");
  console.log("Review Results: ====", JSON.stringify(reviewResult));
  sleep(20); // Reading the review results
  sendMessage(
    interviewAPI,
    `Explain this comment: The grid layout and product card styles are applied via inline style objects. It's better to extract these into CSS classes (in App.css) to improve readability, maintainability, and consistency with React best practices.`
  );
  sleep(20);

  sendMessage(interviewAPI, "Move to follow-up questions");
  sleep(5);
  for (let i = 0; i < FIRST_GOAL_ITER.length; i++) {
    const { key, delay } = FIRST_GOAL_ITER[i];
    sleep(randomIntBetween(delay[0], delay[1]));
    const fileData = getFirstGoalAudioFile(key);
    const transcript = uploadTranscript(interviewAPI, nParams.email, fileData);
    if (transcript) sendMessage(interviewAPI, transcript);
    const session = getSession(interviewAPI);
    console.log("Session: ====", JSON.stringify(session));
    if (session.slug === "session-ended") {
      console.log("Session ended, breaking out of the loop.");
      break;
    }
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
      console.log("Session ended, breaking out of the loop.");
      break;
    }
  }
}
