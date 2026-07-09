(() => {
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
