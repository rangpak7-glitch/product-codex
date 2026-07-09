(() => {
  const form = document.querySelector("[data-password-reset-form]");
  const status = document.querySelector("[data-password-reset-status]");
  const client = window.FaithSupabase;
  if (!form) return;

  const setStatus = (message) => { if (status) status.textContent = message; };
  let hasRecoverySession = false;

  async function refreshRecoverySession() {
    if (!client) return setStatus("비밀번호 재설정 연결을 불러오지 못했습니다.");
    const { data: { session } } = await client.auth.getSession();
    hasRecoverySession = Boolean(session);
    if (!hasRecoverySession) setStatus("재설정 메일의 링크를 다시 열어 주세요.");
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
    if (!hasRecoverySession) return setStatus("재설정 메일의 링크를 다시 열어 주세요.");
    if (password.length < 8) return setStatus("비밀번호는 8자 이상으로 입력해 주세요.");
    if (password !== confirmation) return setStatus("새 비밀번호가 서로 다릅니다.");
    const { error } = await client.auth.updateUser({ password });
    if (error) return setStatus(error.message);
    await client.auth.signOut();
    setStatus("새 비밀번호를 저장했습니다. 관리자 로그인 화면으로 이동합니다.");
    window.setTimeout(() => { window.location.assign("admin-faith-resources.html"); }, 1600);
  });

  refreshRecoverySession();
})();
