(() => {
  "use strict";

  const form = document.querySelector('body[data-site-page="contact"] form.contact-form-grid');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.createElement("p");
  status.className = "form-message";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  submitButton?.insertAdjacentElement("afterend", status);

  const honeypot = document.createElement("label");
  honeypot.setAttribute("aria-hidden", "true");
  honeypot.style.position = "absolute";
  honeypot.style.left = "-10000px";
  honeypot.style.width = "1px";
  honeypot.style.height = "1px";
  honeypot.style.overflow = "hidden";
  honeypot.innerHTML = '웹사이트<input name="website" tabindex="-1" autocomplete="off">';
  form.append(honeypot);

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  async function sessionToken() {
    const client = window.FaithAuth?.getClient
      ? await window.FaithAuth.getClient()
      : window.FaithSupabase;
    if (!client?.auth) return "";
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || "";
  }

  form.addEventListener("submit", async (event) => {
    const apiBase = String(window.FAITH_ORDER_API_URL || "").replace(/\/$/, "");
    if (!apiBase) return;

    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      inquiryType: String(data.get("inquiry_type") || ""),
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      message: String(data.get("message") || ""),
      productId: String(data.get("product_id") || ""),
      website: String(data.get("website") || "")
    };

    submitButton.disabled = true;
    setStatus("문의를 안전하게 접수하고 있습니다.");
    try {
      const token = await sessionToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${apiBase}/contact/inquiries`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "문의를 접수하지 못했습니다.");
      form.reset();
      setStatus("문의가 접수되었습니다. 확인 후 입력하신 이메일로 답변드리겠습니다.");
    } catch (error) {
      setStatus(error.message || "문의를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.", true);
    } finally {
      submitButton.disabled = false;
    }
  });
})();
