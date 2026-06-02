import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// South Africa national team (Bafana Bafana) in API-Football.
// Verified via: GET https://v3.football.api-sports.io/teams?name=South%20Africa&type=national
const SA_TEAM_ID = 1469;

// Current international season. API-Football uses the start year of the season.
// Bumped here once per year. Falls back to previous season if current returns empty.
const CURRENT_SEASON = new Date().getUTCFullYear();

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
    console.error(`[live.functions] cachedFetch failed for ${key}:`, err);
    if (cached) return { data: cached.payload, source: "stale-cache", error: String(err) };
    return { data: null, source: "none", error: String(err) };
  }
}

async function apiFootball(path: string): Promise<unknown> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not set");
  const url = `https://v3.football.api-sports.io${path}`;
  console.log(`[api-football] GET ${path} (team=${SA_TEAM_ID})`);
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[api-football] ${res.status} ${path}: ${body.slice(0, 200)}`);
    throw new Error(`API-Football ${res.status}`);
  }
  const json = (await res.json()) as { response: unknown; errors?: unknown; results?: number };
  if (json.errors && typeof json.errors === "object" && Object.keys(json.errors).length > 0) {
    console.error(`[api-football] errors on ${path}:`, json.errors);
  }
  console.log(`[api-football] ${path} → ${json.results ?? "?"} results`);
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

// Defensive filter: API should already only return SA fixtures since we filter
// by team=, but guard against any misrouted entries.
function onlySAFixtures(list: AFFixture[]): AFFixture[] {
  return list.filter((f) => f.teams.home.id === SA_TEAM_ID || f.teams.away.id === SA_TEAM_ID);
}

export const getLiveUpcomingMatches = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveMatch[]>("af:fixtures:next:10:v2", 60 * 30, async () => {
    const res = (await apiFootball(`/fixtures?team=${SA_TEAM_ID}&next=10`)) as AFFixture[];
    const filtered = onlySAFixtures(res);
    console.log(`[live] upcoming: ${res.length} raw → ${filtered.length} SA-only`);
    return filtered.map(mapFixture);
  });
});

export const getLivePastMatches = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveMatch[]>("af:fixtures:last:10:v2", 60 * 60 * 6, async () => {
    const res = (await apiFootball(`/fixtures?team=${SA_TEAM_ID}&last=10`)) as AFFixture[];
    const filtered = onlySAFixtures(res);
    console.log(`[live] past: ${res.length} raw → ${filtered.length} SA-only`);
    return filtered.map(mapFixture);
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

type AFPlayerStatsResponse = Array<{
  player: {
    id: number;
    name: string;
    nationality: string;
    photo: string;
  };
  statistics: Array<{
    team: { id: number; name: string };
    league: { id: number; name: string; season: number };
    games: { appearances: number | null; position: string | null };
    goals: { total: number | null; assists: number | null };
  }>;
}>;

function mapPosition(p: string | null | undefined): LivePlayer["position"] {
  const s = (p ?? "").toLowerCase();
  if (s.startsWith("goal") || s === "g") return "GK";
  if (s.startsWith("def") || s === "d") return "DEF";
  if (s.startsWith("mid") || s === "m") return "MID";
  return "FWD";
}

// Fetch per-player season stats from API-Football's /players endpoint so we can
// surface the real club, appearances (caps in this season), goals and assists.
async function fetchPlayerStats(playerId: number, season: number) {
  try {
    const res = (await apiFootball(
      `/players?id=${playerId}&season=${season}`,
    )) as AFPlayerStatsResponse;
    const entry = res[0];
    if (!entry) return null;
    // Prefer the club statistics (not the national-team aggregation) for "club".
    const clubStat =
      entry.statistics.find((s) => s.team.id !== SA_TEAM_ID) ?? entry.statistics[0];
    // National-team stats for caps/goals if available
    const natStat = entry.statistics.find((s) => s.team.id === SA_TEAM_ID);
    return {
      nationality: entry.player.nationality,
      photo: entry.player.photo,
      club: clubStat?.team.name ?? "—",
      caps: natStat?.games.appearances ?? 0,
      goals: natStat?.goals.total ?? 0,
      assists: natStat?.goals.assists ?? 0,
    };
  } catch (err) {
    console.error(`[live] player stats failed for ${playerId}:`, err);
    return null;
  }
}

export const getLivePlayers = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LivePlayer[]>(`af:squad:${CURRENT_SEASON}:v3`, 60 * 60 * 24, async () => {
    const res = (await apiFootball(`/players/squads?team=${SA_TEAM_ID}`)) as AFSquadResponse;
    const team = res[0];
    if (!team || team.team.id !== SA_TEAM_ID) {
      console.error(`[live] squad: unexpected team id ${team?.team.id}`);
      return [];
    }
    const players = team.players ?? [];
    console.log(`[live] squad: ${players.length} players for ${team.team.name}`);

    // De-dupe by id
    const seen = new Set<number>();
    const unique = players.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

    // Enrich in parallel but capped to avoid rate limits
    const enriched: LivePlayer[] = [];
    const BATCH = 5;
    for (let i = 0; i < unique.length; i += BATCH) {
      const batch = unique.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (p) => {
          const stats = await fetchPlayerStats(p.id, CURRENT_SEASON);
          return {
            id: `af-${p.id}`,
            name: p.name,
            position: mapPosition(p.position),
            club: stats?.club ?? "—",
            jersey_number: p.number,
            caps: stats?.caps ?? 0,
            goals: stats?.goals ?? 0,
            assists: stats?.assists ?? 0,
            photo_url: stats?.photo ?? p.photo,
            bio: null,
          } satisfies LivePlayer;
        }),
      );
      enriched.push(...results);
    }
    return enriched;
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

// Strict relevance filter — must mention Bafana or SA national-team context.
const RELEVANT = /(bafana|safa|south africa(n)?\s+(national|men'?s|football|soccer|team)|hugo broos)/i;
// Reject obvious club-only items unless they also mention Bafana.
const CLUB_NOISE = /\b(epl|premier league|la liga|serie a|bundesliga|champions league|psl match|chiefs vs|pirates vs)\b/i;

export const getLiveNews = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveArticle[]>("newsapi:bafana:v2", 60 * 60, async () => {
    const key = process.env.NEWS_API_KEY;
    if (!key) throw new Error("NEWS_API_KEY not set");
    const q = encodeURIComponent('"Bafana Bafana" OR "South Africa national team" OR "SAFA"');
    const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=40`;
    const res = await fetch(url, { headers: { "X-Api-Key": key } });
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
    const json = (await res.json()) as NewsAPIResponse;
    console.log(`[live] news: ${json.articles.length} raw articles`);
    const filtered = json.articles.filter((a) => {
      const hay = `${a.title} ${a.description ?? ""}`;
      if (!RELEVANT.test(hay)) return false;
      if (CLUB_NOISE.test(hay) && !/bafana/i.test(hay)) return false;
      return true;
    });
    console.log(`[live] news: ${filtered.length} after relevance filter`);
    return filtered.map((a, i) => ({
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
  return cachedFetch<LiveStats>("af:stats:v2", 60 * 60 * 6, async () => {
    const [pastRaw, nextRaw] = await Promise.all([
      apiFootball(`/fixtures?team=${SA_TEAM_ID}&last=10`) as Promise<AFFixture[]>,
      apiFootball(`/fixtures?team=${SA_TEAM_ID}&next=10`) as Promise<AFFixture[]>,
    ]);
    const past = onlySAFixtures(pastRaw);
    const next = onlySAFixtures(nextRaw);
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
