(() => {
  // 공개 Worker 주소만 설정합니다. 비밀키는 Worker Secret으로만 관리합니다.
  window.FAITH_ORDER_API_URL = window.FAITH_ORDER_API_URL || "https://prayer-spring-billing.rangpak7.workers.dev";

  if (!window.supabase?.createClient) {
    window.FaithSupabase = null;
    return;
  }

  window.FaithSupabase = window.supabase.createClient(
    "https://wtkzqovsrnlsrtnbpmva.supabase.co",
    "sb_publishable_Riw4sKaiustoeTDW-i-xjA_Ae50e-ic",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
