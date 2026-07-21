(() => {
  "use strict";

  const client = window.FaithSupabase;
  const gate = document.querySelector("[data-admin-gate]");
  const panel = document.querySelector("[data-admin-panel]");
  const loginForm = document.querySelector("[data-admin-login-form]");
  const authStatus = document.querySelector("[data-admin-auth-status]");
  const statusMessage = document.querySelector("[data-customer-status]");
  const customerList = document.querySelector("[data-customer-list]");
  const inquiryList = document.querySelector("[data-inquiry-list]");
  const state = { customers: [], inquiries: [], stats: {}, loading: false, activeTab: "customers" };

  const STAGE_LABELS = { lead: "문의 고객", member: "회원", customer: "구매 고객", inactive: "비활성" };
  const TYPE_LABELS = {
    general: "일반 문의",
    content: "콘텐츠 문의",
    resource: "신앙자료 문의",
    account_purchase: "계정·구매 문의",
    privacy: "개인정보 문의"
  };
  const STATUS_LABELS = { new: "신규", open: "확인", in_progress: "처리 중", resolved: "해결", spam: "스팸" };

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

  function formatPrice(value) {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  async function accessToken() {
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || "";
  }

  async function customerApi(path, options = {}) {
    const base = String(window.FAITH_ORDER_API_URL || "").replace(/\/$/, "");
    if (!base) throw new Error("고객 관리 Worker 주소가 설정되지 않았습니다.");
    const token = await accessToken();
    if (!token) throw new Error("관리자 로그인이 필요합니다.");
    const response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "고객 관리 API 요청에 실패했습니다.");
    return data;
  }

  function renderStats() {
    ["total", "members", "customers", "openInquiries"].forEach((key) => {
      const root = document.querySelector(`[data-customer-stat="${key}"]`);
      if (root) root.textContent = String(state.stats[key] || 0);
    });
  }

  function renderCustomers() {
    if (!customerList) return;
    if (!state.customers.length) {
      customerList.innerHTML = '<div class="admin-empty">조건에 맞는 고객이 없습니다.</div>';
      return;
    }
    const head = '<div class="admin-resource-board-head admin-customer-board-head" role="row"><span role="columnheader">번호</span><span role="columnheader">최근 활동</span><span role="columnheader">단계</span><span role="columnheader">이름·이메일</span></div>';
    const rows = state.customers.map((customer, index) => {
      const detailId = `customer-detail-${customer.id || customer.userId}`;
      return `<article class="admin-resource-row">
        <button class="admin-resource-summary admin-customer-summary" type="button" data-customer-toggle aria-expanded="false" aria-controls="${escapeHtml(detailId)}">
          <span class="admin-resource-number">${state.customers.length - index}</span>
          <time datetime="${escapeHtml(customer.lastActivityAt || "")}">${escapeHtml(formatDate(customer.lastActivityAt))}</time>
          <span>${escapeHtml(STAGE_LABELS[customer.lifecycleStage] || customer.lifecycleStage)}</span>
          <strong>${escapeHtml(customer.displayName || customer.email)}</strong>
        </button>
        <div class="admin-resource-webzine" id="${escapeHtml(detailId)}" hidden>
          <div class="admin-customer-contact"><strong>${escapeHtml(customer.email)}</strong><span>${escapeHtml(customer.userId ? "회원 계정 연결" : "비회원 문의")}</span></div>
          <dl class="admin-resource-detail-meta">
            <div><dt>문의</dt><dd>${customer.inquiryCount}건 · 미처리 ${customer.openInquiryCount}건</dd></div>
            <div><dt>결제 완료</dt><dd>${customer.paidOrderCount}건 · ${escapeHtml(formatPrice(customer.totalSpent))}</dd></div>
            <div><dt>다운로드</dt><dd>${customer.downloadCount}회</dd></div>
            <div><dt>최초 확인</dt><dd>${escapeHtml(formatDate(customer.firstSeenAt))}</dd></div>
          </dl>
        </div>
      </article>`;
    }).join("");
    customerList.innerHTML = `${head}${rows}`;
  }

  function statusOptions(current) {
    return Object.entries(STATUS_LABELS)
      .map(([value, label]) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`)
      .join("");
  }

  function renderInquiries() {
    if (!inquiryList) return;
    if (!state.inquiries.length) {
      inquiryList.innerHTML = '<div class="admin-empty">접수된 문의가 없습니다.</div>';
      return;
    }
    const head = '<div class="admin-resource-board-head admin-inquiry-board-head" role="row"><span role="columnheader">번호</span><span role="columnheader">접수일</span><span role="columnheader">유형</span><span role="columnheader">문의자</span></div>';
    const rows = state.inquiries.map((inquiry, index) => {
      const detailId = `inquiry-detail-${inquiry.id}`;
      return `<article class="admin-resource-row" data-inquiry-id="${escapeHtml(inquiry.id)}">
        <button class="admin-resource-summary admin-inquiry-summary" type="button" data-inquiry-toggle aria-expanded="false" aria-controls="${escapeHtml(detailId)}">
          <span class="admin-resource-number">${state.inquiries.length - index}</span>
          <time datetime="${escapeHtml(inquiry.createdAt)}">${escapeHtml(formatDate(inquiry.createdAt))}</time>
          <span>${escapeHtml(TYPE_LABELS[inquiry.inquiryType] || inquiry.inquiryType)}</span>
          <strong>${escapeHtml(inquiry.name)}</strong>
        </button>
        <div class="admin-resource-webzine admin-inquiry-detail" id="${escapeHtml(detailId)}" hidden>
          <div class="admin-customer-contact"><a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a><span>알림 ${escapeHtml(inquiry.notificationStatus)}</span></div>
          ${inquiry.productId ? `<p><strong>자료 ID:</strong> ${escapeHtml(inquiry.productId)}</p>` : ""}
          <p class="admin-inquiry-message">${escapeHtml(inquiry.message)}</p>
          <div class="admin-inquiry-controls">
            <label>처리 상태<select data-inquiry-status>${statusOptions(inquiry.status)}</select></label>
            <label>관리자 메모<textarea rows="3" maxlength="5000" data-inquiry-notes placeholder="외부에 공개되지 않는 처리 메모">${escapeHtml(inquiry.adminNotes)}</textarea></label>
            <button class="button primary" type="button" data-inquiry-save>상태 저장</button>
            <p class="form-message" data-inquiry-row-status role="status" aria-live="polite"></p>
          </div>
        </div>
      </article>`;
    }).join("");
    inquiryList.innerHTML = `${head}${rows}`;
  }

  function queryString() {
    const params = new URLSearchParams();
    const q = document.querySelector("[data-customer-search]")?.value.trim() || "";
    const stage = document.querySelector("[data-customer-stage]")?.value || "all";
    if (q) params.set("q", q);
    if (stage !== "all") params.set("stage", stage);
    const value = params.toString();
    return value ? `?${value}` : "";
  }

  async function loadCustomers() {
    if (state.loading) return;
    state.loading = true;
    setStatus(statusMessage, "고객과 문의를 불러오고 있습니다.");
    try {
      const payload = await customerApi(`/admin/customers${queryString()}`);
      state.customers = Array.isArray(payload.customers) ? payload.customers : [];
      state.inquiries = Array.isArray(payload.inquiries) ? payload.inquiries : [];
      state.stats = payload.stats || {};
      renderStats();
      renderCustomers();
      renderInquiries();
      setStatus(statusMessage, "");
    } catch (error) {
      state.customers = [];
      state.inquiries = [];
      renderCustomers();
      renderInquiries();
      setStatus(statusMessage, error.message, true);
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
      gate.hidden = false;
      panel.hidden = true;
      return;
    }
    const { data: profile, error } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (error || profile?.role !== "admin") {
      gate.hidden = false;
      panel.hidden = true;
      setStatus(authStatus, "이 계정에는 관리자 권한이 없습니다.", true);
      return;
    }
    gate.hidden = true;
    panel.hidden = false;
    await loadCustomers();
  }

  document.addEventListener("click", async (event) => {
    const customerToggle = event.target.closest("[data-customer-toggle]");
    const inquiryToggle = event.target.closest("[data-inquiry-toggle]");
    const toggle = customerToggle || inquiryToggle;
    if (toggle) {
      const detail = document.getElementById(toggle.getAttribute("aria-controls"));
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      if (detail) detail.hidden = !open;
      return;
    }

    const tab = event.target.closest("[data-customer-tab]");
    if (tab) {
      state.activeTab = tab.dataset.customerTab;
      document.querySelectorAll("[data-customer-tab]").forEach((button) => button.classList.toggle("is-active", button === tab));
      document.querySelectorAll("[data-customer-panel]").forEach((root) => {
        root.hidden = root.dataset.customerPanel !== state.activeTab;
      });
      return;
    }

    const save = event.target.closest("[data-inquiry-save]");
    if (save) {
      const row = save.closest("[data-inquiry-id]");
      const rowStatus = row.querySelector("[data-inquiry-row-status]");
      save.disabled = true;
      setStatus(rowStatus, "문의 상태를 저장하고 있습니다.");
      try {
        await customerApi("/admin/inquiries/status", {
          method: "POST",
          body: {
            inquiryId: row.dataset.inquiryId,
            status: row.querySelector("[data-inquiry-status]").value,
            adminNotes: row.querySelector("[data-inquiry-notes]").value
          }
        });
        setStatus(rowStatus, "저장했습니다.");
        await loadCustomers();
      } catch (error) {
        setStatus(rowStatus, error.message, true);
      } finally {
        save.disabled = false;
      }
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
  document.querySelector("[data-customer-refresh]")?.addEventListener("click", loadCustomers);
  document.querySelector("[data-customer-search]")?.addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(loadCustomers, 250);
  });
  document.querySelector("[data-customer-stage]")?.addEventListener("change", loadCustomers);

  refreshAdminAccess();
})();
