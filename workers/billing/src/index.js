const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{2,120}$/;
const RESOURCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INQUIRY_TYPES = new Set(["general", "content", "resource", "account_purchase", "privacy"]);
const INQUIRY_STATUSES = new Set(["new", "open", "in_progress", "resolved", "spam"]);

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request, env) });
    try {
      const response = await route(request, env);
      return withCors(response, request, env);
    } catch (error) {
      console.error("billing-worker", error);
      return withCors(json({ error: "요청을 처리하지 못했습니다." }, 500), request, env);
    }
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, billing: "one-time-orders" });
  if (request.method === "POST" && url.pathname === "/contact/inquiries") return createCustomerInquiry(request, env);
  if (request.method === "POST" && url.pathname === "/orders/start") return startOrder(request, env);
  if (request.method === "POST" && url.pathname === "/orders/approve") return approveOrder(request, env);
  if (request.method === "POST" && url.pathname === "/orders/fail") return failOrder(request, env);
  if (request.method === "POST" && url.pathname === "/toss/webhook") return handleTossWebhook(request, env);
  if (request.method === "POST" && /^\/resources\/[^/]+\/download$/.test(url.pathname)) return downloadResource(request, env, url.pathname);
  if (request.method === "GET" && url.pathname === "/admin/orders") return getAdminOrders(request, env, url);
  if (request.method === "POST" && url.pathname === "/admin/orders/refund") return refundAdminOrder(request, env);
  if (request.method === "GET" && url.pathname === "/admin/customers") return getAdminCustomers(request, env, url);
  if (request.method === "POST" && url.pathname === "/admin/inquiries/status") return updateAdminInquiry(request, env);
  if (request.method === "GET" && url.pathname === "/admin/community/reports") return getCommunityReports(request, env);
  if (request.method === "POST" && url.pathname === "/admin/community/moderate") return moderateCommunity(request, env);
  return json({ error: "찾을 수 없는 API입니다." }, 404);
}

function normalizeOrigin(value) {
  try { return new URL(String(value || "")).origin; } catch { return ""; }
}

function allowedOrigins(env) {
  return [...new Set([
    env.SITE_ORIGIN,
    ...String(env.ALLOWED_ORIGINS || "").split(",")
  ].map(normalizeOrigin).filter(Boolean))];
}

function isProjectPreviewOrigin(origin, env) {
  const suffix = String(env.PAGES_PREVIEW_HOST_SUFFIX || "").trim().toLowerCase().replace(/^\.+/, "");
  if (!suffix) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.toLowerCase().endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin, env) {
  return allowedOrigins(env).includes(origin) || isProjectPreviewOrigin(origin, env);
}

function checkoutOrigin(request, env) {
  const origins = allowedOrigins(env);
  if (!origins.length) throw new Error("SITE_ORIGIN is required");
  const requestOrigin = normalizeOrigin(request.headers.get("Origin"));
  return isAllowedOrigin(requestOrigin, env) ? requestOrigin : origins[0];
}

function corsHeaders(request, env) {
  const origins = allowedOrigins(env);
  const requestOrigin = normalizeOrigin(request.headers.get("Origin"));
  const allowedOrigin = isAllowedOrigin(requestOrigin, env) ? requestOrigin : (origins[0] || "null");
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
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(", ")}`);
}

function isSafeResourceId(value) {
  return typeof value === "string" && RESOURCE_ID_PATTERN.test(value);
}

function isSafeProductId(value) {
  return typeof value === "string" && PRODUCT_ID_PATTERN.test(value);
}

function isSafeOrderId(value) {
  return typeof value === "string" && ORDER_ID_PATTERN.test(value);
}

function isSafeUuid(value) {
  return typeof value === "string" && RESOURCE_ID_PATTERN.test(value);
}

function isSafePaymentKey(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
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

function trimmedText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizedEmail(value) {
  return trimmedText(value, 254).toLowerCase();
}

function validEmail(value) {
  return EMAIL_PATTERN.test(value) && value.length <= 254;
}

function escapeEmailHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inquiryTypeLabel(value) {
  return {
    general: "일반 문의",
    content: "콘텐츠 문의",
    resource: "신앙자료 문의",
    account_purchase: "계정·구매 문의",
    privacy: "개인정보 문의"
  }[value] || "문의";
}

async function findCustomerContact(env, member, email) {
  if (member?.id) {
    const byUser = await rest(
      env,
      `customer_contacts?user_id=eq.${encodeURIComponent(member.id)}&limit=1&select=*`
    );
    if (byUser?.[0]) return byUser[0];
  }
  const byEmail = await rest(
    env,
    `customer_contacts?normalized_email=eq.${encodeURIComponent(email)}&limit=1&select=*`
  );
  return byEmail?.[0] || null;
}

async function saveCustomerContact(env, member, payload) {
  const now = new Date().toISOString();
  const current = await findCustomerContact(env, member, payload.email);
  const lifecycleStage = current?.lifecycle_stage === "customer"
    ? "customer"
    : (member ? "member" : (current?.lifecycle_stage || "lead"));
  const body = {
    email: payload.email,
    display_name: payload.name,
    last_seen_at: now,
    lifecycle_stage: lifecycleStage
  };
  if (member?.id) body.user_id = member.id;

  if (current) {
    const rows = await rest(env, `customer_contacts?id=eq.${encodeURIComponent(current.id)}`, {
      method: "PATCH",
      body
    });
    return rows?.[0] || current;
  }

  const rows = await rest(env, "customer_contacts", {
    method: "POST",
    body: {
      ...body,
      source: member ? "membership" : "contact_form",
      first_seen_at: now
    }
  });
  return rows?.[0] || null;
}

async function sendInquiryNotification(env, inquiry) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.CONTACT_NOTIFICATION_EMAIL) {
    return { status: "skipped", id: null };
  }
  const label = inquiryTypeLabel(inquiry.inquiry_type);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `contact-inquiry:${inquiry.id}`
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [env.CONTACT_NOTIFICATION_EMAIL],
      reply_to: inquiry.email,
      subject: `[기도의샘물] ${label} - ${inquiry.name}`,
      text: [
        `문의 유형: ${label}`,
        `이름: ${inquiry.name}`,
        `회신 이메일: ${inquiry.email}`,
        inquiry.product_id ? `자료 ID: ${inquiry.product_id}` : "",
        "",
        inquiry.message
      ].filter(Boolean).join("\n"),
      html: `<h2>${escapeEmailHtml(label)}</h2>
        <p><strong>이름:</strong> ${escapeEmailHtml(inquiry.name)}</p>
        <p><strong>회신 이메일:</strong> ${escapeEmailHtml(inquiry.email)}</p>
        ${inquiry.product_id ? `<p><strong>자료 ID:</strong> ${escapeEmailHtml(inquiry.product_id)}</p>` : ""}
        <p style="white-space:pre-wrap">${escapeEmailHtml(inquiry.message)}</p>`
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { status: "failed", id: null };
  return { status: "sent", id: trimmedText(result.id, 200) || null };
}

async function createCustomerInquiry(request, env) {
  const requestOrigin = normalizeOrigin(request.headers.get("Origin"));
  if (!requestOrigin || !isAllowedOrigin(requestOrigin, env)) {
    return json({ error: "허용되지 않은 요청입니다." }, 403);
  }
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 20000) return json({ error: "문의 내용이 너무 깁니다." }, 413);

  const raw = await readJson(request);
  if (trimmedText(raw.website, 200)) return json({ ok: true }, 202);

  const payload = {
    inquiryType: trimmedText(raw.inquiryType, 40),
    name: trimmedText(raw.name, 100),
    email: normalizedEmail(raw.email),
    productId: trimmedText(raw.productId, 120),
    message: trimmedText(raw.message, 5000)
  };
  if (
    !INQUIRY_TYPES.has(payload.inquiryType)
    || payload.name.length < 2
    || !validEmail(payload.email)
    || payload.message.length < 10
  ) {
    return json({ error: "문의 유형, 이름, 이메일, 문의 내용을 확인해 주세요." }, 400);
  }

  const member = await getMember(request, env);
  const contact = await saveCustomerContact(env, member, payload);
  if (!contact?.id) throw new Error("Customer contact was not saved");

  const created = await rest(env, "customer_inquiries", {
    method: "POST",
    body: {
      contact_id: contact.id,
      user_id: member?.id || null,
      inquiry_type: payload.inquiryType,
      name: payload.name,
      email: payload.email,
      product_id: payload.productId || null,
      message: payload.message,
      status: "new",
      notification_status: "pending"
    }
  });
  const inquiry = created?.[0] || null;
  if (!inquiry?.id) throw new Error("Customer inquiry was not saved");

  const notification = await sendInquiryNotification(env, inquiry).catch(() => ({ status: "failed", id: null }));
  await rest(env, `customer_inquiries?id=eq.${encodeURIComponent(inquiry.id)}`, {
    method: "PATCH",
    body: {
      notification_status: notification.status,
      notification_id: notification.id,
      notification_attempted_at: new Date().toISOString()
    }
  }).catch(() => null);

  return json({
    ok: true,
    inquiryId: inquiry.id,
    notificationSent: notification.status === "sent"
  }, 201);
}

async function getProfile(env, userId) {
  const rows = await rest(env, `profiles?id=eq.${encodeURIComponent(userId)}&select=id,role`);
  return rows?.[0] || null;
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

function orderIdFor() {
  return `ord_${crypto.randomUUID().replaceAll("-", "")}`;
}

function safeEventId(prefix, value) {
  return `${prefix}:${String(value || "unknown")}`.slice(0, 240);
}

function paymentAmount(payment) {
  const raw = payment?.totalAmount ?? payment?.amount?.value ?? payment?.amount;
  return typeof raw === "number" ? raw : Number(raw);
}

function paymentMatchesOrder(payment, order, paymentKey) {
  return payment
    && payment.paymentKey === paymentKey
    && payment.orderId === order.order_id
    && Number.isInteger(paymentAmount(payment))
    && paymentAmount(payment) === Number(order.amount);
}

function isCompletedPayment(payment) {
  return payment?.status === "DONE";
}

function canPurchaseProduct(product) {
  return Boolean(
    product
    && product.published
    && product.sale_status === "available"
    && product.purchasable === true
    && Number.isInteger(product.price_amount)
    && product.price_amount > 0
    && product.currency === "KRW"
  );
}

function printLicenseQuote(product, requestedValue) {
  if (!canPurchaseProduct(product)) return null;
  const isPdf = product.type === "pdf";
  const base = isPdf ? Math.max(1, Number(product.base_print_copies || 20)) : 1;
  const packSize = isPdf ? Math.max(1, Number(product.print_pack_size || 10)) : 1;
  const packPrice = isPdf ? Math.max(0, Number(product.print_pack_price || 0)) : 0;
  const requested = isPdf ? Number(requestedValue ?? base) : 1;
  if (!Number.isInteger(requested) || requested < 1 || requested > 10000) return null;
  const packs = Math.ceil(Math.max(0, requested - base) / packSize);
  const surcharge = packs * packPrice;
  return {
    requested,
    licensed: base + packs * packSize,
    basePrice: Number(product.price_amount),
    surcharge,
    amount: Number(product.price_amount) + surcharge
  };
}

function matchesCurrentOrderPolicy(product, order) {
  const quote = printLicenseQuote(product, order.requested_print_copies);
  return Boolean(quote)
    && quote.amount === Number(order.amount)
    && quote.basePrice === Number(order.base_price_amount)
    && quote.surcharge === Number(order.license_surcharge_amount)
    && quote.licensed === Number(order.licensed_print_copies)
    && product.currency === order.currency;
}

function orderTtlSeconds(env) {
  const configured = Number(env.ORDER_TTL_SECONDS || 1800);
  return Number.isInteger(configured) && configured >= 60 && configured <= 7200 ? configured : 1800;
}

function orderExpiresAt(env) {
  return new Date(Date.now() + (orderTtlSeconds(env) * 1000)).toISOString();
}

function isOrderExpired(order) {
  const expiry = Date.parse(order?.expires_at || "");
  return !Number.isFinite(expiry) || expiry <= Date.now();
}

function isUniqueViolation(error) {
  return String(error?.message || error).includes("23505");
}

async function getProduct(env, productId) {
  const rows = await rest(
    env,
    `faith_products?id=eq.${encodeURIComponent(productId)}&select=id,resource_id,type,title,sale_status,price_amount,currency,purchasable,published,base_print_copies,print_pack_size,print_pack_price`
  );
  return rows?.[0] || null;
}

async function getOrderForMember(env, userId, orderId, status) {
  const statusFilter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
  const rows = await rest(
    env,
    `faith_orders?user_id=eq.${encodeURIComponent(userId)}&order_id=eq.${encodeURIComponent(orderId)}${statusFilter}&select=*`
  );
  return rows?.[0] || null;
}

async function getOrderByExternalId(env, orderId) {
  const rows = await rest(env, `faith_orders?order_id=eq.${encodeURIComponent(orderId)}&select=*`);
  return rows?.[0] || null;
}

async function getActiveOrPaidOrderForProduct(env, userId, productId) {
  const rows = await rest(
    env,
    `faith_orders?user_id=eq.${encodeURIComponent(userId)}&product_id=eq.${encodeURIComponent(productId)}&status=in.(ready,paid)&order=created_at.desc&limit=1&select=*`
  );
  return rows?.[0] || null;
}

function checkoutPayload(product, order, env, origin, reused = false) {
  return {
    orderId: order.order_id,
    productId: product.id,
    resourceId: order.resource_id || product.resource_id || null,
    amount: Number(order.amount),
    currency: order.currency,
    orderName: product.title,
    requestedPrintCopies: Number(order.requested_print_copies || 1),
    licensedPrintCopies: Number(order.licensed_print_copies || 1),
    basePriceAmount: Number(order.base_price_amount || order.amount),
    licenseSurchargeAmount: Number(order.license_surcharge_amount || 0),
    clientKey: env.TOSS_CLIENT_KEY,
    successUrl: `${origin}/account.html?order=success`,
    failUrl: `${origin}/account.html?order=fail`,
    reused
  };
}

function existingOrderResponse(product, order, env, origin) {
  if (order.status === "paid") {
    return json({ error: "이미 구매한 자료입니다. 내 자료실에서 다시 이용해 주세요.", code: "already_purchased", resourceId: order.resource_id || null }, 409);
  }
  return json(checkoutPayload(product, order, env, origin, true));
}

async function recordPaymentEvent(env, event) {
  try {
    await rest(env, "faith_payment_events", {
      method: "POST",
      body: {
        provider: "toss",
        provider_event_id: safeEventId(event.providerEventIdPrefix || "payment", event.providerEventId),
        event_type: event.eventType ? String(event.eventType).slice(0, 120) : null,
        external_order_id: event.orderId ? String(event.orderId).slice(0, 64) : null,
        payment_key: event.paymentKey ? String(event.paymentKey).slice(0, 200) : null,
        payment_status: event.paymentStatus ? String(event.paymentStatus).slice(0, 40) : null,
        processed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    // 중복 웹훅/승인 요청은 같은 검증 결과를 다시 기록하지 않습니다.
    if (!String(error.message).includes("23505")) throw error;
  }
}

async function startOrder(request, env) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  requireEnv(env, ["TOSS_CLIENT_KEY", "SITE_ORIGIN"]);
  const { productId, printCopies } = await readJson(request);
  if (!isSafeProductId(productId)) return json({ error: "상품 정보가 올바르지 않습니다." }, 400);

  const product = await getProduct(env, productId);
  if (!product || !product.published) return json({ error: "자료를 찾지 못했습니다." }, 404);
  if (!canPurchaseProduct(product)) {
    return json({ error: "현재 온라인 결제를 제공하지 않는 자료입니다. 자료 문의하기를 이용해 주세요.", code: "inquiry_only" }, 409);
  }
  const quote = printLicenseQuote(product, printCopies);
  if (!quote) return json({ error: "인쇄 부수는 1부 이상 10,000부 이하의 정수로 입력해 주세요." }, 400);

  const origin = checkoutOrigin(request, env);
  const existing = await getActiveOrPaidOrderForProduct(env, member.id, product.id);
  if (existing?.status === "paid") return existingOrderResponse(product, existing, env, origin);
  if (existing?.status === "ready" && !isOrderExpired(existing) && matchesCurrentOrderPolicy(product, existing) && Number(existing.requested_print_copies) === quote.requested) {
    return existingOrderResponse(product, existing, env, origin);
  }
  if (existing?.status === "ready") {
    if (isOrderExpired(existing)) await markOrderFailed(env, existing);
    else await cancelReadyOrder(env, existing);
  }

  const orderId = orderIdFor();
  let created;
  try {
    created = await rest(env, "faith_orders", {
      method: "POST",
      body: {
        user_id: member.id,
        product_id: product.id,
        resource_id: product.resource_id || null,
        order_id: orderId,
        amount: quote.amount,
        base_price_amount: quote.basePrice,
        license_surcharge_amount: quote.surcharge,
        requested_print_copies: quote.requested,
        licensed_print_copies: quote.licensed,
        currency: product.currency,
        status: "ready",
        expires_at: orderExpiresAt(env)
      }
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const concurrent = await getActiveOrPaidOrderForProduct(env, member.id, product.id);
    if (concurrent) return existingOrderResponse(product, concurrent, env, origin);
    throw error;
  }
  const order = created?.[0];
  if (!order) throw new Error("주문을 만들지 못했습니다.");
  await recordPaymentEvent(env, {
    providerEventIdPrefix: "order-created",
    providerEventId: orderId,
    eventType: "order.created",
    orderId
  });

  return json(checkoutPayload(product, order, env, origin));
}

async function markOrderFailed(env, order) {
  const updated = await rest(env, `faith_orders?id=eq.${encodeURIComponent(order.id)}&status=eq.ready`, {
    method: "PATCH",
    body: { status: "failed" }
  });
  return updated?.[0] || order;
}

async function cancelReadyOrder(env, order) {
  const updated = await rest(env, `faith_orders?id=eq.${encodeURIComponent(order.id)}&status=eq.ready`, {
    method: "PATCH",
    body: { status: "canceled", canceled_at: new Date().toISOString() }
  });
  return updated?.[0] || order;
}

async function finalizePaidOrder(env, order, payment, paymentKey, eventPrefix = "confirm") {
  if (!paymentMatchesOrder(payment, order, paymentKey)) throw new Error("결제 정보가 주문과 일치하지 않습니다.");
  if (!isCompletedPayment(payment)) return null;
  const paidAt = payment.approvedAt || new Date().toISOString();
  const updated = await rest(env, `faith_orders?id=eq.${encodeURIComponent(order.id)}&status=eq.ready`, {
    method: "PATCH",
    body: { status: "paid", payment_key: paymentKey, paid_at: paidAt }
  });
  let finalized = updated?.[0] || null;
  if (!finalized) {
    finalized = await getOrderByExternalId(env, order.order_id);
    if (!finalized || finalized.status !== "paid" || finalized.payment_key !== paymentKey) {
      throw new Error("결제 상태를 저장하지 못했습니다.");
    }
  }
  await recordPaymentEvent(env, {
    providerEventIdPrefix: eventPrefix,
    providerEventId: paymentKey,
    eventType: "payment.paid",
    orderId: order.order_id,
    paymentKey,
    paymentStatus: payment.status
  });
  return finalized;
}

function publicOrder(order) {
  return {
    id: order.id,
    orderId: order.order_id,
    productId: order.product_id,
    resourceId: order.resource_id || null,
    status: order.status,
    requestedPrintCopies: Number(order.requested_print_copies || 1),
    licensedPrintCopies: Number(order.licensed_print_copies || 1),
    basePriceAmount: Number(order.base_price_amount || order.amount),
    licenseSurchargeAmount: Number(order.license_surcharge_amount || 0),
    paidAt: order.paid_at || null
  };
}

async function failOrder(request, env) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  const { orderId } = await readJson(request);
  if (!isSafeOrderId(orderId)) return json({ error: "결제 실패 주문 정보가 올바르지 않습니다." }, 400);

  const order = await getOrderForMember(env, member.id, orderId);
  if (!order) return json({ error: "결제 요청을 찾지 못했습니다." }, 404);
  if (order.status !== "ready") return json({ ok: true, order: publicOrder(order), alreadySettled: true });

  const failed = await markOrderFailed(env, order);
  await recordPaymentEvent(env, {
    providerEventIdPrefix: "checkout-failed",
    providerEventId: order.order_id,
    eventType: "payment.checkout_failed",
    orderId: order.order_id,
    paymentStatus: "failed"
  });
  return json({ ok: true, order: publicOrder(failed) });
}

async function approveOrder(request, env) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  const { paymentKey, orderId } = await readJson(request);
  if (!isSafePaymentKey(paymentKey) || !isSafeOrderId(orderId)) return json({ error: "결제 승인 정보가 올바르지 않습니다." }, 400);

  const order = await getOrderForMember(env, member.id, orderId, "ready");
  if (!order) {
    const existing = await getOrderForMember(env, member.id, orderId);
    if (existing?.status === "paid" && existing.payment_key === paymentKey) return json({ ok: true, order: publicOrder(existing) });
    return json({ error: "유효한 결제 요청을 찾지 못했습니다." }, 404);
  }

  if (isOrderExpired(order)) {
    await markOrderFailed(env, order);
    await recordPaymentEvent(env, {
      providerEventIdPrefix: "order-expired",
      providerEventId: order.order_id,
      eventType: "payment.order_expired",
      orderId: order.order_id,
      paymentStatus: "expired"
    });
    return json({ error: "결제 요청 시간이 지났습니다. 자료 상세에서 다시 구매를 시작해 주세요.", code: "order_expired" }, 409);
  }

  const product = await getProduct(env, order.product_id);
  if (!matchesCurrentOrderPolicy(product, order)) {
    await cancelReadyOrder(env, order);
    await recordPaymentEvent(env, {
      providerEventIdPrefix: "order-policy-changed",
      providerEventId: order.order_id,
      eventType: "payment.order_policy_changed",
      orderId: order.order_id,
      paymentStatus: "canceled"
    });
    return json({ error: "이 자료의 판매 정보가 변경되었습니다. 최신 이용 방법을 확인해 주세요.", code: "order_policy_changed" }, 409);
  }

  try {
    const payment = await tossRequest(env, "/v1/payments/confirm", {
      body: { paymentKey, orderId, amount: order.amount },
      headers: { "Idempotency-Key": order.id }
    });
    if (!paymentMatchesOrder(payment, order, paymentKey)) {
      await markOrderFailed(env, order);
      return json({ error: "결제 금액 또는 주문 정보가 일치하지 않습니다." }, 400);
    }
    const finalized = await finalizePaidOrder(env, order, payment, paymentKey);
    if (!finalized) {
      await recordPaymentEvent(env, {
        providerEventIdPrefix: "confirm-pending",
        providerEventId: paymentKey,
        eventType: "payment.pending",
        orderId,
        paymentKey,
        paymentStatus: payment.status
      });
      return json({ ok: false, pending: true, order: publicOrder(order) }, 202);
    }
    return json({ ok: true, order: publicOrder(finalized) });
  } catch (error) {
    // 결제 승인 요청은 재시도될 수 있으므로, 승인 결과를 먼저 조회해 중복 승인 여부를 확인합니다.
    let payment = null;
    try { payment = await tossRequest(env, `/v1/payments/${encodeURIComponent(paymentKey)}`, { method: "GET" }); } catch { /* provider query failed */ }
    if (paymentMatchesOrder(payment, order, paymentKey) && isCompletedPayment(payment)) {
      const finalized = await finalizePaidOrder(env, order, payment, paymentKey, "confirm-recovered");
      return json({ ok: true, order: publicOrder(finalized) });
    }
    if (paymentMatchesOrder(payment, order, paymentKey) && ["CANCELED", "ABORTED", "EXPIRED"].includes(payment?.status)) {
      await settleTerminalPayment(env, order, payment);
    }
    await recordPaymentEvent(env, {
      providerEventIdPrefix: "confirm-failed",
      providerEventId: paymentKey,
      eventType: "payment.confirm_failed",
      orderId,
      paymentKey,
      paymentStatus: payment?.status || "failed"
    });
    return json({ error: "결제 승인을 완료하지 못했습니다. 잠시 후 결제 내역을 확인해 주세요." }, 400);
  }
}

async function settleTerminalPayment(env, order, payment) {
  const paymentStatus = payment?.status;
  let nextStatus = null;
  if (paymentStatus === "CANCELED") nextStatus = order.status === "paid" ? "refunded" : "canceled";
  if (["ABORTED", "EXPIRED"].includes(paymentStatus) && order.status === "ready") nextStatus = "failed";
  if (!nextStatus || nextStatus === order.status) return order;

  const body = {
    status: nextStatus,
    payment_key: payment.paymentKey || order.payment_key || null
  };
  if (["canceled", "refunded"].includes(nextStatus)) body.canceled_at = new Date().toISOString();
  if (nextStatus === "refunded") body.refunded_at = new Date().toISOString();
  const updated = await rest(env, `faith_orders?id=eq.${encodeURIComponent(order.id)}&status=eq.${encodeURIComponent(order.status)}`, {
    method: "PATCH",
    body
  });
  return updated?.[0] || order;
}

async function syncPaymentFromProvider(env, payment, eventType, eventId) {
  if (!payment?.orderId || !payment?.paymentKey) return null;
  const order = await getOrderByExternalId(env, payment.orderId);
  if (!order || !paymentMatchesOrder(payment, order, payment.paymentKey)) return null;

  const product = await getProduct(env, order.product_id);
  const currentPolicyMatches = matchesCurrentOrderPolicy(product, order);

  if (isCompletedPayment(payment)) {
    // 이미 승인된 결제는 임의 취소하지 않습니다. 다만 판매 정보가 바뀌었거나 만료된
    // 주문은 별도 이벤트로 남겨 운영자가 주문 단위로 확인할 수 있게 합니다.
    if ((!currentPolicyMatches || isOrderExpired(order)) && order.status === "ready") {
      await recordPaymentEvent(env, {
        providerEventIdPrefix: "webhook-policy-review",
        providerEventId: payment.paymentKey,
        eventType: "payment.completed_after_policy_change",
        orderId: order.order_id,
        paymentKey: payment.paymentKey,
        paymentStatus: payment.status
      });
    }
    const finalized = order.status === "paid"
      ? order
      : await finalizePaidOrder(env, order, payment, payment.paymentKey, "webhook");
    await recordPaymentEvent(env, {
      providerEventIdPrefix: "webhook-event",
      providerEventId: eventId,
      eventType: eventType || "payment.webhook",
      orderId: order.order_id,
      paymentKey: payment.paymentKey,
      paymentStatus: payment.status
    });
    return finalized;
  }

  if (["CANCELED", "ABORTED", "EXPIRED"].includes(payment.status) && ["ready", "paid"].includes(order.status)) {
    const updated = await settleTerminalPayment(env, order, payment);
    await recordPaymentEvent(env, {
      providerEventIdPrefix: "webhook-event",
      providerEventId: eventId,
      eventType: eventType || "payment.canceled",
      orderId: order.order_id,
      paymentKey: payment.paymentKey,
      paymentStatus: payment.status
    });
    return updated;
  }

  if (order.status === "ready" && (isOrderExpired(order) || !currentPolicyMatches)) {
    const settled = isOrderExpired(order) ? await markOrderFailed(env, order) : await cancelReadyOrder(env, order);
    await recordPaymentEvent(env, {
      providerEventIdPrefix: "webhook-order-closed",
      providerEventId: payment.paymentKey,
      eventType: isOrderExpired(order) ? "payment.order_expired" : "payment.order_policy_changed",
      orderId: order.order_id,
      paymentKey: payment.paymentKey,
      paymentStatus: payment.status || "unknown"
    });
    return settled;
  }

  await recordPaymentEvent(env, {
    providerEventIdPrefix: "webhook-event",
    providerEventId: eventId,
    eventType: eventType || "payment.pending",
    orderId: order.order_id,
    paymentKey: payment.paymentKey,
    paymentStatus: payment.status || "unknown"
  });
  return order;
}

async function handleTossWebhook(request, env) {
  const payload = await readJson(request);
  const paymentKey = payload.data?.paymentKey || payload.paymentKey;
  if (!isSafePaymentKey(paymentKey)) return json({ error: "웹훅 결제 식별자가 없습니다." }, 400);

  // 일반 결제 웹훅은 원본 요청을 신뢰하지 않고 토스 API에서 다시 조회한 결과만 반영합니다.
  const payment = await tossRequest(env, `/v1/payments/${encodeURIComponent(paymentKey)}`, { method: "GET" });
  const eventId = payload.eventId || `${paymentKey}:${payload.eventType || payload.type || payment.status || "unknown"}`;
  const order = await syncPaymentFromProvider(env, payment, payload.eventType || payload.type || null, eventId);
  if (!order) return json({ error: "연결된 주문을 찾지 못했습니다." }, 404);
  return json({ ok: true, order: publicOrder(order) });
}

async function downloadResource(request, env, pathname) {
  const [member, authError] = await requireMember(request, env);
  if (authError) return authError;
  let resourceId = "";
  try { resourceId = decodeURIComponent(pathname.split("/")[2] || ""); } catch { return json({ error: "자료 정보가 올바르지 않습니다." }, 400); }
  if (!isSafeResourceId(resourceId)) return json({ error: "자료 정보가 올바르지 않습니다." }, 400);

  const resources = await rest(
    env,
    `faith_resources?id=eq.${encodeURIComponent(resourceId)}&published=eq.true&status=eq.published&limit=1&select=id,access_level`
  );
  const resource = resources?.[0] || null;
  if (!resource) return json({ error: "공개된 자료를 찾지 못했습니다." }, 404);
  const isFreeResource = resource.access_level === "free";

  const profile = await getProfile(env, member.id);
  let order = null;
  if (profile?.role !== "admin" && !isFreeResource) {
    const orders = await rest(
      env,
      `faith_orders?user_id=eq.${encodeURIComponent(member.id)}&resource_id=eq.${encodeURIComponent(resourceId)}&status=eq.paid&order=paid_at.desc&limit=1&select=id,resource_id`
    );
    order = orders?.[0] || null;
    if (!order) return json({ error: "구매를 완료한 자료만 내려받을 수 있습니다." }, 403);
  }

  const files = await rest(env, `resource_files?resource_id=eq.${encodeURIComponent(resourceId)}&order=sort_order.asc&select=object_path,file_name,mime_type,file_size`);
  if (!files?.length) return json({ error: "다운로드 파일을 찾지 못했습니다." }, 404);

  await rest(env, "resource_downloads", {
    method: "POST",
    body: { user_id: member.id, resource_id: resourceId, order_id: order?.id || null }
  });
  const downloads = await Promise.all(files.map((file) => createSignedDownload(env, file)));
  // url/fileName은 기존 단일 파일 클라이언트와의 호환을 위해 첫 파일에도 남깁니다.
  return json({
    downloads,
    url: downloads[0].url,
    fileName: downloads[0].fileName
  });
}

async function createSignedDownload(env, file) {
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/faith-resources/${file.object_path}`, {
    method: "POST",
    headers: restHeaders(env),
    body: JSON.stringify({ expiresIn: 300, download: file.file_name })
  });
  const signed = await response.json().catch(() => ({}));
  if (!response.ok || !signed.signedURL) throw new Error("보호된 다운로드 링크를 만들지 못했습니다.");
  return {
    url: `${env.SUPABASE_URL}/storage/v1${signed.signedURL}`,
    fileName: file.file_name,
    mimeType: file.mime_type || "application/octet-stream",
    fileSize: file.file_size || null
  };
}

async function requireAdmin(request, env) {
  const [member, error] = await requireMember(request, env);
  if (error) return [null, error];
  const profile = await getProfile(env, member.id);
  if (profile?.role !== "admin") return [null, json({ error: "관리자 권한이 필요합니다." }, 403)];
  return [member, null];
}

async function getAdminUsers(env) {
  requireEnv(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.users) ? payload.users : [];
}

function latestIso(...values) {
  const valid = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((value) => value.getTime()))).toISOString();
}

async function getAdminCustomers(request, env, url) {
  const [_admin, authError] = await requireAdmin(request, env);
  if (authError) return authError;

  const [users, contacts, inquiries, orders, downloads] = await Promise.all([
    getAdminUsers(env),
    rest(env, "customer_contacts?order=last_seen_at.desc&limit=2000&select=*"),
    rest(env, "customer_inquiries?order=created_at.desc&limit=1000&select=*"),
    rest(env, "faith_orders?order=created_at.desc&limit=5000&select=id,user_id,amount,status,created_at,paid_at"),
    rest(env, "resource_downloads?order=downloaded_at.desc&limit=5000&select=user_id,downloaded_at")
  ]);

  const userMap = new Map((users || []).map((user) => [user.id, user]));
  const contactByUser = new Map(
    (contacts || []).filter((contact) => contact.user_id).map((contact) => [contact.user_id, contact])
  );
  const contactByEmail = new Map(
    (contacts || []).map((contact) => [normalizedEmail(contact.email), contact])
  );
  const customerMap = new Map();

  (contacts || []).forEach((contact) => {
    customerMap.set(contact.id, {
      contact,
      user: contact.user_id ? userMap.get(contact.user_id) : null
    });
  });
  (users || []).forEach((user) => {
    const contact = contactByUser.get(user.id) || contactByEmail.get(normalizedEmail(user.email));
    const key = contact?.id || `member:${user.id}`;
    if (!customerMap.has(key)) customerMap.set(key, { contact: contact || null, user });
  });

  const inquiryByContact = new Map();
  (inquiries || []).forEach((inquiry) => {
    const bucket = inquiryByContact.get(inquiry.contact_id) || [];
    bucket.push(inquiry);
    inquiryByContact.set(inquiry.contact_id, bucket);
  });
  const ordersByUser = new Map();
  (orders || []).forEach((order) => {
    const bucket = ordersByUser.get(order.user_id) || [];
    bucket.push(order);
    ordersByUser.set(order.user_id, bucket);
  });
  const downloadsByUser = new Map();
  (downloads || []).forEach((download) => {
    const bucket = downloadsByUser.get(download.user_id) || [];
    bucket.push(download);
    downloadsByUser.set(download.user_id, bucket);
  });

  const query = trimmedText(url.searchParams.get("q"), 120).toLowerCase();
  const stage = trimmedText(url.searchParams.get("stage"), 40) || "all";
  const customers = [...customerMap.values()].map(({ contact, user }) => {
    const contactInquiries = contact ? (inquiryByContact.get(contact.id) || []) : [];
    const userOrders = user?.id ? (ordersByUser.get(user.id) || []) : [];
    const paidOrders = userOrders.filter((order) => order.status === "paid");
    const userDownloads = user?.id ? (downloadsByUser.get(user.id) || []) : [];
    const lifecycleStage = paidOrders.length
      ? "customer"
      : (user ? "member" : (contact?.lifecycle_stage || "lead"));
    return {
      id: contact?.id || null,
      userId: user?.id || contact?.user_id || null,
      email: contact?.email || user?.email || "",
      displayName: contact?.display_name || "",
      source: contact?.source || "membership",
      lifecycleStage,
      inquiryCount: contactInquiries.length,
      openInquiryCount: contactInquiries.filter(
        (inquiry) => ["new", "open", "in_progress"].includes(inquiry.status)
      ).length,
      paidOrderCount: paidOrders.length,
      totalSpent: paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      downloadCount: userDownloads.length,
      firstSeenAt: contact?.first_seen_at || user?.created_at || null,
      lastActivityAt: latestIso(
        contact?.last_seen_at,
        contactInquiries[0]?.created_at,
        userOrders[0]?.paid_at || userOrders[0]?.created_at,
        userDownloads[0]?.downloaded_at
      )
    };
  }).filter((customer) => stage === "all" || customer.lifecycleStage === stage)
    .filter((customer) => !query || [customer.email, customer.displayName, customer.userId]
      .some((value) => String(value || "").toLowerCase().includes(query)))
    .sort((a, b) => String(b.lastActivityAt || "").localeCompare(String(a.lastActivityAt || "")));

  const contactMap = new Map((contacts || []).map((contact) => [contact.id, contact]));
  const publicInquiries = (inquiries || []).map((inquiry) => {
    const contact = contactMap.get(inquiry.contact_id);
    return {
      id: inquiry.id,
      contactId: inquiry.contact_id,
      userId: inquiry.user_id || null,
      inquiryType: inquiry.inquiry_type,
      name: inquiry.name,
      email: inquiry.email,
      productId: inquiry.product_id || "",
      message: inquiry.message,
      status: inquiry.status,
      adminNotes: inquiry.admin_notes || "",
      notificationStatus: inquiry.notification_status,
      createdAt: inquiry.created_at,
      updatedAt: inquiry.updated_at,
      resolvedAt: inquiry.resolved_at,
      customerStage: contact?.lifecycle_stage || (inquiry.user_id ? "member" : "lead")
    };
  });

  return json({
    customers,
    inquiries: publicInquiries,
    stats: {
      total: customers.length,
      members: customers.filter((customer) => customer.lifecycleStage === "member").length,
      customers: customers.filter((customer) => customer.lifecycleStage === "customer").length,
      openInquiries: publicInquiries.filter(
        (inquiry) => ["new", "open", "in_progress"].includes(inquiry.status)
      ).length
    }
  });
}

async function updateAdminInquiry(request, env) {
  const [_admin, authError] = await requireAdmin(request, env);
  if (authError) return authError;
  const payload = await readJson(request);
  const inquiryId = trimmedText(payload.inquiryId, 80);
  const status = trimmedText(payload.status, 40);
  const adminNotes = trimmedText(payload.adminNotes, 5000);
  if (!isSafeUuid(inquiryId) || !INQUIRY_STATUSES.has(status)) {
    return json({ error: "문의 상태 정보를 확인해 주세요." }, 400);
  }
  const rows = await rest(env, `customer_inquiries?id=eq.${encodeURIComponent(inquiryId)}`, {
    method: "PATCH",
    body: {
      status,
      admin_notes: adminNotes || null,
      resolved_at: status === "resolved" ? new Date().toISOString() : null
    }
  });
  if (!rows?.[0]) return json({ error: "문의를 찾지 못했습니다." }, 404);
  return json({ ok: true });
}

async function getAdminUserEmails(env) {
  requireEnv(env, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) return new Map();
  const payload = await response.json().catch(() => ({}));
  const users = Array.isArray(payload?.users) ? payload.users : [];
  return new Map(users.map((user) => [user.id, user.email || ""]));
}

function publicAdminOrder(order, product, email, downloadCount) {
  return {
    id: order.id,
    orderId: order.order_id,
    userId: order.user_id,
    buyerEmail: email || "",
    productId: order.product_id,
    resourceId: order.resource_id || null,
    productTitle: product?.title || "삭제된 상품",
    productType: product?.type || "",
    amount: Number(order.amount),
    currency: order.currency,
    status: order.status,
    createdAt: order.created_at,
    paidAt: order.paid_at || null,
    canceledAt: order.canceled_at || null,
    refundedAt: order.refunded_at || null,
    refundReason: order.refund_reason || "",
    requestedPrintCopies: Number(order.requested_print_copies || 1),
    licensedPrintCopies: Number(order.licensed_print_copies || 1),
    basePriceAmount: Number(order.base_price_amount || order.amount),
    licenseSurchargeAmount: Number(order.license_surcharge_amount || 0),
    downloadCount
  };
}

async function getAdminOrders(request, env, url) {
  const [_admin, authError] = await requireAdmin(request, env);
  if (authError) return authError;

  const orders = await rest(
    env,
    "faith_orders?order=created_at.desc&limit=200&select=id,user_id,product_id,resource_id,order_id,amount,currency,status,created_at,paid_at,canceled_at,refunded_at,refund_reason,requested_print_copies,licensed_print_copies,base_price_amount,license_surcharge_amount"
  );
  const products = await rest(env, "faith_products?limit=1000&select=id,title,type");
  const downloads = await rest(env, "resource_downloads?order_id=not.is.null&limit=5000&select=order_id");
  const emailMap = await getAdminUserEmails(env);
  const productMap = new Map((products || []).map((product) => [product.id, product]));
  const downloadMap = new Map();
  (downloads || []).forEach((download) => {
    downloadMap.set(download.order_id, (downloadMap.get(download.order_id) || 0) + 1);
  });

  const status = String(url.searchParams.get("status") || "all");
  const type = String(url.searchParams.get("type") || "all");
  const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const rows = (orders || [])
    .map((order) => publicAdminOrder(
      order,
      productMap.get(order.product_id),
      emailMap.get(order.user_id),
      downloadMap.get(order.id) || 0
    ))
    .filter((order) => status === "all" || order.status === status)
    .filter((order) => type === "all" || order.productType === type)
    .filter((order) => !query || [
      order.productTitle,
      order.orderId,
      order.buyerEmail,
      order.userId
    ].some((value) => String(value || "").toLowerCase().includes(query)));

  const stats = (orders || []).reduce((result, order) => {
    result.total += 1;
    if (order.status === "paid") result.paid += 1;
    if (order.status === "refunded") result.refunded += 1;
    if (order.status === "ready") result.ready += 1;
    return result;
  }, { total: 0, paid: 0, refunded: 0, ready: 0 });

  return json({ orders: rows, stats });
}

async function refundAdminOrder(request, env) {
  const [admin, authError] = await requireAdmin(request, env);
  if (authError) return authError;

  const payload = await readJson(request);
  const orderId = String(payload.orderId || "");
  const reason = String(payload.reason || "").trim();
  const confirmDownloaded = payload.confirmDownloaded === true;
  if (!isSafeUuid(orderId) || reason.length < 2 || reason.length > 300) {
    return json({ error: "환불 주문과 사유를 확인해 주세요." }, 400);
  }

  const rows = await rest(env, `faith_orders?id=eq.${encodeURIComponent(orderId)}&select=*`);
  const order = rows?.[0] || null;
  if (!order) return json({ error: "주문을 찾지 못했습니다." }, 404);
  if (order.status === "refunded") {
    return json({ ok: true, alreadyRefunded: true, order: publicOrder(order) });
  }
  if (order.status !== "paid" || !isSafePaymentKey(order.payment_key)) {
    return json({ error: "결제 완료 주문만 전액 환불할 수 있습니다." }, 409);
  }

  const downloads = await rest(env, `resource_downloads?order_id=eq.${encodeURIComponent(order.id)}&select=id`);
  const downloadCount = downloads?.length || 0;
  if (downloadCount > 0 && !confirmDownloaded) {
    return json({
      error: "원본 다운로드 이력이 있습니다. 환불 제한 여부를 확인한 뒤 다시 승인해 주세요.",
      code: "downloaded_requires_review",
      downloadCount
    }, 409);
  }

  const inserted = await rest(env, "faith_refund_actions", {
    method: "POST",
    body: {
      order_id: order.id,
      actor_id: admin.id,
      reason,
      amount: Number(order.amount),
      download_count: downloadCount,
      status: "requested"
    }
  });
  const action = inserted?.[0] || null;
  if (!action) throw new Error("환불 감사 기록을 만들지 못했습니다.");

  try {
    const payment = await tossRequest(env, `/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`, {
      body: { cancelReason: reason },
      headers: { "Idempotency-Key": `refund:${order.id}` }
    });
    if (payment?.status !== "CANCELED") {
      throw new Error("토스페이먼츠 환불 상태를 확인하지 못했습니다.");
    }

    const now = new Date().toISOString();
    const updated = await rest(env, `faith_orders?id=eq.${encodeURIComponent(order.id)}&status=eq.paid`, {
      method: "PATCH",
      body: {
        status: "refunded",
        canceled_at: now,
        refunded_at: now,
        refund_reason: reason
      }
    });
    const refunded = updated?.[0] || null;
    if (!refunded) throw new Error("환불 주문 상태를 저장하지 못했습니다.");

    const providerTransactionKey = payment?.cancels?.at(-1)?.transactionKey || null;
    await rest(env, `faith_refund_actions?id=eq.${encodeURIComponent(action.id)}`, {
      method: "PATCH",
      body: {
        status: "completed",
        provider_transaction_key: providerTransactionKey,
        completed_at: now
      }
    });
    await recordPaymentEvent(env, {
      providerEventIdPrefix: "admin-refund",
      providerEventId: providerTransactionKey || order.payment_key,
      eventType: "payment.refunded",
      orderId: order.order_id,
      paymentKey: order.payment_key,
      paymentStatus: payment.status
    });

    return json({ ok: true, order: publicOrder(refunded), downloadCount });
  } catch (error) {
    await rest(env, `faith_refund_actions?id=eq.${encodeURIComponent(action.id)}`, {
      method: "PATCH",
      body: {
        status: "failed",
        error_message: String(error?.message || "환불 처리 실패").slice(0, 1000),
        completed_at: new Date().toISOString()
      }
    }).catch(() => null);
    return json({ error: "환불을 완료하지 못했습니다. 토스 결제 내역을 확인해 주세요." }, 502);
  }
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
