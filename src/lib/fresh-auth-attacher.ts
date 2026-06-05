import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

let refreshPromise: ReturnType<typeof supabase.auth.refreshSession> | null = null;
let lastRefreshAt = 0;

async function getFreshAccessToken() {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (!session) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresSoon = !session.expires_at || session.expires_at - nowSeconds < 300;
  const refreshStale = Date.now() - lastRefreshAt > 30_000;

  if (expiresSoon || refreshStale) {
    refreshPromise ??= supabase.auth.refreshSession().finally(() => {
      refreshPromise = null;
    });
    const { data: refreshed, error } = await refreshPromise;
    if (!error && refreshed.session) {
      session = refreshed.session;
      lastRefreshAt = Date.now();
    }
  }

  return session.access_token;
}

export const attachFreshSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = await getFreshAccessToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});