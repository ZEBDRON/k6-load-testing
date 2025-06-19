import http from "k6/http";
import { check } from "k6";
import moment from "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import encoding from "k6/encoding";
import { sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { SharedArray } from "k6/data";

export const options = {
  scenarios: {
    parallel_requests: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "10m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
  noConnectionReuse: true,
};

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

// const LOCAL_USER = "https://qa-interview.geektrust.in/userservice";
// const LOCAL_INTERVIEW = "https://qa-interview.geektrust.in/interviewservice";

// const LOCAL_USER = "https://interview.geektrust.com/userservice";
// const LOCAL_INTERVIEW = "https://interview.geektrust.com/interviewservice";

const BASE_URL = `${LOCAL_USER}`;
const COMMON_HEADERS = {
  "Content-Type": "application/json",
};

// ----------------------------
// DATA GENERATORS
// ----------------------------
export function replaceEmailDomain(email) {
  const domain = email.split("@")[1];
  const newEmail = email.replace(`@${domain}`, "@dummy.com");
  return newEmail;
}

export function getRandomUser(api) {
  // const res = http.get("https://randomuser.me/api/");
  const res = http.get(
    "https://fakerapi.it/api/v2/persons?_quantity=1&_locale=en_IN"
  );
  const results = res.json("data");
  const nameObj = results[0];
  const name = nameObj.firstname;
  const email = replaceEmailDomain(results[0].email);
  return { name, email };
}

export function getAudioFile(key) {
  if (!voiceFiles[key]) {
    throw new Error(`Audio file ${key} not found`);
  }
  return voiceFiles[key];
}

export function generateInvitationPayload(reqID) {
  const randomUser = getRandomUser();
  return {
    email: randomUser.email,
    name: randomUser.name,
    requirementId: reqID,
    activationTime: moment().add(0, "minute").format("YYYY-MM-DD hh:mm A"),
    companyName: "nuchange",
    validForMinutes: 30,
    interviewType: "TEST",
  };
}

export function parseLoginUrl(url) {
  try {
    const urlObj = new URL(url);
    const loginCode = urlObj.searchParams.get("loginCode");
    const pathSegments = urlObj.pathname.split("/");
    const shortCode = pathSegments[pathSegments.length - 1];

    return { loginCode, shortCode };
  } catch (error) {
    console.error("Invalid URL:", error.message);
    return null;
  }
}

// ----------------------------
// TEST ACTIONS
// ----------------------------
export function createInvitation(apiClient, reqID) {
  const payload = generateInvitationPayload(reqID);
  console.log("[Payload]:", payload);
  sleep(randomIntBetween(3, 6));
  const res = apiClient.post("/api/v1/user/invitation", payload);
  handleResponse(res, "Create Invitation");
  check(res, {
    "[Invitation] Status 200": (r) => r.status === 200,
    "[Invitation] Has loginUrl": (r) => r.json("link") !== undefined,
  });

  return res.json("link");
}

export function getFullLoginUrl(apiClient, shortCode, loginCode) {
  const url = `/api/v1/user/login-url/${shortCode}?loginCode=${loginCode}`;
  sleep(randomIntBetween(3, 6));
  const res = apiClient.get(url);
  handleResponse(res, "Login URL");
  check(res, {
    "[Login] Status 200": (r) => r.status === 200,
    "[Login] Has url": (r) => r.json("link") !== undefined,
  });

  return res.json("link");
}

export function parseFullLoginUrl(url) {
  try {
    const urlObj = new URL(url);
    const loginCode = urlObj.searchParams.get("loginCode");
    const invitationId = urlObj.searchParams.get("invitationId");
    const email = encoding.b64decode(
      urlObj.searchParams.get("email"),
      "std",
      "s"
    );

    return { loginCode, invitationId, email };
  } catch (error) {
    console.error("Invalid URL:", error.message);
    return null;
  }
}

export function getAuthToken(apiClient, email, loginCode, invitationId) {
  const url = `/api/v1/user/token`;
  const payload = { loginCode, email, invitationId };
  sleep(randomIntBetween(3, 6));
  const res = apiClient.post(url, payload);
  handleResponse(res, "Auth");
  check(res, {
    "[Auth] Status 200": (r) => r.status === 200,
    "[Auth] Has token": (r) => r.json("token") !== undefined,
  });

  return res.json("token");
}

export function createSession(apiClient) {
  const url = `/api/v1/session`;
  const payload = { demo: false };

  const res = apiClient.post(url, payload);
  handleResponse(res, "Create Session");
  check(res, {
    "[Session] Status 201": (r) => r.status === 201,
  });
}

export function sendMessage(
  apiClient,
  message,
  sourceCode = [],
  voiceFileName = ""
) {
  const url = `/api/v1/message`;
  const payload = { message, sourceCode, voiceFileName };

  const res = apiClient.post(url, payload);
  handleResponse(res, "Messages");
  check(res, {
    "[Message] Status 200": (r) => r.status === 200,
  });

  if (res.status === 200 && res.body.includes("data:")) {
    const messages = res.body
      .split("\n\n") // Split events
      .filter((event) => event.startsWith("data: ")) // Keep only valid events
      .map((event) => event.replace(/^data: /, "")) // Remove 'data: ' prefix
      .map((event) => {
        try {
          return JSON.parse(event);
        } catch (e) {
          return null;
        }
      })
      .filter((obj) => obj !== null);

    const fullMessage = messages.find((m) => m.fullMessage)?.fullMessage || "";
    const reviewResult = fullMessage?.actions?.reviewResult;

    console.log("Last Message:", fullMessage.actions);

    if (reviewResult) {
      console.log("Review Result:", reviewResult);
    }
    console.log("Full Message:", fullMessage);

    return reviewResult || fullMessage;
  }
}

export function createConversation(apiClient) {
  const url = `/api/v1/conversation`;
  const payload = { Action: "Start" };
  const res = apiClient.post(url, payload);
  handleResponse(res, "Create Conversation");
  check(res, {
    "[Conversation] Status 200": (r) => r.status === 200,
  });
}

export function uploadTranscript(apiClient, email, file) {
  const url = `/api/v1/transcript`;
  const fd = new FormData();
  fd.append("email", email);
  fd.append("voiceFile", http.file(file));

  const res = apiClient.post(url, fd, true);
  handleResponse(res, "Transcription");
  check(res, {
    "[Upload Transcription] is status 200": (r) => r.status === 200,
  });

  return res.json("transcript");
}

export class ApiClient {
  constructor(baseUrl, headers) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }

  post(endpoint, payload, isFormData = false) {
    const options = { headers: { ...this.headers } };
    if (isFormData) {
      options.headers["Content-Type"] =
        "multipart/form-data; boundary=" + payload.boundary;
      return http.post(`${this.baseUrl}${endpoint}`, payload.body(), options);
    }

    return http.post(
      `${this.baseUrl}${endpoint}`,
      JSON.stringify(payload),
      options
    );
  }

  get(endpoint) {
    return http.get(`${this.baseUrl}${endpoint}`, { headers: this.headers });
  }
}

export function handleResponse(res, description) {
  console.log(
    `[${description}] Response time was ` + String(res.timings.duration) + " ms"
  );
  if (res.status != 200 && res.status != 201) {
    console.error(
      `[${description}] Api failed with code:`,
      res.status,
      res.body
    );
    return null;
  }
  return res;
}

// ----------------------------
// MAIN EXECUTION FLOW
// ----------------------------
export default function () {
  let api = new ApiClient(BASE_URL, COMMON_HEADERS);

  // 1. Create invitation and get login URL
  const loginUrl = createInvitation(api, "demo-nuchange-java-test");
  console.log("Received login URL:", loginUrl);
  sleep(2);
  //   2. Parse login URL parameters
  const params = parseLoginUrl(loginUrl);
  if (!params) {
    throw new Error("Failed to parse login URL parameters");
  }

  console.log("Parsed parameters:", JSON.stringify(params, null, 2));

  // 3. Perform login with extracted parameters
  const fullLoginUrl = getFullLoginUrl(api, params.shortCode, params.loginCode);
  console.log("Login successful. Url:", fullLoginUrl);
  sleep(2);

  const nParams = parseFullLoginUrl(fullLoginUrl);
  if (!nParams) {
    throw new Error("Failed to parse full login URL parameters");
  }

  console.log("Parsed parameters:", JSON.stringify(nParams, null, 2));

  const authToken = getAuthToken(
    api,
    nParams.email,
    nParams.loginCode,
    nParams.invitationId
  );
  // 4. Update headers for authenticated requests
  COMMON_HEADERS["Authorization"] = `Bearer ${authToken}`;
  sleep(2);

  api = new ApiClient(LOCAL_INTERVIEW, COMMON_HEADERS);

  createSession(api);
  sleep(5);
  createConversation(api);
  sleep(5);
  sendMessage(api, "Let's start");
  sleep(5);

  INTERVIEW_ITER.forEach(({ key, delay }) => {
    sleep(randomIntBetween(delay[0], delay[1]));
    const fileData = getAudioFile(key);
    const transcript = uploadTranscript(api, nParams.email, fileData);
    if (transcript) sendMessage(api, transcript);
  });
}
