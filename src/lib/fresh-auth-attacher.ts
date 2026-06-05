import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

type RefreshResult = Awaited<ReturnType<typeof supabase.auth.refreshSession>>;

let refreshPromise: Promise<RefreshResult> | null = null;

const REFRESH_MARGIN_SECONDS = 120;

async function getFreshAccessToken() {
  if (typeof window === "undefined") return null;

  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (!session) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresSoon = !session.expires_at || session.expires_at - nowSeconds < REFRESH_MARGIN_SECONDS;

  if (expiresSoon) {
    try {
      refreshPromise ??= supabase.auth.refreshSession().finally(() => {
        refreshPromise = null;
      });
      const { data: refreshed, error } = await refreshPromise;
      if (!error && refreshed.session) {
        session = refreshed.session as Session;
      }
    } catch (error) {
      console.warn("[auth] session refresh failed; using current token if still valid", error);
    }
  }

  const stillUsable = !session.expires_at || session.expires_at > nowSeconds - 30;
  return stillUsable ? session.access_token : null;
}

export const attachFreshSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = await getFreshAccessToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});

export const refreshSupabaseSession = attachFreshSupabaseAuth;