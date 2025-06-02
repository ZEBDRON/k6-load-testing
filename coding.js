import http from "k6/http";
import { check } from "k6";
import moment from "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import encoding from "k6/encoding";
import { sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { SharedArray } from "k6/data";
const { chromium } = require("playwright");
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

const LOCAL_USER = "http://localhost:9024";
const LOCAL_INTERVIEW = "http://localhost:9025";
const LOCAL_IDE = "http://localhost:9026";

// const LOCAL_USER = "https://qa-interview.geektrust.in/userservice";
// const LOCAL_INTERVIEW = "https://qa-interview.geektrust.in/interviewservice";

// const LOCAL_USER = "https://interview.geektrust.com/userservice";
// const LOCAL_INTERVIEW = "https://interview.geektrust.com/interviewservice";

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

// ----------------------------
// MAIN EXECUTION FLOW
// ----------------------------
export default function () {
  (async () => {
    const browser = await puppeteer.launch(); // default is headless: true
    const page = await browser.newPage();
    await page.goto("https://example.com");

    // Optionally take a screenshot
    await page.screenshot({ path: "example.png" });

    await browser.close();
  })();
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
  sendMessage(interviewAPI, "Start Coding");
  sleep(90); // Candidate writes code
  reviewResults = sendMessage(interviewAPI, "Review Code");
  console.log("Review Results: ====", reviewResults);
  sleep(5);
  if (reviewResults) {
    sendMessage(interviewAPI, "Explain this comment", reviewResults[0].comment);
  }
  sleep(5);
  sendMessage(interviewAPI, "Continue anyway");
  sleep(5);

  //   INTERVIEW_ITER.forEach(({ key, delay }) => {
  //     sleep(randomIntBetween(delay[0], delay[1]));
  //     const fileData = getAudioFile(key);
  //     const transcript = uploadTranscript(api, nParams.email, fileData);
  //     if (transcript) sendMessage(api, transcript);
  //   });
}
