import http from "k6/http";
import { check } from "k6";
import moment from "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js";
import { URL } from "https://jslib.k6.io/url/1.0.0/index.js";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import encoding from "k6/encoding";
import { sleep } from "k6";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { SharedArray } from "k6/data";

const AUDIO_FILES = new SharedArray("audio_files", function () {
  return [
    { key: "first", file: open("voice_files/1.wav", "b"), delay: [35, 50] },
    { key: "skip", file: open("voice_files/skip.wav", "b"), delay: [5, 10] },
    { key: "second", file: open("voice_files/2.wav", "b"), delay: [35, 50] },
    { key: "skip", file: open("voice_files/skip.wav", "b"), delay: [5, 10] },
    { key: "third", file: open("voice_files/3.wav", "b"), delay: [35, 50] },
    { key: "skip", file: open("voice_files/skip.wav", "b"), delay: [5, 10] },
    { key: "fourth", file: open("voice_files/4.wav", "b"), delay: [35, 50] },
    { key: "skip", file: open("voice_files/skip.wav", "b"), delay: [5, 10] },
  ];
});

const LOCAL_USER = "http://localhost:9024";
const LOCAL_INTERVIEW = "http://localhost:9025";
const COMMON_HEADERS = { "Content-Type": "application/json" };

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<3000"],
  },
};

function getRandomUser() {
  const res = http.get("https://randomuser.me/api/");
  console.log(res)
  const user = res.json("results[0]");
  return { name: "HD", email: "hd@mailinator.com"}
  // return { name: `${user.name.title} ${user.name.first} ${user.name.last}`, email: user.email };
}

function createApiClient(baseUrl, headers) {
  return {
    post: (endpoint, payload, isFormData = false) => {
      const options = { headers: { ...headers } };
      if (isFormData) {
        options.headers["Content-Type"] = "multipart/form-data; boundary=" + payload.boundary;
        return http.post(`${baseUrl}${endpoint}`, payload.body(), options);
      }
      return http.post(`${baseUrl}${endpoint}`, JSON.stringify(payload), options);
    },
    get: (endpoint) => http.get(`${baseUrl}${endpoint}`, { headers }),
  };
}

function handleResponse(res, description) {
  if (res.status === 429) {
    console.error(`[${description}] Rate limit exceeded (429)`);
    return null;
  }
  return res;
}

function sendMessage(apiClient, message, sourceCode = [], voiceFileName = "") {
  const res = apiClient.post("/api/v1/message", { message, sourceCode, voiceFileName });
  if (!handleResponse(res, "Message")) return;
  
  check(res, { "[Message] Status 200": (r) => r.status === 200 });
  return res.json();
}

function uploadTranscript(apiClient, email, file, description) {
  const fd = new FormData();
  fd.append("email", email);
  fd.append("voiceFile", http.file(file));

  const res = apiClient.post("/api/v1/transcript", fd, true);
  if (!handleResponse(res, description)) return;
  
  check(res, { "[Upload Transcription] Status 200": (r) => r.status === 200 });
  return res.json("transcript");
}

export default function () {
  let userApi = createApiClient(LOCAL_USER, COMMON_HEADERS);
  let interviewApi;

  const { name, email } = getRandomUser();
  const invitationPayload = {
    email,
    name,
    requirementId: "demo-nuchange-java-test",
    activationTime: moment().format("YYYY-MM-DD hh:mm A"),
    companyName: "nuchange",
    validForMinutes: 30,
  };

  console.log(invitationPayload)

  const invitationRes = userApi.post("/api/v1/user/invitation", invitationPayload);
  if (!handleResponse(invitationRes, "Invitation")) return;
  const loginUrl = invitationRes.json("link");

  console.log(loginUrl)

  const loginRes = userApi.get(`/api/v1/user/login-url/${loginUrl.split("/").pop()}?loginCode=12345`);
  if (!handleResponse(loginRes, "Login")) return;
  
  const authToken = loginRes.json("token");
  console.log(loginRes)
  COMMON_HEADERS["Authorization"] = `Bearer ${authToken}`;
  interviewApi = createApiClient(LOCAL_INTERVIEW, COMMON_HEADERS);

  interviewApi.post("/api/v1/session", { demo: false });
  interviewApi.post("/api/v1/conversation", {});
  sendMessage(interviewApi, "Let's start");

  AUDIO_FILES.forEach(({ key, file, delay }) => {
    sleep(randomIntBetween(delay[0], delay[1]));
    const transcript = uploadTranscript(interviewApi, email, file, key);
    if (transcript) sendMessage(interviewApi, transcript);
  });
}
