import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
assert.match(source, /export default\s*\{/);

const calls = [];
const contactId = "11111111-1111-4111-8111-111111111111";
const inquiryId = "22222222-2222-4222-8222-222222222222";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function mockFetch(input, options = {}) {
  const url = String(input);
  const method = String(options.method || "GET").toUpperCase();
  const call = { url, method, headers: new Headers(options.headers || {}), body: options.body || "" };
  calls.push(call);

  if (url.includes("/rest/v1/customer_contacts?") && method === "GET") return jsonResponse([]);
  if (url.endsWith("/rest/v1/customer_contacts") && method === "POST") {
    return jsonResponse([{ id: contactId, lifecycle_stage: "lead" }]);
  }
  if (url.endsWith("/rest/v1/customer_inquiries") && method === "POST") {
    const body = JSON.parse(options.body);
    return jsonResponse([{ id: inquiryId, ...body }]);
  }
  if (url.includes("/rest/v1/customer_inquiries?") && method === "PATCH") {
    return jsonResponse([{ id: inquiryId, ...JSON.parse(options.body) }]);
  }
  if (url === "https://api.resend.com/emails" && method === "POST") {
    return jsonResponse({ id: "email_test_123" });
  }

  throw new Error(`Unexpected fetch: ${method} ${url}`);
}

const context = {
  URL,
  Request,
  Response,
  Headers,
  FormData,
  TextEncoder,
  TextDecoder,
  crypto,
  console,
  fetch: mockFetch,
  btoa,
  atob,
  setTimeout,
  clearTimeout
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source.replace(/export default\s*\{/, "globalThis.worker = {"), context, {
  filename: "workers/billing/src/index.js"
});
assert.ok(context.worker?.fetch, "worker fetch handler must be available");

const baseEnv = {
  SITE_ORIGIN: "https://product-codex-90j.pages.dev",
  ALLOWED_ORIGINS: "",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon_test",
  SUPABASE_SERVICE_ROLE_KEY: "service_test",
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "기도의샘물 <notice@example.com>",
  CONTACT_NOTIFICATION_EMAIL: "admin@example.com"
};

function inquiryRequest(payload, origin = baseEnv.SITE_ORIGIN) {
  return new Request("https://worker.example/contact/inquiries", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

const inquiryPayload = {
  inquiryType: "resource",
  name: "테스트 사용자",
  email: "Visitor@Example.com",
  productId: "prayer-pdf-01",
  message: "<script>alert(1)</script> 신앙자료에 관해 문의드립니다.",
  website: ""
};

const response = await context.worker.fetch(inquiryRequest(inquiryPayload), baseEnv);
assert.equal(response.status, 201);
assert.deepEqual(await response.json(), {
  ok: true,
  inquiryId,
  notificationSent: true
});
assert.equal(response.headers.get("Access-Control-Allow-Origin"), baseEnv.SITE_ORIGIN);

const contactPost = calls.find((call) => call.url.endsWith("/rest/v1/customer_contacts") && call.method === "POST");
assert.ok(contactPost, "customer contact must be stored before notification");
const contactBody = JSON.parse(contactPost.body);
assert.equal(contactBody.email, "visitor@example.com");
assert.equal(contactBody.source, "contact_form");

const inquiryPost = calls.find((call) => call.url.endsWith("/rest/v1/customer_inquiries") && call.method === "POST");
assert.ok(inquiryPost, "inquiry must be stored");
assert.equal(JSON.parse(inquiryPost.body).contact_id, contactId);

const resendCall = calls.find((call) => call.url === "https://api.resend.com/emails");
assert.ok(resendCall, "Resend notification must be attempted");
assert.equal(resendCall.headers.get("Authorization"), "Bearer re_test");
assert.equal(resendCall.headers.get("Idempotency-Key"), `contact-inquiry:${inquiryId}`);
const resendBody = JSON.parse(resendCall.body);
assert.equal(resendBody.reply_to, "visitor@example.com");
assert.ok(resendBody.html.includes("&lt;script&gt;"));
assert.ok(!resendBody.html.includes("<script>"));

const notificationPatch = calls.find((call) => call.url.includes("/rest/v1/customer_inquiries?") && call.method === "PATCH");
assert.equal(JSON.parse(notificationPatch.body).notification_status, "sent");

const callsBeforeRejectedOrigin = calls.length;
const rejected = await context.worker.fetch(
  inquiryRequest(inquiryPayload, "https://attacker.example"),
  baseEnv
);
assert.equal(rejected.status, 403);
assert.equal(calls.length, callsBeforeRejectedOrigin);

const callsBeforeHoneypot = calls.length;
const honeypot = await context.worker.fetch(
  inquiryRequest({ ...inquiryPayload, website: "https://spam.example" }),
  baseEnv
);
assert.equal(honeypot.status, 202);
assert.equal(calls.length, callsBeforeHoneypot);

const adminDenied = await context.worker.fetch(
  new Request("https://worker.example/admin/customers", {
    headers: { Origin: baseEnv.SITE_ORIGIN }
  }),
  baseEnv
);
assert.equal(adminDenied.status, 401);

calls.length = 0;
const withoutResend = await context.worker.fetch(
  inquiryRequest({ ...inquiryPayload, email: "second@example.com" }),
  {
    ...baseEnv,
    RESEND_API_KEY: "",
    RESEND_FROM_EMAIL: "",
    CONTACT_NOTIFICATION_EMAIL: ""
  }
);
assert.equal(withoutResend.status, 201);
assert.equal((await withoutResend.json()).notificationSent, false);
assert.equal(calls.some((call) => call.url === "https://api.resend.com/emails"), false);
const skippedPatch = calls.find((call) => call.url.includes("/rest/v1/customer_inquiries?") && call.method === "PATCH");
assert.equal(JSON.parse(skippedPatch.body).notification_status, "skipped");

console.log("customer inquiry and Resend flow: ok");
