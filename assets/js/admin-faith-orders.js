(() => {
  "use strict";

  const client = window.FaithSupabase;
  const gate = document.querySelector("[data-admin-gate]");
  const panel = document.querySelector("[data-admin-panel]");
  const loginForm = document.querySelector("[data-admin-login-form]");
  const authStatus = document.querySelector("[data-admin-auth-status]");
  const list = document.querySelector("[data-order-list]");
  const message = document.querySelector("[data-order-status-message]");
  const refundDialog = document.querySelector("[data-refund-dialog]");
  const refundForm = document.querySelector("[data-refund-form]");
  const state = { user: null, orders: [], stats: {}, loading: false };

  const TYPE_LABELS = { pdf: "기도문 PDF", audio: "기도 오디오북", card: "기도카드" };
  const STATUS_LABELS = {
    ready: "결제 대기",
    paid: "결제 완료",
    failed: "결제 실패",
    canceled: "결제 취소",
    refunded: "환불 완료"
  };

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setStatus(target, text = "", error = false) {
    if (!target) return;
    target.textContent = text;
    target.classList.toggle("is-error", error);
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function formatPrice(value, currency = "KRW") {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  async function accessToken() {
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || "";
  }

  async function orderApi(path, options = {}) {
    const base = String(window.FAITH_ORDER_API_URL || "").replace(/\/$/, "");
    if (!base) throw new Error("결제 Worker 주소가 설정되지 않았습니다.");
    const token = await accessToken();
    if (!token) throw new Error("관리자 로그인이 필요합니다.");
    const response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "주문 API 요청에 실패했습니다.");
      error.code = data.code || "";
      error.downloadCount = Number(data.downloadCount || 0);
      throw error;
    }
    return data;
  }

  function queryString() {
    const params = new URLSearchParams();
    const q = document.querySelector("[data-order-search]")?.value.trim() || "";
    const status = document.querySelector("[data-order-status]")?.value || "all";
    const type = document.querySelector("[data-order-type]")?.value || "all";
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (type !== "all") params.set("type", type);
    const value = params.toString();
    return value ? `?${value}` : "";
  }

  function renderStats() {
    ["total", "paid", "refunded", "ready"].forEach((key) => {
      const root = document.querySelector(`[data-stat="${key}"]`);
      if (root) root.textContent = String(state.stats[key] || 0);
    });
  }

  function renderOrders() {
    if (!list) return;
    if (!state.orders.length) {
      list.innerHTML = '<div class="admin-empty">조건에 맞는 주문이 없습니다.</div>';
      return;
    }
    const boardHead = '<div class="admin-resource-board-head" role="row"><span role="columnheader">번호</span><span role="columnheader">결제일</span><span role="columnheader">자료 유형</span><span role="columnheader">제목</span></div>';
    const rows = state.orders.map((order, index) => {
      const detailId = `admin-order-detail-${order.id}`;
      const refundButton = order.status === "paid"
        ? `<button type="button" data-refund-order="${escapeHtml(order.id)}">전액 환불</button>`
        : "";
      const email = order.buyerEmail || order.userId;
      return `<article class="admin-resource-row" data-order-id="${escapeHtml(order.id)}">
        <button class="admin-resource-summary" type="button" data-order-toggle aria-expanded="false" aria-controls="${escapeHtml(detailId)}">
          <span class="admin-resource-number">${state.orders.length - index}</span>
          <time datetime="${escapeHtml(order.paidAt || order.createdAt)}">${escapeHtml(formatDate(order.paidAt || order.createdAt))}</time>
          <span>${escapeHtml(TYPE_LABELS[order.productType] || order.productType || "-")}</span>
          <strong>${escapeHtml(order.productTitle)}</strong>
        </button>
        <div class="admin-resource-webzine" id="${escapeHtml(detailId)}" hidden>
          <div class="admin-resource-copy"><span class="admin-badge">${escapeHtml(STATUS_LABELS[order.status] || order.status)}</span><p>구매자 ${escapeHtml(email)}</p></div>
          <dl class="admin-resource-detail-meta">
            <div><dt>결제 금액</dt><dd>${escapeHtml(formatPrice(order.amount, order.currency))}</dd></div>
            <div><dt>주문번호</dt><dd>${escapeHtml(order.orderId)}</dd></div>
            <div><dt>원본 다운로드</dt><dd>${order.downloadCount}회</dd></div>
            <div><dt>환불 사유</dt><dd>${escapeHtml(order.refundReason || "-")}</dd></div>
          </dl>
          <div class="admin-resource-management"><div class="admin-resource-actions">${refundButton}</div></div>
        </div>
      </article>`;
    }).join("");
    list.innerHTML = `${boardHead}${rows}`;
  }

  async function loadOrders() {
    if (state.loading) return;
    state.loading = true;
    setStatus(message, "주문을 불러오고 있습니다.");
    try {
      const payload = await orderApi(`/admin/orders${queryString()}`);
      state.orders = Array.isArray(payload.orders) ? payload.orders : [];
      state.stats = payload.stats || {};
      renderStats();
      renderOrders();
      setStatus(message, "");
    } catch (error) {
      state.orders = [];
      renderOrders();
      setStatus(message, error.message, true);
    } finally {
      state.loading = false;
    }
  }

  async function refreshAdminAccess() {
    if (!client) {
      setStatus(authStatus, "관리자 연결을 불러오지 못했습니다.", true);
      return;
    }
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      state.user = null;
      gate.hidden = false;
      panel.hidden = true;
      return;
    }
    const { data: profile, error } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (error || profile?.role !== "admin") {
      state.user = null;
      gate.hidden = false;
      panel.hidden = true;
      setStatus(authStatus, "이 계정에는 관리자 권한이 없습니다.", true);
      return;
    }
    state.user = user;
    gate.hidden = true;
    panel.hidden = false;
    await loadOrders();
  }

  function openRefund(order) {
    if (!refundDialog || !refundForm) return;
    refundForm.reset();
    refundForm.elements.orderId.value = order.id;
    document.querySelector("[data-refund-order-summary]").textContent =
      `${order.productTitle} · ${formatPrice(order.amount, order.currency)} · 다운로드 ${order.downloadCount}회`;
    const confirmRow = document.querySelector("[data-download-confirm-row]");
    if (confirmRow) confirmRow.hidden = order.downloadCount === 0;
    setStatus(document.querySelector("[data-refund-status]"), "");
    if (typeof refundDialog.showModal === "function") refundDialog.showModal();
    else refundDialog.setAttribute("open", "");
  }

  function closeRefund() {
    if (refundDialog?.open && typeof refundDialog.close === "function") refundDialog.close();
    else refundDialog?.removeAttribute("open");
  }

  list?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-order-toggle]");
    if (toggle) {
      const detail = document.getElementById(toggle.getAttribute("aria-controls"));
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      if (detail) detail.hidden = !open;
      return;
    }
    const refund = event.target.closest("[data-refund-order]");
    if (refund) {
      const order = state.orders.find((item) => item.id === refund.dataset.refundOrder);
      if (order) openRefund(order);
    }
  });

  refundForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.querySelector("[data-refund-status]");
    const submit = refundForm.querySelector('button[type="submit"]');
    const orderId = refundForm.elements.orderId.value;
    const reason = refundForm.elements.reason.value.trim();
    const confirmDownloaded = refundForm.elements.confirmDownloaded.checked;
    submit.disabled = true;
    setStatus(status, "토스페이먼츠 전액 환불을 처리하고 있습니다.");
    try {
      await orderApi("/admin/orders/refund", {
        method: "POST",
        body: { orderId, reason, confirmDownloaded }
      });
      setStatus(status, "전액 환불을 완료했습니다.");
      await loadOrders();
      window.setTimeout(closeRefund, 700);
    } catch (error) {
      if (error.code === "downloaded_requires_review") {
        const row = document.querySelector("[data-download-confirm-row]");
        if (row) row.hidden = false;
      }
      setStatus(status, error.message, true);
    } finally {
      submit.disabled = false;
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    setStatus(authStatus, "로그인 중입니다.");
    const { error } = await client.auth.signInWithPassword({
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "")
    });
    if (error) {
      setStatus(authStatus, "관리자 로그인 정보를 확인해 주세요.", true);
      return;
    }
    setStatus(authStatus, "");
    await refreshAdminAccess();
  });

  document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
    await client.auth.signOut();
    await refreshAdminAccess();
  });
  document.querySelector("[data-order-refresh]")?.addEventListener("click", loadOrders);
  document.querySelector("[data-order-search]")?.addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadOrders, 250);
  });
  document.querySelector("[data-order-status]")?.addEventListener("change", loadOrders);
  document.querySelector("[data-order-type]")?.addEventListener("change", loadOrders);
  document.querySelector("[data-refund-close]")?.addEventListener("click", closeRefund);
  document.querySelector("[data-refund-cancel]")?.addEventListener("click", closeRefund);
  refundDialog?.addEventListener("click", (event) => {
    if (event.target === refundDialog) closeRefund();
  });

  refreshAdminAccess();
})();
