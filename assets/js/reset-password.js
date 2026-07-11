(() => {
  const form = document.querySelector("[data-password-reset-form]");
  const status = document.querySelector("[data-password-reset-status]");
  const client = window.FaithSupabase;
  if (!form) return;

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };
  let hasRecoverySession = false;

  async function refreshRecoverySession() {
    if (!client) return setStatus("비밀번호 재설정 연결을 불러오지 못했습니다.", true);
    const { data: { session } } = await client.auth.getSession();
    hasRecoverySession = Boolean(session);
    if (!hasRecoverySession) setStatus("재설정 메일의 링크를 다시 열어 주세요. 링크가 만료되었다면 로그인 창에서 새 메일을 요청해 주세요.", true);
    else setStatus("새 비밀번호를 입력해 주세요.");
  }

  client?.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      hasRecoverySession = true;
      setStatus("새 비밀번호를 입력해 주세요.");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = form.elements.password.value;
    const confirmation = form.elements.passwordConfirm.value;
    if (!hasRecoverySession) return setStatus("재설정 메일의 링크를 다시 열어 주세요.", true);
    if (password.length < 8) return setStatus("비밀번호는 8자 이상으로 입력해 주세요.", true);
    if (password !== confirmation) return setStatus("새 비밀번호가 서로 다릅니다.", true);
    const submitButton = form.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;
    setStatus("새 비밀번호를 저장하고 있습니다.");
    const { error } = await client.auth.updateUser({ password });
    if (error) {
      if (submitButton) submitButton.disabled = false;
      return setStatus("새 비밀번호를 저장하지 못했습니다. 재설정 링크가 만료되었는지 확인해 주세요.", true);
    }
    setStatus("새 비밀번호를 저장했습니다. 내 프로필로 이동합니다.");
    window.setTimeout(() => { window.location.assign("account.html"); }, 1400);
  });

  refreshRecoverySession();
})();
