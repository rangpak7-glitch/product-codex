(() => {
  const SUPABASE_SCRIPT = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.js";
  const TOSS_SCRIPT = "https://js.tosspayments.com/v2/standard";
  const ORDER_PENDING_KEY = "faithOrderPending";
  const MEMBER_PURCHASE_GUIDANCE = "구매한 자료의 내역 확인과 다운로드 기능을 위해 회원 가입이 필요합니다";
  const state = {
    client: null,
    user: null,
    profile: null,
    publicProfile: null,
    orders: [],
    ordersByResource: new Map(),
    ordersLoaded: false,
    ordersLoading: null,
    ordersUserId: null,
    initialized: false
  };
  let modalDownloadFiles = [];
  const paymentWidgetState = {
    widgets: null,
    paymentMethods: null,
    agreement: null,
    pending: null,
    trigger: null
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function orderApiUrl() {
    return window.FAITH_ORDER_API_URL || "";
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src === src);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("스크립트를 불러오지 못했습니다.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", () => reject(new Error("스크립트를 불러오지 못했습니다.")), { once: true });
      document.head.append(script);
    });
  }

  async function getClient() {
    if (window.FaithSupabase) return window.FaithSupabase;
    if (!window.supabase?.createClient) await loadScript(SUPABASE_SCRIPT);
    if (!window.FaithSupabase) await loadScript(new URL("assets/js/supabase-config.js?v=20260715-worker1", window.location.href).href);
    return window.FaithSupabase || null;
  }

  function ensureModal() {
    if (document.getElementById("faithLoginModal")) return;
    const authMarkup = `
      <div id="faithLoginModal" class="faith-auth-modal" data-faith-auth-modal="login" hidden>
        <div class="faith-auth-backdrop" data-faith-auth-close></div>
        <section class="faith-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="faithLoginTitle">
          <button class="modal-close" type="button" data-faith-auth-close aria-label="로그인 창 닫기">×</button>
          <p class="eyebrow">Member Login</p>
          <h2 id="faithLoginTitle">기도의샘물 로그인</h2>
          <form id="faithLoginForm" class="faith-auth-form" novalidate>
            <label>이메일<input type="email" name="email" autocomplete="email" required placeholder="example@email.com"></label>
            <label>비밀번호<input type="password" name="password" autocomplete="current-password" required placeholder="비밀번호"></label>
            <button class="button primary" type="submit">로그인</button>
            <button class="text-button" type="button" data-faith-password-reset>비밀번호를 잊으셨나요?</button>
          </form>
          <p class="form-message" data-faith-auth-status role="status" aria-live="polite"></p>
          <div class="faith-auth-switch"><span>아직 회원이 아니신가요?</span><button class="text-button" type="button" data-faith-switch="signup">회원가입</button></div>
        </section>
      </div>
      <div id="faithSignupModal" class="faith-auth-modal" data-faith-auth-modal="signup" hidden>
        <div class="faith-auth-backdrop" data-faith-auth-close></div>
        <section class="faith-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="faithSignupTitle">
          <button class="modal-close" type="button" data-faith-auth-close aria-label="회원가입 창 닫기">×</button>
          <p class="eyebrow">Create Account</p>
          <h2 id="faithSignupTitle">기도의샘물 회원가입</h2>
          <form id="faithSignupForm" class="faith-auth-form" novalidate>
            <label>닉네임<input type="text" name="nickname" autocomplete="nickname" minlength="2" maxlength="16" required placeholder="2~16자, 게시글에만 표시"></label>
            <label>이메일<input type="email" name="email" autocomplete="email" required placeholder="example@email.com"></label>
            <label>비밀번호<input type="password" name="password" autocomplete="new-password" minlength="8" required placeholder="8자 이상"></label>
            <label class="faith-consent"><input type="checkbox" name="consent" required> <span><a href="terms.html" target="_blank" rel="noopener">이용약관</a>과 <a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a>에 동의합니다.</span></label>
            <button class="button primary" type="submit">인증 메일 받고 가입하기</button>
            <p class="form-message">이메일은 공개되지 않으며, 게시판에는 닉네임만 표시됩니다.</p>
          </form>
          <p class="form-message" data-faith-auth-status role="status" aria-live="polite"></p>
          <div class="faith-auth-switch"><span>이미 가입하셨나요?</span><button class="text-button" type="button" data-faith-switch="login">로그인</button></div>
        </section>
      </div>
      <div id="faithResetModal" class="faith-auth-modal" data-faith-auth-modal="reset" hidden>
        <div class="faith-auth-backdrop" data-faith-auth-close></div>
        <section class="faith-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="faithResetTitle">
          <button class="modal-close" type="button" data-faith-auth-close aria-label="비밀번호 재설정 창 닫기">×</button>
          <p class="eyebrow">Password Reset</p>
          <h2 id="faithResetTitle">비밀번호 재설정</h2>
          <form id="faithResetForm" class="faith-auth-form faith-reset-form" novalidate>
            <p class="faith-auth-guidance">가입한 이메일을 입력하면 새 비밀번호를 설정할 수 있는 링크를 보내드립니다.</p>
            <label>가입 이메일<input type="email" name="email" autocomplete="email" required placeholder="example@email.com"></label>
            <button class="button primary" type="submit">재설정 메일 보내기</button>
            <button class="text-button" type="button" data-faith-switch="login">로그인으로 돌아가기</button>
          </form>
          <p class="form-message" data-faith-auth-status role="status" aria-live="polite"></p>
        </section>
      </div>
      <div id="faithAuthNoticeModal" class="faith-auth-notice-modal" hidden>
        <div class="faith-auth-notice-backdrop"></div>
        <section class="faith-auth-notice-dialog" role="alertdialog" aria-modal="true" aria-labelledby="faithAuthNoticeTitle" aria-describedby="faithAuthNoticeMessage">
          <p class="eyebrow" data-faith-notice-eyebrow>Account</p>
          <h2 id="faithAuthNoticeTitle">알림</h2>
          <p id="faithAuthNoticeMessage"></p>
          <button class="button primary" type="button" data-faith-notice-close>확인</button>
        </section>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", authMarkup);

    document.querySelectorAll("[data-faith-auth-close]").forEach((button) => button.addEventListener("click", close));
    document.querySelectorAll("[data-faith-switch]").forEach((button) => button.addEventListener("click", () => open(button.dataset.faithSwitch)));
    document.querySelector("#faithLoginForm")?.addEventListener("submit", submitLogin);
    document.querySelector("#faithSignupForm")?.addEventListener("submit", submitSignup);
    document.querySelector("#faithResetForm")?.addEventListener("submit", requestPasswordReset);
    document.querySelector("[data-faith-password-reset]")?.addEventListener("click", openPasswordReset);
    document.querySelector("[data-faith-notice-close]")?.addEventListener("click", closeNotice);
  }

  function ensureDownloadModal() {
    if (document.getElementById("faithDownloadModal")) return;
    const root = document.createElement("div");
    root.id = "faithDownloadModal";
    root.className = "faith-download-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="faith-download-backdrop" data-faith-download-close></div>
      <section class="faith-download-dialog" role="dialog" aria-modal="true" aria-labelledby="faithDownloadTitle">
        <button class="modal-close" type="button" data-faith-download-close aria-label="다운로드 창 닫기">×</button>
        <p class="eyebrow">Purchased files</p>
        <h2 id="faithDownloadTitle">구매 자료 다운로드</h2>
        <p class="faith-download-guidance">각 파일 오른쪽의 아래 화살표를 누르면 바로 다운로드됩니다. 다운로드 링크는 잠시 후 만료됩니다.</p>
        <div class="faith-download-list" data-faith-download-list></div>
        <p class="faith-download-status" data-faith-download-status role="status" aria-live="polite"></p>
        <button class="button secondary" type="button" data-faith-download-close>닫기</button>
      </section>`;
    document.body.append(root);
    root.querySelectorAll("[data-faith-download-close]").forEach((button) => button.addEventListener("click", closeDownloadModal));
    root.querySelector("[data-faith-download-list]")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-faith-download-index]");
      if (!button || button.disabled) return;
      const file = modalDownloadFiles[Number(button.dataset.faithDownloadIndex)];
      const status = root.querySelector("[data-faith-download-status]");
      const icon = button.querySelector("[data-faith-download-icon]");
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      if (icon) icon.textContent = "…";
      if (status) status.textContent = `${file?.fileName || "자료 파일"}을 내려받고 있습니다.`;
      try {
        await saveProtectedFile(file);
        if (icon) icon.textContent = "✓";
        if (status) status.textContent = `${file.fileName || "자료 파일"} 다운로드를 시작했습니다.`;
      } catch (error) {
        if (icon) icon.textContent = "!";
        if (status) status.textContent = error.message;
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    });
  }

  function ensurePaymentModal() {
    if (document.getElementById("faithPaymentModal")) return;
    const root = document.createElement("div");
    root.id = "faithPaymentModal";
    root.className = "faith-payment-modal";
    root.hidden = true;
    root.innerHTML = `
      <div class="faith-payment-backdrop" data-faith-payment-close></div>
      <section class="faith-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="faithPaymentTitle" aria-describedby="faithPaymentGuidance">
        <header class="faith-payment-header">
          <div>
            <p class="eyebrow">Secure checkout</p>
            <h2 id="faithPaymentTitle">신앙자료 결제</h2>
          </div>
          <button class="modal-close" type="button" data-faith-payment-close aria-label="결제창 닫기">×</button>
        </header>
        <div class="faith-payment-summary" aria-live="polite">
          <span data-faith-payment-order-name>신앙자료</span>
          <strong data-faith-payment-amount>결제 금액 확인 중</strong>
        </div>
        <p id="faithPaymentGuidance" class="faith-payment-guidance">결제수단을 선택하고 필수 약관에 동의한 뒤 결제를 진행해 주세요.</p>
        <div class="faith-payment-widget" data-faith-payment-widget aria-busy="true">
          <div id="faithPaymentMethods"></div>
          <div id="faithPaymentAgreement"></div>
        </div>
        <p class="faith-payment-status" data-faith-payment-status role="status" aria-live="polite">안전한 결제 화면을 불러오고 있습니다.</p>
        <footer class="faith-payment-actions">
          <button class="button secondary" type="button" data-faith-payment-close>취소</button>
          <button class="button primary" type="button" data-faith-payment-submit disabled>결제하기</button>
        </footer>
      </section>`;
    document.body.append(root);
    root.querySelectorAll("[data-faith-payment-close]").forEach((button) => button.addEventListener("click", () => closePaymentModal()));
    root.querySelector("[data-faith-payment-submit]")?.addEventListener("click", submitPaymentWidget);
  }

  function getAuthModal(mode) {
    return document.querySelector(`[data-faith-auth-modal="${mode}"]`);
  }

  function getOpenAuthModal() {
    return [...document.querySelectorAll("[data-faith-auth-modal]")].find((modal) => !modal.hidden) || null;
  }

  function syncModalOpenState() {
    const selector = ".faith-auth-modal:not([hidden]), .faith-auth-notice-modal:not([hidden]), .faith-download-modal:not([hidden]), .faith-payment-modal:not([hidden])";
    document.body.classList.toggle("modal-open", Boolean(document.querySelector(selector)));
  }

  function setStatus(message, error = false, mode = "") {
    const root = mode ? getAuthModal(mode) : getOpenAuthModal();
    const status = root?.querySelector("[data-faith-auth-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", error);
  }

  function showNotice({ title, message, tone = "info", eyebrow = "Account" }) {
    ensureModal();
    const root = document.getElementById("faithAuthNoticeModal");
    root.dataset.tone = tone;
    root.querySelector("[data-faith-notice-eyebrow]").textContent = eyebrow;
    root.querySelector("#faithAuthNoticeTitle").textContent = title;
    root.querySelector("#faithAuthNoticeMessage").textContent = message;
    root.hidden = false;
    syncModalOpenState();
    window.setTimeout(() => root.querySelector("[data-faith-notice-close]")?.focus(), 0);
  }

  function closeNotice() {
    const root = document.getElementById("faithAuthNoticeModal");
    if (!root) return;
    root.hidden = true;
    syncModalOpenState();
    const authModal = getOpenAuthModal();
    window.setTimeout(() => authModal?.querySelector("input, button")?.focus(), 0);
  }

  function open(mode = "login", message = "") {
    ensureModal();
    const normalizedMode = ["login", "signup", "reset"].includes(mode) ? mode : "login";
    closeNotice();
    document.querySelectorAll("[data-faith-auth-modal]").forEach((modal) => {
      modal.hidden = modal.dataset.faithAuthModal !== normalizedMode;
      const status = modal.querySelector("[data-faith-auth-status]");
      if (status) {
        status.textContent = "";
        status.classList.remove("is-error");
      }
    });
    const root = getAuthModal(normalizedMode);
    root.hidden = false;
    if (message) setStatus(message, false, normalizedMode);
    syncModalOpenState();
    const focusSelector = normalizedMode === "signup" ? "[name='nickname']" : "[name='email']";
    window.setTimeout(() => root.querySelector(focusSelector)?.focus(), 0);
  }

  function close(mode) {
    const normalizedMode = typeof mode === "string" && ["login", "signup", "reset"].includes(mode) ? mode : "";
    if (normalizedMode) {
      const root = getAuthModal(normalizedMode);
      if (root) root.hidden = true;
    } else {
      document.querySelectorAll("[data-faith-auth-modal]").forEach((modal) => { modal.hidden = true; });
    }
    syncModalOpenState();
  }

  function closeDownloadModal() {
    const root = document.getElementById("faithDownloadModal");
    if (!root) return;
    root.hidden = true;
    modalDownloadFiles = [];
    syncModalOpenState();
  }

  async function destroyPaymentWidget() {
    const instances = [paymentWidgetState.paymentMethods, paymentWidgetState.agreement];
    paymentWidgetState.paymentMethods = null;
    paymentWidgetState.agreement = null;
    paymentWidgetState.widgets = null;
    await Promise.allSettled(instances.map((instance) => {
      if (!instance || typeof instance.destroy !== "function") return Promise.resolve();
      return Promise.resolve(instance.destroy());
    }));
    const methods = document.getElementById("faithPaymentMethods");
    const agreement = document.getElementById("faithPaymentAgreement");
    if (methods) methods.replaceChildren();
    if (agreement) agreement.replaceChildren();
  }

  function setPaymentStatus(message, error = false) {
    const status = document.querySelector("[data-faith-payment-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", error);
  }

  async function closePaymentModal({ restoreFocus = true } = {}) {
    const root = document.getElementById("faithPaymentModal");
    if (!root || root.hidden) return;
    root.hidden = true;
    await destroyPaymentWidget();
    const trigger = paymentWidgetState.trigger;
    paymentWidgetState.pending = null;
    paymentWidgetState.trigger = null;
    syncModalOpenState();
    if (restoreFocus && trigger instanceof HTMLElement) window.setTimeout(() => trigger.focus(), 0);
  }

  function setFormPending(form, pending, pendingLabel) {
    const submitButton = form?.querySelector("button[type='submit']");
    if (!submitButton) return;
    if (!submitButton.dataset.defaultLabel) submitButton.dataset.defaultLabel = submitButton.textContent;
    submitButton.disabled = pending;
    submitButton.textContent = pending ? pendingLabel : submitButton.dataset.defaultLabel;
    form.toggleAttribute("aria-busy", pending);
  }

  function isEmailRateLimit(error) {
    return error?.status === 429 || error?.code === "over_email_send_rate_limit" || /rate limit|only request this after/i.test(error?.message || "");
  }

  async function submitSignup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const nickname = String(form.elements.nickname.value || "").trim();
    const email = String(form.elements.email.value || "").trim();
    const password = String(form.elements.password.value || "");
    if (nickname.length < 2 || nickname.length > 16) {
      return showNotice({ title: "닉네임을 확인해 주세요", message: "닉네임은 2자 이상 16자 이하로 입력해 주세요.", tone: "error" });
    }
    if (!form.elements.email.validity.valid) {
      return showNotice({ title: "이메일을 확인해 주세요", message: "인증 메일을 받을 수 있는 이메일 주소를 입력해 주세요.", tone: "error" });
    }
    if (password.length < 8) {
      return showNotice({ title: "비밀번호를 확인해 주세요", message: "비밀번호는 8자 이상으로 입력해 주세요.", tone: "error" });
    }
    if (!form.elements.consent.checked) {
      return showNotice({ title: "동의가 필요합니다", message: "회원가입을 위해 이용약관과 개인정보처리방침에 동의해 주세요.", tone: "error" });
    }
    const client = await getClient();
    if (!client) {
      return showNotice({ title: "회원 서비스를 연결하지 못했습니다", message: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", tone: "error" });
    }

    setFormPending(form, true, "인증 메일 보내는 중");
    setStatus("인증 메일을 보내고 있습니다.", false, "signup");
    try {
      const emailRedirectTo = new URL("account.html", window.location.href).href;
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { nickname }, emailRedirectTo } });
      if (error) {
        if (isEmailRateLimit(error)) {
          close("signup");
          return showNotice({
            title: "인증 메일을 이미 요청했습니다",
            message: "받은편지함과 스팸함을 먼저 확인해 주세요. 메일이 없으면 1분 후 다시 요청할 수 있습니다.",
            tone: "info"
          });
        }
        const duplicate = error.code === "user_already_exists" || /duplicate|unique|nickname/i.test(error.message || "");
        return showNotice({
          title: "회원가입을 완료하지 못했습니다",
          message: duplicate ? "이미 사용 중인 정보가 있습니다. 닉네임 또는 이메일을 확인해 주세요." : "입력 내용을 확인한 뒤 다시 시도해 주세요.",
          tone: "error"
        });
      }

      form.reset();
      close("signup");
      if (data.session) {
        await refreshSession();
        return showNotice({ title: "회원가입이 완료되었습니다", message: "기도의샘물 회원으로 로그인되었습니다.", tone: "success" });
      }
      showNotice({
        title: "인증 메일을 보냈습니다",
        message: `${email} 받은편지함에서 인증 링크를 눌러 회원가입을 완료해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.`,
        tone: "success"
      });
    } catch {
      showNotice({ title: "회원가입 요청을 처리하지 못했습니다", message: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", tone: "error" });
    } finally {
      setFormPending(form, false, "");
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(form.elements.email.value || "").trim();
    const password = String(form.elements.password.value || "");
    if (!form.elements.email.validity.valid || !password) {
      return showNotice({ title: "로그인 정보를 확인해 주세요", message: "이메일과 비밀번호를 모두 정확히 입력해 주세요.", tone: "error" });
    }
    const client = await getClient();
    if (!client) {
      return showNotice({ title: "회원 서비스를 연결하지 못했습니다", message: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", tone: "error" });
    }

    setFormPending(form, true, "로그인 확인 중");
    setStatus("로그인 정보를 확인하고 있습니다.", false, "login");
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.code === "email_not_confirmed") {
          return showNotice({ title: "이메일 인증이 필요합니다", message: "회원가입 때 받은 인증 메일의 링크를 먼저 눌러 주세요.", tone: "error" });
        }
        if (error.status === 429 || /rate limit|too many/i.test(error.message || "")) {
          return showNotice({ title: "로그인 요청이 너무 많습니다", message: "잠시 후 다시 시도해 주세요.", tone: "error" });
        }
        return showNotice({ title: "로그인하지 못했습니다", message: "이메일 또는 비밀번호가 일치하지 않습니다.", tone: "error" });
      }
      await refreshSession();
      form.reset();
      close("login");
      showNotice({ title: "로그인되었습니다", message: "기도의샘물 회원 서비스에 로그인되었습니다.", tone: "success" });
    } catch {
      showNotice({ title: "로그인 요청을 처리하지 못했습니다", message: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", tone: "error" });
    } finally {
      setFormPending(form, false, "");
    }
  }

  function openPasswordReset() {
    const loginForm = document.getElementById("faithLoginForm");
    const resetForm = document.getElementById("faithResetForm");
    const email = String(loginForm?.elements.email.value || "").trim();
    if (resetForm && email) resetForm.elements.email.value = email;
    open("reset");
  }

  async function requestPasswordReset(event) {
    event?.preventDefault();
    const form = event?.currentTarget || document.getElementById("faithResetForm");
    const email = String(form?.elements.email.value || "").trim();
    if (!form?.elements.email.validity.valid) {
      return showNotice({ title: "가입 이메일을 확인해 주세요", message: "비밀번호 재설정 메일을 받을 이메일 주소를 입력해 주세요.", tone: "error" });
    }
    const client = await getClient();
    if (!client) {
      return showNotice({ title: "회원 서비스를 연결하지 못했습니다", message: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", tone: "error" });
    }

    setFormPending(form, true, "재설정 메일 보내는 중");
    setStatus("비밀번호 재설정 메일을 보내고 있습니다.", false, "reset");
    try {
      const redirectTo = new URL("reset-password.html", window.location.href).href;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        if (isEmailRateLimit(error)) {
          close("reset");
          return showNotice({ title: "재설정 메일을 이미 요청했습니다", message: "받은편지함과 스팸함을 확인하고, 메일이 없으면 1분 후 다시 요청해 주세요.", tone: "info" });
        }
        return showNotice({ title: "재설정 메일을 보내지 못했습니다", message: "잠시 후 다시 시도해 주세요.", tone: "error" });
      }
      form.reset();
      close("reset");
      showNotice({
        title: "재설정 메일 요청을 완료했습니다",
        message: "입력한 이메일이 회원 계정과 일치하면 비밀번호 재설정 링크가 발송됩니다. 받은편지함과 스팸함을 확인해 주세요.",
        tone: "success"
      });
    } catch {
      showNotice({ title: "재설정 요청을 처리하지 못했습니다", message: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.", tone: "error" });
    } finally {
      setFormPending(form, false, "");
    }
  }

  async function refreshSession() {
    const client = await getClient();
    if (!client) return null;
    const { data: { user } } = await client.auth.getUser();
    state.user = user || null;
    state.profile = null;
    state.publicProfile = null;
    state.orders = [];
    state.ordersByResource.clear();
    state.ordersLoaded = false;
    state.ordersLoading = null;
    state.ordersUserId = null;
    if (user) {
      const [{ data: profile }, { data: publicProfile }] = await Promise.all([
        client.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        client.from("public_profiles").select("nickname").eq("id", user.id).maybeSingle()
      ]);
      state.profile = profile || { role: "member" };
      state.publicProfile = publicProfile || null;
    }
    renderAccountControl();
    document.dispatchEvent(new CustomEvent("faith-auth-changed", { detail: { user: state.user, profile: state.profile, publicProfile: state.publicProfile } }));
    window.dispatchEvent(new CustomEvent("faith-auth-changed", { detail: { user: state.user, profile: state.profile, publicProfile: state.publicProfile } }));
    return state;
  }

  function renderAccountControl() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    let root = document.getElementById("faithAccountControl");
    if (!root) {
      root = document.createElement("div");
      root.id = "faithAccountControl";
      root.className = "faith-account-control";
      header.append(root);
    }
    if (!state.user) {
      root.innerHTML = '<button class="account-link" type="button" data-faith-open-login>로그인</button><button class="account-link account-signup" type="button" data-faith-open-signup>회원가입</button>';
      root.querySelector("[data-faith-open-login]")?.addEventListener("click", () => open("login"));
      root.querySelector("[data-faith-open-signup]")?.addEventListener("click", () => open("signup"));
      return;
    }
    const nickname = state.publicProfile?.nickname || "회원";
    root.innerHTML = `<a class="account-link" href="account.html">${escapeHtml(nickname)} 님</a><button class="account-link" type="button" data-faith-logout>로그아웃</button>`;
    root.querySelector("[data-faith-logout]")?.addEventListener("click", async () => {
      await state.client?.auth.signOut();
      await refreshSession();
    });
  }

  async function withSessionToken() {
    const client = await getClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error("로그인이 필요합니다.");
    return session.access_token;
  }

  async function orderRequest(path, body) {
    const apiUrl = orderApiUrl();
    if (!apiUrl) throw new Error("자료 주문 서비스를 아직 연결하지 못했습니다. 문의하기를 이용해 주세요.");
    const token = await withSessionToken();
    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "요청을 처리하지 못했습니다.");
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  function purchaseInquiryUrl(productId) {
    const url = new URL("contact.html", window.location.href);
    if (productId) url.searchParams.set("product", productId);
    return url.href;
  }

  function openPurchaseInquiry(productId) {
    const inquiryUrl = purchaseInquiryUrl(productId);
    window.location.assign(inquiryUrl);
    return { inquiry: true, productId, inquiryUrl };
  }

  function trackOrderEvent(name, params = {}) {
    if (typeof window.trackFaithEvent === "function") {
      window.trackFaithEvent(name, params);
      return;
    }
    if (typeof window.gtag === "function") window.gtag("event", name, { ...params, page_path: window.location.pathname });
  }

  function isInquiryOnlyError(error) {
    return error?.payload?.code === "inquiry_only" || error?.payload?.saleStatus === "inquiry" || error?.payload?.sale_status === "inquiry" || error?.payload?.purchasable === false;
  }

  function paymentCustomerKey() {
    const memberId = String(state.user?.id || "").replace(/[^a-zA-Z0-9]/g, "");
    if (memberId) return ("member_" + memberId).slice(0, 50);
    if (window.crypto?.randomUUID) return `customer_${window.crypto.randomUUID()}`;
    const bytes = window.crypto?.getRandomValues?.(new Uint8Array(16));
    if (bytes) return `customer_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    throw new Error("안전한 결제 요청을 시작하지 못했습니다. 문의하기를 이용해 주세요.");
  }

  async function openPaymentWidget(pending) {
    ensurePaymentModal();
    await destroyPaymentWidget();

    const root = document.getElementById("faithPaymentModal");
    const widgetRoot = root.querySelector("[data-faith-payment-widget]");
    const submitButton = root.querySelector("[data-faith-payment-submit]");
    paymentWidgetState.pending = pending;
    paymentWidgetState.trigger = document.activeElement;
    root.querySelector("[data-faith-payment-order-name]").textContent = pending.orderName || "기도의샘물 신앙자료";
    root.querySelector("[data-faith-payment-amount]").textContent = `${Number(pending.amount).toLocaleString("ko-KR")}원`;
    root.hidden = false;
    widgetRoot.setAttribute("aria-busy", "true");
    submitButton.disabled = true;
    submitButton.textContent = "결제 화면 준비 중";
    setPaymentStatus("안전한 결제 화면을 불러오고 있습니다.");
    syncModalOpenState();

    try {
      if (!window.TossPayments) await loadScript(TOSS_SCRIPT);
      if (!window.TossPayments) throw new Error("결제 화면을 불러오지 못했습니다.");

      const widgets = window.TossPayments(pending.clientKey).widgets({ customerKey: paymentCustomerKey() });
      paymentWidgetState.widgets = widgets;
      await widgets.setAmount({ currency: pending.currency || "KRW", value: Number(pending.amount) });
      const [paymentMethods, agreement] = await Promise.all([
        widgets.renderPaymentMethods({ selector: "#faithPaymentMethods", variantKey: "DEFAULT" }),
        widgets.renderAgreement({ selector: "#faithPaymentAgreement", variantKey: "AGREEMENT" })
      ]);

      if (paymentWidgetState.pending?.orderId !== pending.orderId) {
        await Promise.allSettled([paymentMethods, agreement].map((instance) => Promise.resolve(instance?.destroy?.())));
        return pending;
      }

      paymentWidgetState.paymentMethods = paymentMethods;
      paymentWidgetState.agreement = agreement;
      widgetRoot.removeAttribute("aria-busy");
      submitButton.disabled = false;
      submitButton.textContent = `${Number(pending.amount).toLocaleString("ko-KR")}원 결제하기`;
      setPaymentStatus("결제수단 선택과 필수 약관 동의를 확인해 주세요.");
      window.setTimeout(() => submitButton.focus(), 0);
      return pending;
    } catch (error) {
      widgetRoot.removeAttribute("aria-busy");
      submitButton.disabled = true;
      submitButton.textContent = "결제 화면을 불러오지 못했습니다";
      setPaymentStatus(error?.message || "결제 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", true);
      throw error;
    }
  }

  async function submitPaymentWidget() {
    const pending = paymentWidgetState.pending;
    const widgets = paymentWidgetState.widgets;
    const root = document.getElementById("faithPaymentModal");
    const submitButton = root?.querySelector("[data-faith-payment-submit]");
    if (!pending || !widgets || !submitButton || submitButton.disabled) return;

    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.textContent = "결제창 여는 중";
    setPaymentStatus("토스페이먼츠 결제창을 열고 있습니다.");

    try {
      await widgets.requestPayment({
        orderId: pending.orderId,
        orderName: pending.orderName || "기도의샘물 신앙자료",
        successUrl: pending.successUrl,
        failUrl: pending.failUrl,
        customerEmail: state.user?.email || undefined,
        customerName: state.publicProfile?.nickname || "기도의샘물 회원"
      });
    } catch (error) {
      const canceled = ["USER_CANCEL", "PAY_PROCESS_CANCELED"].includes(error?.code);
      setPaymentStatus(canceled ? "결제를 취소했습니다. 결제수단을 다시 선택할 수 있습니다." : (error?.message || "결제를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요."), !canceled);
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.textContent = `${Number(pending.amount).toLocaleString("ko-KR")}원 결제하기`;
    }
  }

  async function requestPurchase(productId, printCopies = null) {
    const normalizedProductId = String(productId || "").trim();
    if (!normalizedProductId) throw new Error("구매할 자료 정보를 찾지 못했습니다.");
    if (!state.user) {
      open("signup", MEMBER_PURCHASE_GUIDANCE);
      return { requiresLogin: true, productId: normalizedProductId };
    }
    if (!orderApiUrl()) return openPurchaseInquiry(normalizedProductId);

    let pending;
    try {
      pending = await orderRequest("/orders/start", { productId: normalizedProductId, printCopies: printCopies === null ? undefined : Number(printCopies) });
    } catch (error) {
      if (error?.payload?.code === "already_purchased") {
        trackOrderEvent("repurchase_attempt", { product_id: normalizedProductId });
        return { alreadyPurchased: true, productId: normalizedProductId, resourceId: error.payload.resourceId || null };
      }
      if (isInquiryOnlyError(error)) return openPurchaseInquiry(normalizedProductId);
      throw error;
    }
    if (!pending?.orderId || !pending?.clientKey || !Number.isFinite(Number(pending.amount)) || Number(pending.amount) <= 0) {
      return openPurchaseInquiry(normalizedProductId);
    }

    sessionStorage.setItem(ORDER_PENDING_KEY, JSON.stringify({ orderId: pending.orderId, productId: pending.productId || normalizedProductId }));
    return openPaymentWidget(pending);
  }

  async function completeOrderPayment() {
    const params = new URLSearchParams(window.location.search);
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const failureMessage = params.get("message");
    const failureCode = params.get("code");
    const status = document.querySelector("[data-order-status]");
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem(ORDER_PENDING_KEY) || "null"); } catch { /* ignore malformed stale browser storage */ }

    if (!orderId) {
      if (failureMessage && status) status.textContent = `결제를 완료하지 못했습니다. ${failureMessage}`;
      return;
    }
    if (pending?.orderId && pending.orderId !== orderId) {
      if (status) status.textContent = "결제 요청 정보가 일치하지 않습니다. 문의하기를 이용해 주세요.";
      return;
    }
    if (!paymentKey) {
      if (status) status.textContent = `결제를 완료하지 못했습니다.${failureMessage ? ` ${failureMessage}` : ""}`;
      try {
        const failed = await orderRequest("/orders/fail", { orderId });
        sessionStorage.removeItem(ORDER_PENDING_KEY);
        window.history.replaceState({}, "", "account.html");
        await refreshSession();
        if (failed?.order?.status === "paid") {
          trackOrderEvent("purchase_success", { product_id: pending?.productId || null, order_id: orderId, recovered: true });
          if (status) status.textContent = "결제가 완료되었습니다. 내 구매 자료에서 다시 열거나 다운로드할 수 있습니다.";
        } else {
          trackOrderEvent("purchase_failure", { product_id: pending?.productId || null, order_id: orderId, code: failureCode || "checkout_failed" });
          if (status) status.textContent = `결제가 취소되었거나 완료되지 않았습니다.${failureMessage ? ` ${failureMessage}` : ""}`;
        }
      } catch (error) {
        trackOrderEvent("purchase_failure", { product_id: pending?.productId || null, order_id: orderId, code: failureCode || "checkout_failed" });
        if (status) status.textContent = `결제를 완료하지 못했습니다. ${error.message || failureMessage || "잠시 후 결제 내역을 확인해 주세요."}`;
      }
      return;
    }
    if (status) status.textContent = "결제를 확인하고 있습니다.";
    try {
      const approved = await orderRequest("/orders/approve", { paymentKey, orderId });
      if (approved?.ok !== true) {
        if (approved?.pending && status) status.textContent = "결제 승인 확인 중입니다. 잠시 후 이 페이지를 새로고침해 결제 내역을 확인해 주세요.";
        else if (status) status.textContent = "결제 상태를 아직 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.";
        return;
      }
      sessionStorage.removeItem(ORDER_PENDING_KEY);
      window.history.replaceState({}, "", "account.html");
      await refreshSession();
      trackOrderEvent("purchase_success", { product_id: pending?.productId || null, order_id: orderId });
      if (status) status.textContent = "결제가 완료되었습니다. 내 구매 자료에서 다시 열거나 다운로드할 수 있습니다.";
    } catch (error) {
      if (["order_expired", "order_policy_changed"].includes(error?.payload?.code)) {
        sessionStorage.removeItem(ORDER_PENDING_KEY);
        window.history.replaceState({}, "", "account.html");
        await refreshSession();
      }
      trackOrderEvent("purchase_failure", { product_id: pending?.productId || null, order_id: orderId });
      if (status) status.textContent = error.message;
    }
  }

  async function requestProtectedDownload(resourceId) {
    const normalizedResourceId = String(resourceId || "").trim();
    if (!normalizedResourceId) throw new Error("다운로드할 자료 정보를 찾지 못했습니다.");
    if (!state.user) {
      open("signup", MEMBER_PURCHASE_GUIDANCE);
      throw new Error(MEMBER_PURCHASE_GUIDANCE);
    }
    if (!orderApiUrl()) {
      throw new Error("보호된 다운로드 서버가 연결되지 않았습니다. 문의하기를 이용해 주세요.");
    }
    return orderRequest(`/resources/${encodeURIComponent(normalizedResourceId)}/download`);
  }

  function downloadEntries(download) {
    const files = Array.isArray(download?.downloads) ? download.downloads : [download];
    return files.filter((file) => file?.url);
  }

  function safeDownloadName(value = "") {
    return String(value || "faith-resource-download")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim() || "faith-resource-download";
  }

  async function saveProtectedFile(file) {
    if (!file?.url) throw new Error("다운로드 링크를 찾지 못했습니다.");
    const response = await fetch(file.url, { credentials: "omit" });
    if (!response.ok) throw new Error("파일을 내려받지 못했습니다. 다운로드 목록을 다시 열어 주세요.");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = safeDownloadName(file.fileName);
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  async function startProtectedDownloads(download) {
    const files = downloadEntries(download);
    if (!files.length) throw new Error("다운로드 링크를 찾지 못했습니다.");
    if (files.length > 1) {
      ensureDownloadModal();
      const root = document.getElementById("faithDownloadModal");
      const list = root.querySelector("[data-faith-download-list]");
      const status = root.querySelector("[data-faith-download-status]");
      modalDownloadFiles = files;
      list.innerHTML = files.map((file, index) => `<button class="faith-download-file" type="button" data-faith-download-index="${index}" aria-label="${escapeHtml(`${file.fileName || `자료 파일 ${index + 1}`} 다운로드`)}"><span>${index + 1}</span><strong>${escapeHtml(file.fileName || `자료 파일 ${index + 1}`)}</strong><span data-faith-download-icon aria-hidden="true">↓</span></button>`).join("");
      if (status) status.textContent = "";
      root.hidden = false;
      document.body.classList.add("modal-open");
      window.setTimeout(() => list.querySelector("button")?.focus(), 0);
      return files.length;
    }
    await saveProtectedFile(files[0]);
    return files.length;
  }

  function friendlyDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
  }

  function shortDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function orderStatusText(order) {
    const status = typeof order === "string" ? order : order?.status;
    if (status === "ready" && order?.expires_at && Date.parse(order.expires_at) <= Date.now()) return "결제 요청 만료";
    const map = { ready: "결제 확인 중", paid: "결제 완료", free: "무료 자료", failed: "결제 실패", canceled: "결제 취소", refunded: "환불 완료" };
    return map[status] || "주문 상태 확인 중";
  }

  function isPaidOrder(order) {
    return order?.status === "paid";
  }

  function orderResourceKeys(order) {
    return [order?.product_id, order?.resource_id].filter(Boolean);
  }

  async function loadMyOrders(client) {
    const orderClient = client || await getClient();
    const userId = state.user?.id;
    if (!userId || !orderClient) return [];
    if (state.ordersLoaded && state.ordersUserId === userId) return state.orders;
    if (state.ordersLoading) return state.ordersLoading;

    const request = (async () => {
      const [ordersResult, freeResult] = await Promise.all([
        orderClient.from("faith_orders")
          .select("id,order_id,product_id,resource_id,amount,currency,status,expires_at,paid_at,created_at,requested_print_copies,licensed_print_copies,base_price_amount,license_surcharge_amount,product:faith_products(id,title,type)")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        orderClient.from("resource_downloads")
          .select("id,resource_id,downloaded_at,resource:faith_resources(id,title,type)")
          .eq("user_id", userId).is("order_id", null).order("downloaded_at", { ascending: false }).limit(50)
      ]);
      if (ordersResult.error || freeResult.error) throw new Error("구매 내역을 불러오지 못했습니다.");
      if (state.user?.id !== userId) return [];
      const seenFree = new Set();
      const freeDownloads = (freeResult.data || []).filter((item) => item.resource_id && !seenFree.has(item.resource_id) && seenFree.add(item.resource_id)).map((item) => ({
        id: `free-${item.id}`, order_id: `free-${item.id}`, product_id: item.resource_id, resource_id: item.resource_id,
        amount: 0, currency: "KRW", status: "free", paid_at: item.downloaded_at, created_at: item.downloaded_at,
        product: Array.isArray(item.resource) ? item.resource[0] : item.resource
      }));
      const orders = [...(ordersResult.data || []), ...freeDownloads].sort((a, b) => Date.parse(b.paid_at || b.created_at) - Date.parse(a.paid_at || a.created_at));
      state.orders = orders;
      state.ordersByResource.clear();
      orders.filter(isPaidOrder).forEach((order) => {
        orderResourceKeys(order).forEach((key) => state.ordersByResource.set(key, order));
      });
      state.ordersLoaded = true;
      state.ordersUserId = userId;
      return orders;
    })();
    state.ordersLoading = request;
    try {
      return await request;
    } finally {
      if (state.ordersLoading === request) state.ordersLoading = null;
    }
  }

  async function getOrderForResource(resourceId) {
    const normalizedResourceId = String(resourceId || "").trim();
    if (!state.user || !normalizedResourceId) return null;
    if (!state.ordersLoaded) {
      try {
        await loadMyOrders();
      } catch {
        return null;
      }
    }
    return state.ordersByResource.get(normalizedResourceId) || null;
  }

  async function hasPurchasedResource(resourceId) {
    if (!state.user) return false;
    if (state.profile?.role === "admin") return true;
    const order = await getOrderForResource(resourceId);
    return order?.status === "paid";
  }

  async function initAccountPage() {
    const root = document.querySelector("[data-account-page]");
    if (!root) return;
    const client = await getClient();
    if (!state.user) {
      root.innerHTML = '<section class="section account-access-panel"><p class="eyebrow">My Account</p><h1>내 프로필</h1><p>로그인하면 내 구매 자료와 작성한 글을 확인할 수 있습니다.</p><button class="button primary" type="button" data-account-login>로그인</button></section>';
      root.querySelector("[data-account-login]")?.addEventListener("click", () => open("login"));
      return;
    }
    root.innerHTML = `
      <section class="page-hero sub-hero account-hero"><p class="eyebrow">My Account</p><h1>내 프로필</h1><p>공개 게시글에는 닉네임만 표시되며, 이메일과 결제수단은 공개하지 않습니다.</p></section>
      <section class="section account-grid account-profile-grid">
        <article class="account-card"><p class="eyebrow">Profile</p><h2>기본 정보</h2><form data-profile-form class="faith-auth-form"><label>닉네임<input name="nickname" maxlength="16" minlength="2" required value="${escapeHtml(state.publicProfile?.nickname || "")}"></label><label>가입 이메일<input value="${escapeHtml(state.user.email || "")}" disabled></label><button class="button primary" type="submit">닉네임 저장</button><p class="form-message" data-profile-status></p></form></article>
        <article class="account-card"><p class="eyebrow">Security</p><h2>비밀번호 변경</h2><form data-password-form class="faith-auth-form"><label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>새 비밀번호<input name="newPassword" type="password" minlength="8" autocomplete="new-password" required></label><button class="button secondary" type="submit">비밀번호 변경</button><button class="text-button" type="button" data-account-reset>재설정 메일 받기</button><p class="form-message" data-password-status></p></form></article>
      </section>
      <section class="section account-content-section"><div class="section-heading-row"><div><p class="eyebrow">My Orders</p><h2>내 구매 자료와 결제 내역</h2></div><a class="button secondary" href="prayer-cards?type=all">신앙자료 보기</a></div><div class="account-bbs-wrap"><table class="account-bbs"><thead><tr><th>결제일자</th><th>자료 유형</th><th>자료 제목</th><th>결제 금액</th><th>상태</th></tr></thead><tbody data-my-orders></tbody></table></div><p class="form-message account-order-status" data-order-status role="status"></p></section>
      <section class="section account-content-section"><div class="section-heading-row"><div><p class="eyebrow">My Community</p><h2>내가 작성한 글과 답글</h2></div><a class="button secondary" href="community.html">소통게시판 보기</a></div><div class="account-bbs-section"><h3>내 게시글</h3><div class="account-bbs-wrap"><table class="account-bbs"><thead><tr><th>일자</th><th>제목</th><th>게시글</th></tr></thead><tbody data-my-posts></tbody></table></div></div><div class="account-bbs-section"><h3>내 답글</h3><div class="account-bbs-wrap"><table class="account-bbs"><thead><tr><th>일자</th><th>원문 제목</th><th>답글 내용</th><th>게시글</th></tr></thead><tbody data-my-replies></tbody></table></div></div></section>`;

    root.querySelector("[data-profile-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = event.currentTarget.elements.nickname;
      const status = root.querySelector("[data-profile-status]");
      const nickname = String(input.value || "").trim();
      if (nickname.length < 2 || nickname.length > 16) return status.textContent = "닉네임은 2자 이상 16자 이하로 입력해 주세요.";
      const { error } = await client.from("public_profiles").update({ nickname }).eq("id", state.user.id);
      if (error) return status.textContent = "이미 사용 중인 닉네임인지 확인해 주세요.";
      status.textContent = "닉네임을 저장했습니다.";
      await refreshSession();
    });
    root.querySelector("[data-password-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = root.querySelector("[data-password-status]");
      const currentPassword = String(form.elements.currentPassword.value || "");
      const newPassword = String(form.elements.newPassword.value || "");
      if (newPassword.length < 8) return status.textContent = "새 비밀번호는 8자 이상이어야 합니다.";
      const check = await client.auth.signInWithPassword({ email: state.user.email, password: currentPassword });
      if (check.error) return status.textContent = "현재 비밀번호를 확인해 주세요.";
      const { error } = await client.auth.updateUser({ password: newPassword });
      status.textContent = error ? "비밀번호를 변경하지 못했습니다." : "비밀번호를 변경했습니다.";
      if (!error) form.reset();
    });
    root.querySelector("[data-account-reset]")?.addEventListener("click", async () => {
      const status = root.querySelector("[data-password-status]");
      const { error } = await client.auth.resetPasswordForEmail(state.user.email, { redirectTo: new URL("reset-password.html", window.location.href).href });
      status.textContent = error ? "재설정 메일을 보내지 못했습니다." : "비밀번호 재설정 메일을 보냈습니다.";
    });
    await completeOrderPayment();
    await renderAccountHistory(client, root);
  }

  async function renderAccountHistory(client, root) {
    const previewPurchasedPdf = ["127.0.0.1", "localhost"].includes(window.location.hostname)
      && new URLSearchParams(window.location.search).get("preview") === "purchased-pdf";
    const [posts, replies, orderResult] = await Promise.all([
      client.from("community_posts").select("id,title,category,created_at,status").eq("author_id", state.user.id).order("created_at", { ascending: false }).limit(10),
      client.from("community_replies").select("id,body,created_at,status,post:community_posts(id,title)").eq("author_id", state.user.id).order("created_at", { ascending: false }).limit(10),
      loadMyOrders(client).then((data) => ({ data })).catch((error) => ({ error }))
    ]);
    const renderRows = (target, rows, renderer, empty, colspan) => {
      const element = root.querySelector(target);
      if (element) element.innerHTML = rows?.length ? rows.map(renderer).join("") : `<tr><td class="account-bbs-empty" colspan="${colspan}">${empty}</td></tr>`;
    };
    renderRows("[data-my-posts]", posts.data, (post) => `<tr><td data-label="일자">${shortDate(post.created_at)}</td><td data-label="제목"><strong>${escapeHtml(post.title)}</strong></td><td data-label="게시글"><a href="community.html?post=${encodeURIComponent(post.id)}">게시글 보기</a></td></tr>`, "작성한 게시글이 없습니다.", 3);
    renderRows("[data-my-replies]", replies.data, (reply) => `<tr><td data-label="일자">${shortDate(reply.created_at)}</td><td data-label="원문 제목"><strong>${escapeHtml(reply.post?.title || "소통게시판 답글")}</strong></td><td data-label="답글 내용">${escapeHtml(reply.body)}</td><td data-label="게시글">${reply.post?.id ? `<a href="community.html?post=${encodeURIComponent(reply.post.id)}">게시글 보기</a>` : "-"}</td></tr>`, "작성한 답글이 없습니다.", 4);

    if (orderResult.error && !previewPurchasedPdf) {
      renderRows("[data-my-orders]", [], () => "", "구매 내역을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.", 5);
      return;
    }

    const orders = [...(orderResult.data || [])];
    if (previewPurchasedPdf) {
      orders.unshift({
        id: "preview-pdf-order",
        product_id: "preview-pdf-product",
        resource_id: "preview-pdf-resource",
        amount: 4900,
        currency: "KRW",
        status: "paid",
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        product: { id: "preview-pdf-product", title: "가정을 품는 7일간의 기도", type: "pdf" },
        isPreview: true
      });
      const previewStatus = root.querySelector("[data-order-status]");
      if (previewStatus) previewStatus.textContent = "가상 구매 1건을 표시하고 있습니다. 실제 주문 및 결제 데이터에는 저장되지 않습니다.";
    }
    const typeLabel = { pdf: "기도문 PDF", audio: "기도 오디오북", card: "기도카드", challenge: "기도 여정", journey: "기도 여정" };
    const productFor = (order) => Array.isArray(order.product) ? order.product[0] : order.product;
    const orderTitle = (order) => productFor(order)?.title || "기도의샘물 신앙자료";
    const orderType = (order) => typeLabel[productFor(order)?.type] || "신앙자료";
    const orderAmount = (order) => order.status === "free" ? "무료" : `${Number(order.amount || 0).toLocaleString("ko-KR")}원`;
    renderRows("[data-my-orders]", orders, (order) => {
      const product = productFor(order);
      const access = (isPaidOrder(order) || order.status === "free") && order.resource_id
        ? `<button class="text-button" type="button" data-owned-resource-download="${escapeHtml(order.resource_id)}"${order.isPreview ? " data-preview-order" : ""}>자료 다운로드</button>${Number(order.licensed_print_copies || 0) > 1 ? `<small class="account-print-license">비영리 인쇄 ${Number(order.licensed_print_copies).toLocaleString("ko-KR")}부 허용</small>` : ""}`
        : isPaidOrder(order) && product?.type === "journey"
          ? `<a class="text-button" href="prayer-challenge.html?product=${encodeURIComponent(order.product_id)}">여정 열기</a>`
          : "";
      return `<tr><td data-label="결제일자">${shortDate(order.paid_at || order.created_at)}</td><td data-label="자료 유형">${escapeHtml(orderType(order))}</td><td data-label="자료 제목"><strong>${escapeHtml(orderTitle(order))}</strong>${access}</td><td data-label="결제 금액">${orderAmount(order)}</td><td data-label="상태">${escapeHtml(orderStatusText(order))}</td></tr>`;
    }, "결제 내역이 없습니다.", 5);

    root.querySelector("[data-my-orders]")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-owned-resource-download]");
      if (!button) return;
      const status = root.querySelector("[data-order-status]");
      if (button.hasAttribute("data-preview-order")) {
        if (status) status.textContent = "가상 구매 화면입니다. 실제 구매 자료에서는 이 버튼을 누르면 다운로드가 시작됩니다.";
        return;
      }
      button.disabled = true;
      if (status) status.textContent = "다운로드 링크를 준비하고 있습니다.";
      try {
        const download = await requestProtectedDownload(button.dataset.ownedResourceDownload);
        if (download?.requiresLogin) return;
        const count = await startProtectedDownloads(download);
        trackOrderEvent("resource_download", { resource_id: button.dataset.ownedResourceDownload });
        if (status) status.textContent = count > 1 ? `${count}개 파일의 다운로드 목록을 열었습니다.` : "다운로드를 시작했습니다.";
      } catch (error) {
        if (status) status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }

  const communityLabel = { prayer: "기도제목", gratitude: "감사나눔", pain: "아픔나눔" };

  async function initCommunityPage() {
    const root = document.querySelector("[data-community-page]");
    if (!root) return;
    const client = await getClient();
    if (!client) return;
    const searchParams = new URLSearchParams(window.location.search);
    const requestedCategory = searchParams.get("category") || "all";
    const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const pageSize = 15;
    const pageWindowSize = 5;
    let selectedCategory = Object.hasOwn(communityLabel, requestedCategory) ? requestedCategory : "all";
    let currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    let selectedPost = null;
    const listRoot = root.querySelector("[data-community-list]");
    const detailRoot = root.querySelector("[data-community-detail]");
    const setMessage = (message) => { const status = root.querySelector("[data-community-status]"); if (status) status.textContent = message; };

    const syncCommunityUrl = () => {
      const url = new URL(window.location.href);
      if (selectedCategory === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", selectedCategory);
      if (currentPage === 1) url.searchParams.delete("page");
      else url.searchParams.set("page", String(currentPage));
      window.history.replaceState({}, "", url);
    };

    const renderPagination = (totalPages) => {
      const groupStart = Math.floor((currentPage - 1) / pageWindowSize) * pageWindowSize + 1;
      const groupEnd = Math.min(groupStart + pageWindowSize - 1, totalPages);
      const pages = [];
      for (let page = groupStart; page <= groupEnd; page += 1) pages.push(page);
      return `<nav class="community-pagination" aria-label="나눔게시판 페이지 선택">
        <button type="button" data-community-page-group="previous" aria-label="이전 5페이지" title="이전 5페이지"${groupStart === 1 ? " disabled" : ""}>&lt;</button>
        ${pages.map((page) => `<button class="${page === currentPage ? "is-active" : ""}" type="button" data-community-page="${page}"${page === currentPage ? ' aria-current="page"' : ""}>${page}</button>`).join("")}
        <button type="button" data-community-page-group="next" aria-label="다음 5페이지" title="다음 5페이지"${groupEnd === totalPages ? " disabled" : ""}>&gt;</button>
      </nav>`;
    };

    const renderPostBoard = (posts, replyCounts, totalCount, totalPages) => {
      if (!posts.length) return `<div class="soft-empty-state"><h3>아직 나눔이 없습니다.</h3><p>마음에 담아 둔 기도제목, 감사 또는 아픔의 이야기를 첫 글로 남겨 보세요.</p></div>${renderPagination(totalPages)}`;
      const offset = (currentPage - 1) * pageSize;
      return `<div class="community-bbs-wrap"><table class="community-bbs-table">
        <colgroup><col class="community-col-number"><col class="community-col-date"><col class="community-col-category"><col class="community-col-author"><col><col class="community-col-replies"></colgroup>
        <thead><tr><th scope="col">번호</th><th scope="col">작성일</th><th scope="col">분류</th><th scope="col">작성자</th><th scope="col">제목</th><th scope="col">답글수</th></tr></thead>
        <tbody>${posts.map((post, index) => `<tr>
          <td class="community-cell-number">${totalCount - offset - index}</td>
          <td>${shortDate(post.created_at)}</td>
          <td><span class="community-category-label community-category-${escapeHtml(post.category)}">${escapeHtml(communityLabel[post.category] || post.category)}</span></td>
          <td class="community-cell-author">${escapeHtml(post.author?.nickname || "익명")}</td>
          <td><button class="community-title-button" type="button" data-open-community-post="${escapeHtml(post.id)}">${escapeHtml(post.title)}</button></td>
          <td class="community-cell-replies">${Number(replyCounts.get(post.id) || 0)}</td>
        </tr>`).join("")}</tbody>
      </table></div>${renderPagination(totalPages)}`;
    };

    async function loadPosts() {
      listRoot.innerHTML = '<p class="community-board-loading" role="status">게시글을 불러오고 있습니다.</p>';
      const offset = (currentPage - 1) * pageSize;
      let query = client.from("community_posts").select("id,category,title,created_at,author_id,author:public_profiles!community_posts_author_id_fkey(nickname)", { count: "exact" }).eq("status", "published").in("category", ["prayer", "gratitude", "pain"]).order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
      if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
      const { data, error, count } = await query;
      if (error) {
        listRoot.innerHTML = '<p class="soft-empty-state">게시판을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>';
        return;
      }
      const totalCount = Number(count || 0);
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      if (currentPage > totalPages) {
        currentPage = totalPages;
        syncCommunityUrl();
        return loadPosts();
      }
      const posts = data || [];
      const postIds = posts.map((post) => post.id);
      const replyCounts = new Map();
      if (postIds.length) {
        const { data: replies, error: repliesError } = await client.from("community_replies").select("post_id").in("post_id", postIds).eq("status", "published");
        if (!repliesError) (replies || []).forEach((reply) => replyCounts.set(reply.post_id, (replyCounts.get(reply.post_id) || 0) + 1));
      }
      listRoot.innerHTML = renderPostBoard(posts, replyCounts, totalCount, totalPages);
    }

    async function openPost(postId) {
      const { data: post, error } = await client.from("community_posts").select("id,category,title,body,created_at,author_id,author:public_profiles!community_posts_author_id_fkey(nickname)").eq("id", postId).maybeSingle();
      if (error || !post) return setMessage("게시글을 찾지 못했습니다.");
      selectedPost = post;
      const { data: replies } = await client.from("community_replies").select("id,body,created_at,author_id,author:public_profiles!community_replies_author_id_fkey(nickname)").eq("post_id", postId).eq("status", "published").order("created_at", { ascending: true });
      const isOwner = state.user?.id === post.author_id;
      detailRoot.hidden = false;
      detailRoot.innerHTML = `<div class="community-detail-head"><div><p class="eyebrow">${escapeHtml(communityLabel[post.category])}</p><h2>${escapeHtml(post.title)}</h2><p class="muted">${escapeHtml(post.author?.nickname || "익명")} · ${friendlyDate(post.created_at)}</p></div><button class="button secondary" type="button" data-close-community-detail>목록으로</button></div><p class="community-detail-body">${escapeHtml(post.body).replaceAll("\n", "<br>")}</p><div class="community-owner-actions">${isOwner ? '<button class="text-button" type="button" data-edit-community-post>내 글 수정</button><button class="text-button" type="button" data-delete-community-post>내 글 삭제</button>' : ""}<button class="text-button" type="button" data-report-community-post>신고하기</button></div><section class="community-replies"><h3>함께 남긴 답글</h3>${replies?.length ? replies.map((reply) => `<article><p><strong>${escapeHtml(reply.author?.nickname || "익명")}</strong> <span>${friendlyDate(reply.created_at)}</span></p><p>${escapeHtml(reply.body).replaceAll("\n", "<br>")}</p>${state.user?.id === reply.author_id ? `<button class="text-button" type="button" data-delete-community-reply="${escapeHtml(reply.id)}">내 답글 삭제</button>` : `<button class="text-button" type="button" data-report-community-reply="${escapeHtml(reply.id)}">신고하기</button>`}</article>`).join("") : '<p class="muted">첫 위로의 답글을 남겨 보세요.</p>'}</section>${state.user ? `<form class="community-reply-form" data-community-reply-form><label>따뜻한 답글<textarea name="body" maxlength="2000" required placeholder="상대방을 존중하는 마음으로 답글을 남겨 주세요."></textarea></label><button class="button primary" type="submit">답글 남기기</button></form>` : '<div class="community-login-prompt"><p>로그인한 회원만 답글을 남길 수 있습니다.</p><button class="button secondary" type="button" data-community-login>로그인</button></div>'}`;
      detailRoot.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    root.querySelectorAll("[data-community-filter]").forEach((button) => button.addEventListener("click", () => {
      selectedCategory = button.dataset.communityFilter || "all";
      currentPage = 1;
      root.querySelectorAll("[data-community-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      syncCommunityUrl();
      loadPosts();
    }));
    root.querySelectorAll("[data-community-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.communityFilter === selectedCategory));
    const composeForm = root.querySelector("[data-community-form]");
    if (composeForm && selectedCategory !== "all") composeForm.elements.category.value = selectedCategory;
    const composeSection = root.querySelector("#communityCompose");
    const composeTrigger = root.querySelector("[data-community-compose]");
    const showCompose = () => {
      if (!state.user) return open("signup");
      if (composeSection) composeSection.hidden = false;
      window.requestAnimationFrame(() => root.querySelector("[data-community-form]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };
    composeTrigger?.addEventListener("click", showCompose);
    root.querySelector("[data-community-compose-close]")?.addEventListener("click", () => {
      if (composeSection) composeSection.hidden = true;
      composeTrigger?.focus();
    });
    if (window.location.hash === "#communityCompose") showCompose();
    root.querySelector("[data-community-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.user) return open("login");
      const form = event.currentTarget;
      const category = form.elements.category.value;
      if (!Object.hasOwn(communityLabel, category)) return setMessage("나눔 유형을 다시 선택해 주세요.");
      const { error } = await client.from("community_posts").insert({ author_id: state.user.id, category, title: form.elements.title.value.trim(), body: form.elements.body.value.trim() });
      if (error) return setMessage("게시글을 등록하지 못했습니다. 내용을 확인해 주세요.");
      form.reset();
      setMessage("게시글을 등록했습니다.");
      currentPage = 1;
      syncCommunityUrl();
      await loadPosts();
    });
    listRoot.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-community-post]");
      if (button) return openPost(button.dataset.openCommunityPost);
      const pageButton = event.target.closest("button[data-community-page]");
      if (pageButton) {
        currentPage = Number(pageButton.dataset.communityPage);
        syncCommunityUrl();
        return loadPosts();
      }
      const groupButton = event.target.closest("[data-community-page-group]");
      if (!groupButton || groupButton.disabled) return;
      const groupStart = Math.floor((currentPage - 1) / pageWindowSize) * pageWindowSize + 1;
      currentPage = groupButton.dataset.communityPageGroup === "next" ? groupStart + pageWindowSize : Math.max(1, groupStart - 1);
      syncCommunityUrl();
      loadPosts();
    });
    detailRoot.addEventListener("click", async (event) => {
      if (event.target.closest("[data-close-community-detail]")) { detailRoot.hidden = true; return; }
      if (event.target.closest("[data-community-login]")) return open("login");
      if (event.target.closest("[data-delete-community-post]") && selectedPost && window.confirm("작성한 게시글을 삭제할까요?")) {
        const { error } = await client.from("community_posts").delete().eq("id", selectedPost.id).eq("author_id", state.user.id);
        if (error) return setMessage("게시글을 삭제하지 못했습니다.");
        detailRoot.hidden = true; await loadPosts(); return;
      }
      if (event.target.closest("[data-edit-community-post]") && selectedPost) {
        const title = window.prompt("제목을 수정해 주세요.", selectedPost.title);
        const body = window.prompt("내용을 수정해 주세요.", selectedPost.body);
        if (!title || !body) return;
        const { error } = await client.from("community_posts").update({ title: title.trim(), body: body.trim() }).eq("id", selectedPost.id).eq("author_id", state.user.id);
        if (error) return setMessage("게시글을 수정하지 못했습니다.");
        await openPost(selectedPost.id); await loadPosts(); return;
      }
      const replyDelete = event.target.closest("[data-delete-community-reply]");
      if (replyDelete && window.confirm("작성한 답글을 삭제할까요?")) {
        const { error } = await client.from("community_replies").delete().eq("id", replyDelete.dataset.deleteCommunityReply).eq("author_id", state.user.id);
        if (error) return setMessage("답글을 삭제하지 못했습니다.");
        return openPost(selectedPost.id);
      }
      const reportTarget = event.target.closest("[data-report-community-post], [data-report-community-reply]");
      if (reportTarget) {
        if (!state.user) return open("login");
        const reason = window.prompt("신고 사유를 입력해 주세요.");
        if (!reason?.trim()) return;
        const targetType = reportTarget.hasAttribute("data-report-community-post") ? "post" : "reply";
        const targetId = targetType === "post" ? selectedPost.id : reportTarget.dataset.reportCommunityReply;
        const { error } = await client.from("community_reports").insert({ reporter_id: state.user.id, target_type: targetType, target_id: targetId, reason: reason.trim() });
        setMessage(error ? "신고를 접수하지 못했습니다." : "신고를 접수했습니다. 운영 원칙에 따라 확인하겠습니다.");
      }
    });
    detailRoot.addEventListener("submit", async (event) => {
      if (!event.target.matches("[data-community-reply-form]")) return;
      event.preventDefault();
      if (!state.user || !selectedPost) return open("login");
      const body = String(event.target.elements.body.value || "").trim();
      const { error } = await client.from("community_replies").insert({ post_id: selectedPost.id, author_id: state.user.id, body });
      if (error) return setMessage("답글을 등록하지 못했습니다.");
      await openPost(selectedPost.id);
    });
    window.addEventListener("faith-auth-changed", () => { loadPosts(); if (selectedPost) openPost(selectedPost.id); });
    await loadPosts();
    const initial = new URLSearchParams(window.location.search).get("post");
    if (initial) openPost(initial);
  }

  async function initAdminModeration() {
    const root = document.querySelector("[data-community-moderation]");
    const apiUrl = orderApiUrl();
    if (!root || !apiUrl || !state.user) return;
    const status = root.querySelector("[data-moderation-status]");
    try {
      const token = await withSessionToken();
      const response = await fetch(`${apiUrl}/admin/community/reports`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "신고 목록을 불러오지 못했습니다.");
      root.hidden = false;
      root.querySelector("[data-moderation-list]").innerHTML = data.reports?.length ? data.reports.map((report) => `<article><strong>${escapeHtml(report.target_type)} 신고</strong><p>${escapeHtml(report.reason)}</p><button class="text-button" type="button" data-moderate="hide" data-target-type="${escapeHtml(report.target_type)}" data-target-id="${escapeHtml(report.target_id)}">대상 숨김</button><button class="text-button" type="button" data-moderate="restore" data-target-type="${escapeHtml(report.target_type)}" data-target-id="${escapeHtml(report.target_id)}">대상 복구</button><button class="text-button" type="button" data-moderate="resolve_report" data-report-id="${escapeHtml(report.id)}">처리 완료</button><button class="text-button" type="button" data-moderate="dismiss_report" data-report-id="${escapeHtml(report.id)}">반려</button></article>`).join("") : '<p class="muted">확인할 신고가 없습니다.</p>';
      root.querySelectorAll("[data-moderate]").forEach((button) => button.addEventListener("click", async () => {
        const isReportAction = /report$/.test(button.dataset.moderate);
        try { await orderRequest("/admin/community/moderate", { targetType: isReportAction ? "report" : button.dataset.targetType, targetId: isReportAction ? button.dataset.reportId : button.dataset.targetId, action: button.dataset.moderate }); await initAdminModeration(); } catch (error) { status.textContent = error.message; }
      }));
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    ensureModal();
    renderAccountControl();
    state.client = await getClient();
    if (state.client) state.client.auth.onAuthStateChange(() => window.setTimeout(refreshSession, 0));
    await refreshSession();
    await initAccountPage();
    await initCommunityPage();
    await initAdminModeration();
    document.dispatchEvent(new Event("faith-auth-ready"));
    window.dispatchEvent(new Event("faith-auth-ready"));
  }

  window.FaithAuth = { open, close, getClient, refreshSession, getOrderForResource, hasPurchasedResource, requestPurchase, requestProtectedDownload, startProtectedDownloads };
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const paymentModal = document.getElementById("faithPaymentModal");
    if (paymentModal && !paymentModal.hidden) {
      closePaymentModal();
      return;
    }
    const notice = document.getElementById("faithAuthNoticeModal");
    if (notice && !notice.hidden) {
      closeNotice();
      return;
    }
    close();
    closeDownloadModal();
  });
  init().catch((error) => console.error("faith-member-init", error));
})();
