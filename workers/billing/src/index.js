const PLAN_AMOUNT = 9900;
const PLAN_NAME = "기도의샘물 월간 구독";
const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request, env) });
    try {
      const response = await route(request, env, ctx);
      return withCors(response, request, env);
    } catch (error) {
      console.error("billing-worker", error);
      return withCors(json({ error: "요청을 처리하지 못했습니다." }, 500), request, env);
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runMonthlyRenewals(env));
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
  if (request.method === "POST" && url.pathname === "/billing/start") return startBilling(request, env);
  if (request.method === "POST" && url.pathname === "/billing/authorize") return authorizeBilling(request, env);
  if (request.method === "POST" && url.pathname === "/billing/cancel") return cancelBilling(request, env);
  if (request.method === "POST" && url.pathname === "/billing/refund") return refundBilling(request, env);
  if (request.method === "POST" && url.pathname === "/toss/webhook") return handleTossWebhook(request, env);
  if (request.method === "POST" && /^\/resources\/[^/]+\/download$/.test(url.pathname)) return downloadResource(request, env, url.pathname);
  if (request.method === "GET" && url.pathname === "/admin/community/reports") return getCommunityReports(request, env);
  if (request.method === "POST" && url.pathname === "/admin/community/moderate") return moderateCommunity(request, env);
  return json({ error: "찾을 수 없는 API입니다." }, 404);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = origin === env.SITE_ORIGIN ? origin : env.SITE_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, headers });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(", ")}`);
}

async function getMember(request, env) {
  requireEnv(env, ["SUPABASE_URL", "SUPABASE_ANON_KEY"]);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  return response.json();
}

async function requireMember(request, env) {
  const member = await getMember(request, env);
  if (!member) return [null, json({ error: "로그인이 필요합니다." }, 401)];
  return [member, null];
}

function restHeaders(env, extra = {}) {
  requireEnv(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra
  };
}

async function rest(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: restHeaders(env, options.headers),
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(typeof data === "object" ? JSON.stringify(data) : text || "Supabase 요청 실패");
  return data;
}

async function getProfile(env, userId) {
  const rows = await rest(env, `profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows?.[0] || null;
}

async function updateProfile(env, userId, values) {
  return rest(env, `profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: { ...values, updated_at: new Date().toISOString() } });
}

function basicAuth(secret) {
  return `Basic ${btoa(`${secret}:`)}`;
}

async function tossRequest(env, path, options = {}) {
  requireEnv(env, ["TOSS_SECRET_KEY"]);
  const response = await fetch(`https://api.tosspayments.com${path}`, {
    method: options.method || "POST",
    headers: {
      Authorization: basicAuth(env.TOSS_SECRET_KEY),
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "토스페이먼츠 요청에 실패했습니다.");
  return data;
}

function monthFrom(date = new Date()) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function customerKeyFor(userId) {
  return `member_${userId.replaceAll("-", "")}`.slice(0, 50);
}

function orderIdFor(userId) {
  return `sub_${userId.replaceAll("-", "").slice(0, 16)}_${Date.now()}`;
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function billingKeyCryptoKey(env) {
  requireEnv(env, ["BILLING_KEY_ENCRYPTION_KEY"]);
  const raw = base64ToBytes(env.BILLING_KEY_ENCRYPTION_KEY);
  if (raw.byteLength !== 32) throw new Error("BILLING_KEY_ENCRYPTION_KEY는 32바이트 Base64 값이어야 합니다.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptBillingKey(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await billingKeyCryptoKey(env), new TextEncoder().encode(value));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptBillingKey(value, env) {
  const [ivValue, cipherValue] = String(value).split(".");
  if (!ivValue || !cipherValue) throw new Error("저장된 결제수단 정보를 읽을 수 없습니다.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue) },
    await billingKeyCryptoKey(env),
    base64ToBytes(cipherValue)
  );
  return new TextDecoder().decode(decrypted);
}

async function startBilling(request, env) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  requireEnv(env, ["TOSS_CLIENT_KEY"]);
  const profile = await getProfile(env, member.id);
  if (profile?.subscription_status === "active" || profile?.subscription_status === "canceling") {
    return json({ error: "이미 이용 중인 구독이 있습니다." }, 409);
  }
  const now = new Date();
  const orderId = orderIdFor(member.id);
  await rest(env, "subscription_invoices", {
    method: "POST",
    body: {
      user_id: member.id,
      order_id: orderId,
      amount: PLAN_AMOUNT,
      status: "ready",
      billing_cycle_start: now.toISOString(),
      billing_cycle_end: monthFrom(now).toISOString()
    }
  });
  return json({
    orderId,
    customerKey: customerKeyFor(member.id),
    amount: PLAN_AMOUNT,
    orderName: PLAN_NAME,
    clientKey: env.TOSS_CLIENT_KEY,
    successUrl: `${env.SITE_ORIGIN}/account.html?billing=success`,
    failUrl: `${env.SITE_ORIGIN}/account.html?billing=fail`
  });
}

async function authorizeBilling(request, env) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  const { authKey, customerKey, orderId } = await readJson(request);
  if (!authKey || !customerKey || !orderId) return json({ error: "결제 인증 정보가 부족합니다." }, 400);
  if (customerKey !== customerKeyFor(member.id)) return json({ error: "결제 회원 정보가 일치하지 않습니다." }, 403);

  const invoices = await rest(env, `subscription_invoices?user_id=eq.${encodeURIComponent(member.id)}&order_id=eq.${encodeURIComponent(orderId)}&status=eq.ready&select=*`);
  const invoice = invoices?.[0];
  if (!invoice) return json({ error: "유효한 결제 요청을 찾지 못했습니다." }, 404);

  try {
    const authorization = await tossRequest(env, "/v1/billing/authorizations/issue", { body: { authKey, customerKey } });
    const billingKey = authorization.billingKey;
    if (!billingKey) throw new Error("빌링키 발급 결과가 올바르지 않습니다.");
    const payment = await tossRequest(env, `/v1/billing/${encodeURIComponent(billingKey)}`, {
      body: { customerKey, amount: PLAN_AMOUNT, orderId, orderName: PLAN_NAME }
    });
    const paidAt = payment.approvedAt || new Date().toISOString();
    const periodEnd = monthFrom(new Date(paidAt));
    const encryptedBillingKey = await encryptBillingKey(billingKey, env);
    await rest(env, "billing_credentials?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: { user_id: member.id, customer_key: customerKey, encrypted_billing_key: encryptedBillingKey, key_version: 1 }
    });
    await rest(env, `subscription_invoices?id=eq.${encodeURIComponent(invoice.id)}`, {
      method: "PATCH",
      body: { payment_key: payment.paymentKey, status: "paid", paid_at: paidAt, billing_cycle_end: periodEnd.toISOString() }
    });
    await updateProfile(env, member.id, {
      subscription_status: "active",
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      cancellation_requested_at: null
    });
    return json({ ok: true, currentPeriodEnd: periodEnd.toISOString() });
  } catch (error) {
    await rest(env, `subscription_invoices?id=eq.${encodeURIComponent(invoice.id)}`, { method: "PATCH", body: { status: "failed" } });
    return json({ error: error.message || "결제를 완료하지 못했습니다." }, 400);
  }
}

async function cancelBilling(request, env) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  const profile = await getProfile(env, member.id);
  if (!profile || !["active", "canceling"].includes(profile.subscription_status)) return json({ error: "해지할 활성 구독이 없습니다." }, 404);
  await updateProfile(env, member.id, {
    subscription_status: "canceling",
    cancel_at_period_end: true,
    cancellation_requested_at: new Date().toISOString()
  });
  return json({ ok: true, currentPeriodEnd: profile.current_period_end });
}

async function refundBilling(request, env) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  const invoices = await rest(env, `subscription_invoices?user_id=eq.${encodeURIComponent(member.id)}&status=eq.paid&order=paid_at.desc&limit=1&select=*`);
  const invoice = invoices?.[0];
  if (!invoice?.paid_at || !invoice.payment_key) return json({ error: "환불 가능한 결제 내역이 없습니다." }, 404);
  if (Date.now() - new Date(invoice.paid_at).getTime() > REFUND_WINDOW_MS) return json({ error: "자동 환불 가능 기간이 지났습니다." }, 400);
  const downloads = await rest(env, `resource_downloads?user_id=eq.${encodeURIComponent(member.id)}&downloaded_at=gte.${encodeURIComponent(invoice.paid_at)}&select=id&limit=1`);
  if (downloads?.length) return json({ error: "유료 자료를 다운로드한 뒤에는 자동 환불을 제공하지 않습니다." }, 400);
  await tossRequest(env, `/v1/payments/${encodeURIComponent(invoice.payment_key)}/cancel`, { body: { cancelReason: "고객 요청에 따른 7일 이내 자동 환불" } });
  await rest(env, `subscription_invoices?id=eq.${encodeURIComponent(invoice.id)}`, { method: "PATCH", body: { status: "refunded", canceled_at: new Date().toISOString() } });
  await rest(env, `billing_credentials?user_id=eq.${encodeURIComponent(member.id)}`, { method: "DELETE" });
  await updateProfile(env, member.id, { subscription_status: "refunded", current_period_end: null, cancel_at_period_end: false, cancellation_requested_at: new Date().toISOString() });
  return json({ ok: true });
}

async function handleTossWebhook(request, env) {
  const payload = await readJson(request);
  const eventId = payload.eventId || payload.data?.paymentKey || payload.data?.orderId;
  if (!eventId) return json({ error: "웹훅 식별자가 없습니다." }, 400);
  try {
    await rest(env, "payment_events", { method: "POST", body: { provider_event_id: String(eventId), event_type: payload.eventType || payload.type || null, payload } });
  } catch (error) {
    if (!String(error.message).includes("duplicate")) throw error;
    return json({ ok: true, duplicate: true });
  }
  const paymentKey = payload.data?.paymentKey || payload.paymentKey;
  if (paymentKey) await tossRequest(env, `/v1/payments/${encodeURIComponent(paymentKey)}`, { method: "GET" });
  await rest(env, `payment_events?provider_event_id=eq.${encodeURIComponent(String(eventId))}`, { method: "PATCH", body: { processed_at: new Date().toISOString() } });
  return json({ ok: true });
}

async function downloadResource(request, env, pathname) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  const resourceId = pathname.split("/")[2];
  const profile = await getProfile(env, member.id);
  const isActive = profile?.role === "admin" || (profile?.subscription_status === "active" && profile.current_period_end && new Date(profile.current_period_end) > new Date());
  if (!isActive) return json({ error: "구독 회원만 자료를 내려받을 수 있습니다." }, 403);
  const files = await rest(env, `resource_files?resource_id=eq.${encodeURIComponent(resourceId)}&order=sort_order.asc&limit=1&select=object_path,file_name`);
  const file = files?.[0];
  if (!file) return json({ error: "다운로드 파일을 찾지 못했습니다." }, 404);
  const invoices = await rest(env, `subscription_invoices?user_id=eq.${encodeURIComponent(member.id)}&status=eq.paid&order=paid_at.desc&limit=1&select=id`);
  await rest(env, "resource_downloads", {
    method: "POST",
    body: { user_id: member.id, resource_id: resourceId, invoice_id: invoices?.[0]?.id || null, user_agent: request.headers.get("User-Agent") || null }
  });
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/faith-resources/${file.object_path}`, {
    method: "POST",
    headers: restHeaders(env),
    body: JSON.stringify({ expiresIn: 300 })
  });
  const signed = await response.json().catch(() => ({}));
  if (!response.ok || !signed.signedURL) throw new Error("보호된 다운로드 링크를 만들지 못했습니다.");
  return json({ url: `${env.SUPABASE_URL}/storage/v1${signed.signedURL}`, fileName: file.file_name });
}

async function requireAdmin(request, env) {
  const [member, error] = await requireMember(request, env);
  if (error) return [null, error];
  const profile = await getProfile(env, member.id);
  if (profile?.role !== "admin") return [null, json({ error: "관리자 권한이 필요합니다." }, 403)];
  return [member, null];
}

async function moderateCommunity(request, env) {
  const [admin, authError] = await requireAdmin(request, env);
  if (authError) return authError;
  const { targetType, targetId, action, note } = await readJson(request);
  if (!targetId || !["post", "reply", "report"].includes(targetType) || !["hide", "restore", "resolve_report", "dismiss_report"].includes(action)) {
    return json({ error: "운영 처리 정보가 올바르지 않습니다." }, 400);
  }
  if (targetType === "post" || targetType === "reply") {
    const table = targetType === "post" ? "community_posts" : "community_replies";
    await rest(env, `${table}?id=eq.${encodeURIComponent(targetId)}`, { method: "PATCH", body: { status: action === "hide" ? "hidden" : "published" } });
  } else {
    await rest(env, `community_reports?id=eq.${encodeURIComponent(targetId)}`, {
      method: "PATCH",
      body: { status: action === "resolve_report" ? "resolved" : "dismissed", reviewed_at: new Date().toISOString(), reviewed_by: admin.id }
    });
  }
  await rest(env, "community_moderation_actions", { method: "POST", body: { actor_id: admin.id, target_type: targetType, target_id: targetId, action, note: note || null } });
  return json({ ok: true });
}

async function getCommunityReports(request, env) {
  const [_admin, authError] = await requireAdmin(request, env);
  if (authError) return authError;
  const reports = await rest(env, "community_reports?status=eq.open&order=created_at.asc&select=id,target_type,target_id,reason,created_at");
  return json({ reports: reports || [] });
}

async function runMonthlyRenewals(env) {
  requireEnv(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TOSS_SECRET_KEY", "BILLING_KEY_ENCRYPTION_KEY"]);
  const now = new Date().toISOString();
  const due = await rest(env, `profiles?subscription_status=in.(active,canceling)&current_period_end=lte.${encodeURIComponent(now)}&select=*`);
  await Promise.all(due.map(async (profile) => {
    if (profile.cancel_at_period_end) {
      await rest(env, `billing_credentials?user_id=eq.${encodeURIComponent(profile.id)}`, { method: "DELETE" });
      await updateProfile(env, profile.id, { subscription_status: "free", current_period_end: null, cancel_at_period_end: false });
      return;
    }
    try {
      const credentials = await rest(env, `billing_credentials?user_id=eq.${encodeURIComponent(profile.id)}&select=*`);
      const credential = credentials?.[0];
      if (!credential) throw new Error("결제수단 정보가 없습니다.");
      const start = new Date();
      const periodEnd = monthFrom(start);
      const orderId = orderIdFor(profile.id);
      const invoices = await rest(env, "subscription_invoices", {
        method: "POST",
        body: { user_id: profile.id, order_id: orderId, amount: PLAN_AMOUNT, status: "ready", billing_cycle_start: start.toISOString(), billing_cycle_end: periodEnd.toISOString() }
      });
      const invoice = invoices?.[0];
      const payment = await tossRequest(env, `/v1/billing/${encodeURIComponent(await decryptBillingKey(credential.encrypted_billing_key, env))}`, {
        body: { customerKey: credential.customer_key, amount: PLAN_AMOUNT, orderId, orderName: PLAN_NAME }
      });
      await rest(env, `subscription_invoices?id=eq.${encodeURIComponent(invoice.id)}`, { method: "PATCH", body: { status: "paid", payment_key: payment.paymentKey, paid_at: payment.approvedAt || new Date().toISOString() } });
      await updateProfile(env, profile.id, { subscription_status: "active", current_period_end: periodEnd.toISOString() });
    } catch (error) {
      console.error("renewal-failed", profile.id, error);
      await updateProfile(env, profile.id, { subscription_status: "past_due" });
    }
  }));
}
