// Server-only Football-Data.org client. NEVER import from client code.
// Caches every competition fetch in api_cache to stay well under the
// 10 req/min ceiling on the paid tier (we poll once per 5 min).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FD_BASE = "https://api.football-data.org/v4";
const WC_COMPETITION_CODE = "WC"; // FIFA World Cup
const CACHE_TTL_SECONDS = 60; // safety net; cron polls every 5min anyway
const CACHE_KEY_MATCHES = "football_data:wc:matches";

export type FdTeam = {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
};

export type FdMatch = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | POSTPONED | CANCELLED | SUSPENDED | LIVE
  minute: number | null;
  stage: string | null;
  group: string | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  };
};

function getKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_API_KEY secret is not configured");
  return key;
}

async function readCache(key: string): Promise<unknown | null> {
  const { data } = await supabaseAdmin
    .from("api_cache")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.payload;
}

async function writeCache(key: string, payload: unknown, ttlSeconds: number) {
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await supabaseAdmin
    .from("api_cache")
    .upsert({ cache_key: key, payload: payload as object, expires_at: expires, updated_at: new Date().toISOString() });
}

/**
 * Fetch all World Cup matches in a single API call. Cached for 60s.
 * One request returns every fixture in the tournament, so we never need
 * per-match calls.
 */
export async function fetchWorldCupMatches(opts: { forceRefresh?: boolean } = {}): Promise<FdMatch[]> {
  if (!opts.forceRefresh) {
    const cached = await readCache(CACHE_KEY_MATCHES);
    if (cached && typeof cached === "object" && Array.isArray((cached as { matches?: unknown }).matches)) {
      return (cached as { matches: FdMatch[] }).matches;
    }
  }

  const res = await fetch(`${FD_BASE}/competitions/${WC_COMPETITION_CODE}/matches`, {
    headers: { "X-Auth-Token": getKey() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Football-Data ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { matches?: FdMatch[] };
  const matches = json.matches ?? [];
  await writeCache(CACHE_KEY_MATCHES, { matches }, CACHE_TTL_SECONDS);
  return matches;
}

export function mapFdStatus(status: string): "upcoming" | "live" | "finished" | "postponed" | "cancelled" {
  switch (status) {
    case "IN_PLAY":
    case "LIVE":
    case "PAUSED":
      return "live";
    case "FINISHED":
      return "finished";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    case "SCHEDULED":
    case "TIMED":
    default:
      return "upcoming";
  }
}
