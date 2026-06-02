import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SA_TEAM_ID = 1469; // South Africa national team in API-Football

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
    .upsert({ cache_key: key, payload: payload as never, expires_at, updated_at: new Date().toISOString() });
}

async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T | null; source: "live" | "cache" | "stale-cache" | "none"; error?: string }> {
  const cached = await readCache<T>(key);
  if (cached && !cached.stale) return { data: cached.payload, source: "cache" };
  try {
    const fresh = await fetcher();
    await writeCache(key, fresh as unknown, ttlSeconds);
    return { data: fresh, source: "live" };
  } catch (err) {
    if (cached) return { data: cached.payload, source: "stale-cache", error: String(err) };
    return { data: null, source: "none", error: String(err) };
  }
}

async function apiFootball(path: string): Promise<unknown> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not set");
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  const json = (await res.json()) as { response: unknown; errors?: unknown };
  return json.response;
}

// ============= FIXTURES =============

export type LiveMatch = {
  id: string;
  opponent: string;
  opponent_flag: string | null;
  kickoff: string;
  venue: string;
  competition: string;
  is_home: boolean;
  home_score: number | null;
  away_score: number | null;
  status: "upcoming" | "live" | "completed";
};

type AFFixture = {
  fixture: { id: number; date: string; venue?: { name?: string | null }; status: { short: string } };
  league: { name: string };
  teams: { home: { id: number; name: string; logo?: string }; away: { id: number; name: string; logo?: string } };
  goals: { home: number | null; away: number | null };
};

function mapFixture(f: AFFixture): LiveMatch {
  const isHome = f.teams.home.id === SA_TEAM_ID;
  const opponent = isHome ? f.teams.away : f.teams.home;
  const ftStatus = f.fixture.status.short;
  const status: LiveMatch["status"] =
    ftStatus === "NS" || ftStatus === "TBD" || ftStatus === "PST"
      ? "upcoming"
      : ["1H", "2H", "HT", "ET", "P", "LIVE"].includes(ftStatus)
        ? "live"
        : "completed";
  return {
    id: `af-${f.fixture.id}`,
    opponent: opponent.name,
    opponent_flag: opponent.logo ?? null,
    kickoff: f.fixture.date,
    venue: f.fixture.venue?.name ?? "TBD",
    competition: f.league.name,
    is_home: isHome,
    home_score: f.goals.home,
    away_score: f.goals.away,
    status,
  };
}

export const getLiveUpcomingMatches = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveMatch[]>("af:fixtures:next:10", 60 * 30, async () => {
    const res = (await apiFootball(`/fixtures?team=${SA_TEAM_ID}&next=10`)) as AFFixture[];
    return res.map(mapFixture);
  });
});

export const getLivePastMatches = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveMatch[]>("af:fixtures:last:10", 60 * 60 * 6, async () => {
    const res = (await apiFootball(`/fixtures?team=${SA_TEAM_ID}&last=10`)) as AFFixture[];
    return res.map(mapFixture);
  });
});

// ============= SQUAD =============

export type LivePlayer = {
  id: string;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  club: string;
  jersey_number: number | null;
  caps: number;
  goals: number;
  assists: number;
  photo_url: string | null;
  bio: string | null;
};

type AFSquadResponse = Array<{
  team: { id: number; name: string };
  players: Array<{
    id: number;
    name: string;
    age: number;
    number: number | null;
    position: string;
    photo: string;
  }>;
}>;

function mapPosition(p: string): LivePlayer["position"] {
  const s = p.toLowerCase();
  if (s.startsWith("goal")) return "GK";
  if (s.startsWith("def")) return "DEF";
  if (s.startsWith("mid")) return "MID";
  return "FWD";
}

export const getLivePlayers = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LivePlayer[]>("af:squad", 60 * 60 * 24, async () => {
    const res = (await apiFootball(`/players/squads?team=${SA_TEAM_ID}`)) as AFSquadResponse;
    const players = res[0]?.players ?? [];
    return players.map((p) => ({
      id: `af-${p.id}`,
      name: p.name,
      position: mapPosition(p.position),
      club: "South Africa",
      jersey_number: p.number,
      caps: 0,
      goals: 0,
      assists: 0,
      photo_url: p.photo,
      bio: null,
    }));
  });
});

// ============= NEWS =============

export type LiveArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  category: "team" | "match" | "player" | "supporter";
  is_premium: boolean;
  published_at: string;
  source?: string;
  url?: string;
};

type NewsAPIResponse = {
  articles: Array<{
    title: string;
    description: string | null;
    content: string | null;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    source: { name: string };
  }>;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export const getLiveNews = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveArticle[]>("newsapi:bafana", 60 * 60, async () => {
    const key = process.env.NEWS_API_KEY;
    if (!key) throw new Error("NEWS_API_KEY not set");
    const q = encodeURIComponent('"Bafana Bafana" OR "South Africa football"');
    const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=20`;
    const res = await fetch(url, { headers: { "X-Api-Key": key } });
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
    const json = (await res.json()) as NewsAPIResponse;
    return json.articles.map((a, i) => ({
      id: `news-${i}-${slugify(a.title)}`,
      slug: `${slugify(a.title)}-${i}`,
      title: a.title,
      excerpt: a.description ?? "",
      body: a.content ?? a.description ?? "",
      cover_url: a.urlToImage,
      category: "team" as const,
      is_premium: false,
      published_at: a.publishedAt,
      source: a.source.name,
      url: a.url,
    }));
  });
});

// ============= STATS =============

export type LiveStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  topScorer: string | null;
  upcomingCount: number;
};

export const getLiveStats = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveStats>("af:stats", 60 * 60 * 6, async () => {
    const [past, next] = await Promise.all([
      apiFootball(`/fixtures?team=${SA_TEAM_ID}&last=10`) as Promise<AFFixture[]>,
      apiFootball(`/fixtures?team=${SA_TEAM_ID}&next=10`) as Promise<AFFixture[]>,
    ]);
    let wins = 0,
      draws = 0,
      losses = 0,
      gf = 0,
      ga = 0;
    for (const f of past) {
      const isHome = f.teams.home.id === SA_TEAM_ID;
      const our = (isHome ? f.goals.home : f.goals.away) ?? 0;
      const their = (isHome ? f.goals.away : f.goals.home) ?? 0;
      gf += our;
      ga += their;
      if (our > their) wins++;
      else if (our === their) draws++;
      else losses++;
    }
    return {
      played: past.length,
      wins,
      draws,
      losses,
      goalsFor: gf,
      goalsAgainst: ga,
      topScorer: null,
      upcomingCount: next.length,
    };
  });
});
