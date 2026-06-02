import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchSafaSquadList,
  fetchSafaPlayerDetails,
  fetchSafaAllMatches,
  type SafaSquadPlayer,
  type SafaPlayerDetails,
  type SafaMatch,
} from "@/lib/safa-scrape.server";

type Cached<T> = { payload: T; stale: boolean };

async function readCache<T>(key: string): Promise<Cached<T> | null> {
  const { data } = await supabaseAdmin
    .from("api_cache")
    .select("payload, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  const stale = new Date(data.expires_at).getTime() < Date.now();
  return { payload: data.payload as T, stale };
}

async function writeCache(key: string, payload: unknown, ttlSeconds: number) {
  const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await supabaseAdmin
    .from("api_cache")
    .upsert({
      cache_key: key,
      payload: payload as never,
      expires_at,
      updated_at: new Date().toISOString(),
    });
}

async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<{ data: T | null }> {
  const c = await readCache<T>(key);
  if (c && !c.stale) return { data: c.payload };
  try {
    const fresh = await fetcher();
    await writeCache(key, fresh, ttl);
    return { data: fresh };
  } catch (err) {
    console.error(`[safa.functions] ${key} fetch failed:`, err);
    return { data: c?.payload ?? null };
  }
}

export const getSafaSquad = createServerFn({ method: "GET" }).handler(async () => {
  return cached<SafaSquadPlayer[]>("safa:squad:v1", 60 * 60, fetchSafaSquadList);
});

export const getSafaPlayer = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data }) => {
    const slug = data as string;
    return cached<SafaPlayerDetails | null>(
      `safa:player:${slug}:v1`,
      60 * 60 * 6,
      () => fetchSafaPlayerDetails(slug),
    );
  });

export const getSafaMatches = createServerFn({ method: "GET" }).handler(async () => {
  return cached<SafaMatch[]>("safa:matches:v1", 60 * 15, fetchSafaAllMatches);
});
