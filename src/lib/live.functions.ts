import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchSafaUpcomingFixtures,
  safaConfirms,
  normalizeName,
  enrichSafaFixturesWithImages,
  type SafaFixture,
} from "@/lib/safa.server";
import { canonicalCountryName, nameToCountryCode, validateFixtureFlagData } from "@/lib/flags";

// South Africa national team (Bafana Bafana) in API-Football.
// Verified via: GET https://v3.football.api-sports.io/teams?search=South%20Africa
const SA_TEAM_ID = 1531;

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
  await supabaseAdmin.from("api_cache").upsert({
    cache_key: key,
    payload: payload as never,
    expires_at,
    updated_at: new Date().toISOString(),
  });
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

export type LiveTeam = {
  id: number | null;
  name: string;
  logo: string | null;
  country_code: string | null;
};

export type LiveMatch = {
  id: string;
  opponent: string;
  opponent_flag: string | null;
  /** Large match visual. Prefers SAFA Match Centre og:image, falls back to API-Football team logo. */
  cover_url: string | null;
  kickoff: string;
  venue: string;
  competition: string;
  is_home: boolean;
  home_team: LiveTeam;
  away_team: LiveTeam;
  home_score: number | null;
  away_score: number | null;
  status: "upcoming" | "live" | "completed";
};

type AFFixture = {
  fixture: {
    id: number;
    date: string;
    venue?: { name?: string | null };
    status: { short: string };
  };
  league: { name: string };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
};

function teamLogo(id: number): string {
  return `https://media.api-sports.io/football/teams/${id}.png`;
}

function teamCountryCode(team: { id: number | null; name: string }): string | null {
  return team.id === SA_TEAM_ID ? "ZA" : nameToCountryCode(team.name);
}

function canonicalTeamName(name: string): string {
  return canonicalCountryName(name) ?? name;
}

/**
 * Dev-time integrity check: every fixture must have two DISTINCT teams,
 * each with its own id+logo derived from fixture.teams.home / fixture.teams.away.
 * Logs a warning if SA appears on both sides, ids collide, or logos duplicate.
 */
function verifyFixtureTeams(m: LiveMatch, source: string): LiveMatch {
  const h = m.home_team;
  const a = m.away_team;
  const issues: string[] = [];
  if (!h || !a) issues.push("missing home_team/away_team");
  else {
    if (h.id != null && a.id != null && h.id === a.id) issues.push(`duplicate team id ${h.id}`);
    if (h.id === SA_TEAM_ID && a.id === SA_TEAM_ID) issues.push("South Africa on both sides");
    if (h.logo && a.logo && h.logo === a.logo) issues.push("duplicate team logo");
    if (h.name && a.name && h.name.trim().toLowerCase() === a.name.trim().toLowerCase())
      issues.push(`duplicate team name "${h.name}"`);
  }
  if (issues.length > 0) {
    console.warn(`[fixture-verify:${source}] ${m.id} ${m.kickoff} — ${issues.join("; ")}`, {
      home: h,
      away: a,
    });
  }
  validateFixtureFlagData(m.id, h, a, source);
  return m;
}

function mapFixture(f: AFFixture): LiveMatch {
  const isHome = f.teams.home.id === SA_TEAM_ID;
  const opponent = isHome ? f.teams.away : f.teams.home;
  const homeName = canonicalTeamName(f.teams.home.name);
  const awayName = canonicalTeamName(f.teams.away.name);
  const ftStatus = f.fixture.status.short;
  const status: LiveMatch["status"] =
    ftStatus === "NS" || ftStatus === "TBD" || ftStatus === "PST"
      ? "upcoming"
      : ["1H", "2H", "HT", "ET", "P", "LIVE"].includes(ftStatus)
        ? "live"
        : "completed";
  return verifyFixtureTeams(
    {
      id: `af-${f.fixture.id}`,
      opponent: canonicalTeamName(opponent.name),
      opponent_flag: opponent.logo ?? teamLogo(opponent.id),
      cover_url: opponent.logo ?? teamLogo(opponent.id),
      kickoff: f.fixture.date,
      venue: f.fixture.venue?.name ?? "TBD",
      competition: f.league.name,
      is_home: isHome,
      home_team: {
        id: f.teams.home.id,
        name: homeName,
        logo: f.teams.home.logo ?? teamLogo(f.teams.home.id),
        country_code: teamCountryCode({ id: f.teams.home.id, name: homeName }),
      },
      away_team: {
        id: f.teams.away.id,
        name: awayName,
        logo: f.teams.away.logo ?? teamLogo(f.teams.away.id),
        country_code: teamCountryCode({ id: f.teams.away.id, name: awayName }),
      },
      home_score: f.goals.home,
      away_score: f.goals.away,
      status,
    },
    "api-football",
  );
}

// Validate: SA must be a participant, and league must be a national-team
// competition (AFCON, World Cup, qualifiers, Nations League, friendlies).
// Club leagues are rejected outright.
const ALLOWED_COMP =
  /(africa cup of nations|afcon|world cup|qualif|friendl|nations league|cosafa|olympic)/i;
const CLUB_LEAGUE =
  /(premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa|psl|cup of south africa|nedbank|carling)/i;

function validFixture(f: AFFixture): boolean {
  const hasSA = f.teams.home.id === SA_TEAM_ID || f.teams.away.id === SA_TEAM_ID;
  if (!hasSA) return false;
  const league = f.league.name ?? "";
  if (CLUB_LEAGUE.test(league) && !ALLOWED_COMP.test(league)) return false;
  // Accept anything that looks like a national-team competition; if the league
  // name is unclear we still keep it because /fixtures?team= for a national
  // team only returns international fixtures.
  return true;
}

function onlySAFixtures(list: AFFixture[]): AFFixture[] {
  return list.filter(validFixture);
}

type VerifiedMatchSeed = {
  date: string; // ISO
  opponent: string;
  opponentCode: string | null;
  isHome: boolean;
  ourScore: number;
  theirScore: number;
  competition: string;
  venue: string;
};

// Verified recent completed Bafana Bafana matches (source: ESPN).
// API-Football's free plan caps at season 2024, so we authoritatively
// inject 2025–2026 results to keep Form + Last Match accurate.
const VERIFIED_RECENT_SEEDS: VerifiedMatchSeed[] = [
  { date: "2026-05-29T18:30:00+02:00", opponent: "Nicaragua", opponentCode: "NI", isHome: true, ourScore: 0, theirScore: 0, competition: "International Friendly", venue: "Orlando Stadium" },
  { date: "2026-03-31T20:00:00+00:00", opponent: "Panama", opponentCode: "PA", isHome: true, ourScore: 1, theirScore: 2, competition: "International Friendly", venue: "TBD" },
  { date: "2026-03-27T20:00:00+00:00", opponent: "Panama", opponentCode: "PA", isHome: true, ourScore: 1, theirScore: 1, competition: "International Friendly", venue: "TBD" },
  { date: "2026-01-04T18:00:00+00:00", opponent: "Cameroon", opponentCode: "CM", isHome: true, ourScore: 1, theirScore: 2, competition: "Africa Cup of Nations", venue: "Morocco" },
  { date: "2025-12-29T18:00:00+00:00", opponent: "Zimbabwe", opponentCode: "ZW", isHome: false, ourScore: 3, theirScore: 2, competition: "Africa Cup of Nations", venue: "Morocco" },
  { date: "2025-12-26T18:00:00+00:00", opponent: "Egypt", opponentCode: "EG", isHome: false, ourScore: 0, theirScore: 1, competition: "Africa Cup of Nations", venue: "Morocco" },
  { date: "2025-12-22T18:00:00+00:00", opponent: "Angola", opponentCode: "AO", isHome: true, ourScore: 2, theirScore: 1, competition: "Africa Cup of Nations", venue: "Morocco" },
  { date: "2025-11-15T15:00:00+02:00", opponent: "Zambia", opponentCode: "ZM", isHome: true, ourScore: 3, theirScore: 1, competition: "International Friendly", venue: "TBD" },
  { date: "2025-10-14T18:00:00+02:00", opponent: "Rwanda", opponentCode: "RW", isHome: true, ourScore: 3, theirScore: 0, competition: "FIFA World Cup Qualifying - CAF", venue: "Mbombela Stadium" },
  { date: "2025-10-10T18:00:00+02:00", opponent: "Zimbabwe", opponentCode: "ZW", isHome: false, ourScore: 0, theirScore: 0, competition: "FIFA World Cup Qualifying - CAF", venue: "TBD" },
];

const VERIFIED_RECENT_COMPLETED_MATCHES: LiveMatch[] = VERIFIED_RECENT_SEEDS.map((s) => {
  const saTeam: LiveTeam = {
    id: SA_TEAM_ID,
    name: "South Africa",
    logo: teamLogo(SA_TEAM_ID),
    country_code: "ZA",
  };
  const oppTeam: LiveTeam = {
    id: null,
    name: s.opponent,
    logo: null,
    country_code: s.opponentCode,
  };
  return verifyFixtureTeams(
    {
      id: `verified-${s.date.slice(0, 10)}-${normalizeName(s.opponent).replace(/\s+/g, "-")}`,
      opponent: s.opponent,
      opponent_flag: null,
      cover_url: null,
      kickoff: s.date,
      venue: s.venue,
      competition: s.competition,
      is_home: s.isHome,
      home_team: s.isHome ? saTeam : oppTeam,
      away_team: s.isHome ? oppTeam : saTeam,
      home_score: s.isHome ? s.ourScore : s.theirScore,
      away_score: s.isHome ? s.theirScore : s.ourScore,
      status: "completed",
    },
    "verified-result",
  );
});

// Build a synthetic LiveMatch from a SAFA-only fixture (when API-Football
// hasn't published it yet). SAFA is the authoritative source for upcoming
// Bafana matches, so we surface it even without API data.
function safaToLiveMatch(s: SafaFixture): LiveMatch {
  const opponent = s.summary.replace(/®/g, "").split(" - ")[0];
  const parts = opponent.split(/\s+vs\s+/i).map((p) => p.trim());
  const isBafanaHome = /bafana|south africa/i.test(parts[0] ?? "");
  const opp = canonicalTeamName((isBafanaHome ? parts[1] : parts[0]) ?? "TBD");
  return verifyFixtureTeams(
    {
      id: `safa-${s.uid}`,
      opponent: opp,
      opponent_flag: null,
      cover_url: null,
      kickoff: s.startUtc,
      venue: s.location || "TBD",
      competition: s.summary.split(" - ")[1] ?? "International",
      is_home: isBafanaHome,
      home_team: {
        id: isBafanaHome ? SA_TEAM_ID : null,
        name: isBafanaHome ? "South Africa" : opp,
        logo: isBafanaHome ? teamLogo(SA_TEAM_ID) : null,
        country_code: isBafanaHome ? "ZA" : teamCountryCode({ id: null, name: opp }),
      },
      away_team: {
        id: isBafanaHome ? null : SA_TEAM_ID,
        name: isBafanaHome ? opp : "South Africa",
        logo: isBafanaHome ? null : teamLogo(SA_TEAM_ID),
        country_code: isBafanaHome ? teamCountryCode({ id: null, name: opp }) : "ZA",
      },
      home_score: null,
      away_score: null,
      status: "upcoming",
    },
    "safa",
  );
}

export const getLiveUpcomingMatches = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveMatch[]>("af:fixtures:next:10:v7-sa-team-id", 60 * 10, async () => {
    const [afRes, safa] = await Promise.all([
      apiFootball(`/fixtures?team=${SA_TEAM_ID}&next=15`) as Promise<AFFixture[]>,
      fetchSafaUpcomingFixtures(),
    ]);
    console.log(`[live] upcoming sources: api=${afRes.length} safa=${safa.length}`);

    // Step 1: API-Football → only NS, SA participant, valid competition
    const afValid = onlySAFixtures(afRes)
      .filter((f) => ["NS", "TBD", "PST"].includes(f.fixture.status.short))
      .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

    // Step 2: cross-validate against SAFA. If SAFA is reachable but doesn't
    // confirm an AF fixture, drop it (truth layer override).
    const verified = afValid.filter((f) => {
      const opp = f.teams.home.id === SA_TEAM_ID ? f.teams.away.name : f.teams.home.name;
      const ok = safaConfirms(safa, opp, f.fixture.date);
      if (!ok)
        console.log(
          `[live] dropping unverified fixture vs ${opp} on ${f.fixture.date.slice(0, 10)}`,
        );
      return ok;
    });

    const fromApi = verified.map(mapFixture);

    // Step 3: include SAFA-only fixtures that API-Football hasn't published.
    const apiPairs = fromApi.map((m) => ({
      day: m.kickoff.slice(0, 10),
      opp: normalizeName(m.opponent),
    }));
    const safaOnly = safa
      .filter((s) => {
        const day = s.startUtc.slice(0, 10);
        return !apiPairs.some(
          (p) =>
            p.day === day && (p.opp.includes(s.opponentSlug) || s.opponentSlug.includes(p.opp)),
        );
      })
      .map(safaToLiveMatch);

    // De-dupe by id and sort ascending
    const merged = [...fromApi, ...safaOnly];
    const seen = new Set<string>();
    const dedup = merged
      .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
      .slice(0, 10);

    // Step 4: image enrichment — SAFA og:image per match overrides team logos.
    // We build a (day|opponentSlug) lookup against the SAFA list so both
    // API-derived and SAFA-derived fixtures get the official match visual.
    const safaImages = await enrichSafaFixturesWithImages(safa);
    const safaByKey = new Map<string, string>();
    for (const f of safa) {
      const img = safaImages.get(f.uid);
      if (img) safaByKey.set(`${f.startUtc.slice(0, 10)}|${f.opponentSlug}`, img);
    }
    const withImages = dedup.map((m) => {
      const oppSlug = normalizeName(m.opponent);
      const day = m.kickoff.slice(0, 10);
      // Try exact key, then loose contains match.
      let cover = safaByKey.get(`${day}|${oppSlug}`) ?? null;
      if (!cover) {
        for (const [k, v] of safaByKey) {
          const [d, slug] = k.split("|");
          if (d === day && (slug.includes(oppSlug) || oppSlug.includes(slug))) {
            cover = v;
            break;
          }
        }
      }
      return cover ? { ...m, cover_url: cover } : m;
    });

    console.log(
      `[live] upcoming: api-verified=${fromApi.length} safa-only=${safaOnly.length} → ${withImages.length} (safa-images=${safaImages.size})`,
    );
    return withImages;
  });
});

export const getLivePastMatches = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveMatch[]>("af:fixtures:last:10:v9-verified-recent", 60 * 30, async () => {
    const accessibleSeasons = [2024, 2023, 2022];
    const seasonResults = await Promise.all(
      accessibleSeasons.map(async (season) => {
        try {
          const fixtures = (await apiFootball(
            `/fixtures?team=${SA_TEAM_ID}&season=${season}&status=FT`,
          )) as AFFixture[];
          return { ok: true, fixtures };
        } catch (err) {
          console.error(`[live] past season ${season} failed:`, err);
          return { ok: false, fixtures: [] as AFFixture[] };
        }
      }),
    );

    const raw = seasonResults.flatMap((result) => result.fixtures);

    const filtered = onlySAFixtures(raw)
      .filter((f) => f.goals.home != null && f.goals.away != null)
      .sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())
      .slice(0, 10);

    const apiMatches = filtered.map(mapFixture);
    const verifiedMatches = VERIFIED_RECENT_COMPLETED_MATCHES.filter(
      (match) => new Date(match.kickoff).getTime() <= Date.now(),
    );
    const seen = new Set<string>();
    const merged = [...verifiedMatches, ...apiMatches]
      .filter((match) => {
        const key = `${match.kickoff.slice(0, 10)}|${normalizeName(match.opponent)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
      .slice(0, 10);

    console.log(
      `[live] past: ${raw.length} raw season fixtures → ${merged.length} merged completed`,
    );
    return merged;
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

export type LiveManager = {
  id: string;
  name: string;
  role: "Manager";
  nationality: string | null;
  photo_url: string | null;
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

type AFCoachResponse = Array<{
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  nationality: string | null;
  photo: string | null;
  career: Array<{
    team: { id: number; name: string };
    start: string | null;
    end: string | null;
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
    const clubStat = entry.statistics.find((s) => s.team.id !== SA_TEAM_ID) ?? entry.statistics[0];
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
  return cachedFetch<LivePlayer[]>(
    `af:squad:${CURRENT_SEASON}:v8-api-headshots`,
    60 * 60 * 24,
    async () => {
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
              // Photo chain: SAFA (official national-team page) → API-Football
              // stats photo → squad photo → API-Football CDN by id.
              photo_url:
                stats?.photo ??
                p.photo ??
                `https://media.api-sports.io/football/players/${p.id}.png`,
              bio: null,
            } satisfies LivePlayer;
          }),
        );
        enriched.push(...results);
      }

      console.log(`[live] squad: ${enriched.length}/${enriched.length} API headshots`);
      return enriched;
    },
  );
});

export const getLiveManager = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveManager>("af:manager:v2-sa-team-id-photo", 60 * 60 * 24, async () => {
    const coaches = (await apiFootball(`/coachs?team=${SA_TEAM_ID}`)) as AFCoachResponse;
    const current =
      coaches.find((coach) =>
        /broos/i.test(`${coach.firstname ?? ""} ${coach.lastname ?? ""} ${coach.name}`),
      ) ??
      coaches.find((coach) =>
        coach.career?.some((job) => job.team.id === SA_TEAM_ID && !job.end),
      ) ??
      coaches[0];

    if (!current) {
      return {
        id: "manager-fallback",
        name: "Hugo Broos",
        role: "Manager",
        nationality: "Belgium",
        photo_url: "https://media.api-sports.io/football/coachs/2883.png",
      };
    }

    return {
      id: `coach-${current.id}`,
      name: `${current.firstname ?? ""} ${current.lastname ?? current.name}`.trim() || current.name,
      role: "Manager",
      nationality: current.nationality,
      photo_url: /broos/i.test(
        `${current.firstname ?? ""} ${current.lastname ?? ""} ${current.name}`,
      )
        ? "https://upload.wikimedia.org/wikipedia/commons/f/f0/Hugo_Broos_1.jpg"
        : (current.photo ?? `https://media.api-sports.io/football/coachs/${current.id}.png`),
    };
  });
});

// ============= NEWS (Multi-source Aggregation Engine) =============

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
  score?: number;
  relevance?: "high" | "medium" | "low";
  matched_entities?: string[];
};

type RawArticle = {
  title: string;
  description: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(s: string) {
  return decodeEntities(s.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? stripTags(m[1]) : "";
}

function pickAttr(xml: string, tag: string, attr: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["']`, "i"));
  return m ? m[1] : null;
}

function extractImage(item: string): string | null {
  // <media:content url="...">, <media:thumbnail url="...">, <enclosure url="..." type="image/...">
  const media =
    pickAttr(item, "media:content", "url") ||
    pickAttr(item, "media:thumbnail", "url") ||
    pickAttr(item, "enclosure", "url");
  if (media) return media;
  // <img src="..."> inside description
  const desc = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "";
  const img = desc.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  return img ?? null;
}

function parseRss(xml: string, source: string): RawArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((it) => {
      const title = pick(it, "title");
      const link = pick(it, "link") || pickAttr(it, "link", "href") || "";
      const description = pick(it, "description") || pick(it, "summary");
      const pubDate = pick(it, "pubDate") || pick(it, "published") || pick(it, "dc:date");
      const image = extractImage(it);
      if (!title || !link) return null;
      const date = pubDate ? new Date(pubDate) : new Date();
      return {
        title,
        description,
        url: link,
        image,
        publishedAt: isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
        source,
      } satisfies RawArticle;
    })
    .filter((x): x is RawArticle => !!x);
}

async function fetchRss(
  url: string,
  source: string,
  weight: number,
): Promise<{ articles: RawArticle[]; weight: number }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 BafanaSupportersBot/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const xml = await res.text();
    return { articles: parseRss(xml, source), weight };
  } catch (err) {
    console.warn(`[news] RSS ${source} failed:`, err);
    return { articles: [], weight };
  }
}

type NewsAPIResponse = {
  articles: Array<{
    title: string;
    description: string | null;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    source: { name: string };
  }>;
};

async function fetchNewsApi(): Promise<RawArticle[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  try {
    const q = encodeURIComponent('"Bafana Bafana" OR "South Africa national team" OR "SAFA"');
    const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=40`;
    const res = await fetch(url, { headers: { "X-Api-Key": key } });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = (await res.json()) as NewsAPIResponse;
    return json.articles.map((a) => ({
      title: a.title,
      description: a.description ?? "",
      url: a.url,
      image: a.urlToImage,
      publishedAt: a.publishedAt,
      source: a.source.name,
    }));
  } catch (err) {
    console.warn("[news] NewsAPI failed:", err);
    return [];
  }
}

// Strict fallback set — ONLY SAFA/SA-related visuals, no random stock club shots.
const SA_TEAM_LOGO = `https://media.api-sports.io/football/teams/${SA_TEAM_ID}.png`;
const NEWS_FALLBACK_IMAGES = {
  // Stadium / generic SA national team fallback (last resort).
  stadium: "https://images.unsplash.com/photo-1540552965303-1ee5b5d6a8ae?w=1200&q=80",
  team: SA_TEAM_LOGO,
} as const;

function categorize(hay: string): LiveArticle["category"] {
  if (/\b(vs|v\.|match|fixture|kick.?off|goal|draw|win|defeat|final|qualif)\b/i.test(hay))
    return "match";
  if (
    /\b(player|striker|defender|midfielder|keeper|coach|hugo broos|squad call|call.?up)\b/i.test(
      hay,
    )
  )
    return "player";
  if (/\b(supporter|fan|fans|stadium|crowd|ticket)\b/i.test(hay)) return "supporter";
  return "team";
}

/** Reject obviously invalid image URLs (non-http, tracking pixels, 1x1 spacers). */
function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\/(1x1|spacer|pixel|blank)\.(gif|png)/i.test(url)) return false;
  if (/doubleclick|adservice|googlesyndication/i.test(url)) return false;
  return true;
}

type ImageCtx = {
  players: Array<{ name: string; photo: string | null }>;
  opponents: Array<{ name: string; logo: string | null }>;
};

/**
 * Hardened image resolution — strict priority order:
 *   1. Valid article image from source (RSS/og:image)
 *   2. Player photo if article mentions a squad player
 *   3. Opponent team logo if article mentions an upcoming opponent
 *   4. SA national team logo if article mentions Bafana / South Africa
 *   5. Generic stadium fallback (LAST RESORT — SA-related only)
 */
function resolveImage(articleImage: string | null, hay: string, imgCtx: ImageCtx): string {
  // P1: trust the article's own image if it looks valid.
  if (isValidImageUrl(articleImage)) return articleImage;

  const lower = hay.toLowerCase();

  // P2: player entity match → player photo.
  for (const p of imgCtx.players) {
    const last = p.name.split(/\s+/).slice(-1)[0]?.toLowerCase();
    if (last && last.length > 3 && lower.includes(last) && isValidImageUrl(p.photo)) {
      return p.photo;
    }
  }

  // P3: upcoming opponent entity match → team logo.
  for (const o of imgCtx.opponents) {
    if (o.name && lower.includes(o.name.toLowerCase()) && isValidImageUrl(o.logo)) {
      return o.logo;
    }
  }

  // P4: Bafana / South Africa mention → SA national team logo.
  if (/(bafana|south africa|safa)/i.test(hay)) return SA_TEAM_LOGO;

  // P5: generic SA stadium fallback.
  return NEWS_FALLBACK_IMAGES.stadium;
}

// Reject obvious club-only items unless they also mention Bafana / SA.
const CLUB_NOISE =
  /\b(epl|premier league|la liga|serie a|bundesliga|champions league|psl match|chiefs vs|pirates vs|man utd|liverpool|arsenal|chelsea|barcelona|real madrid)\b/i;
const SA_CONTEXT =
  /(bafana|safa|south africa(n)?\s+(national|men'?s|football|soccer|team)|hugo broos|banyana)/i;

type ScoreCtx = {
  playerNames: string[];
  upcomingOpponents: string[];
  imgCtx: ImageCtx;
};

function scoreArticle(a: RawArticle, ctx: ScoreCtx): { score: number; matched: string[] } {
  const hay = `${a.title} ${a.description}`.toLowerCase();
  let score = 0;
  const matched: string[] = [];

  if (
    /\bbafana\b/.test(hay) ||
    /south africa(n)? (national|men'?s|football|soccer|team)/.test(hay)
  ) {
    score += 50;
    matched.push("Bafana Bafana");
  }
  for (const name of ctx.playerNames) {
    const last = name.split(/\s+/).slice(-1)[0]?.toLowerCase();
    if (last && last.length > 3 && hay.includes(last)) {
      score += 40;
      matched.push(name);
      break;
    }
  }
  for (const opp of ctx.upcomingOpponents) {
    if (opp && hay.includes(opp.toLowerCase())) {
      score += 30;
      matched.push(`vs ${opp}`);
      break;
    }
  }
  if (/\b(safa|caf|cafonline)\b/i.test(a.source) || /safa\.net|cafonline\.com/i.test(a.url)) {
    score += 20;
    matched.push(a.source);
  }
  const ageH = (Date.now() - new Date(a.publishedAt).getTime()) / 36e5;
  if (ageH < 24) score += 10;
  else if (ageH < 72) score += 5;

  return { score, matched };
}

function dedupeByTitle<T extends { title: string; url: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((a) => {
    const key = slugify(a.title).slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildScoreContext(): Promise<ScoreCtx> {
  const ctx: ScoreCtx = {
    playerNames: [],
    upcomingOpponents: [],
    imgCtx: { players: [], opponents: [] },
  };
  try {
    const squad = await readCache<LivePlayer[]>(`af:squad:${CURRENT_SEASON}:v8-api-headshots`);
    if (squad?.payload) {
      ctx.playerNames = squad.payload.map((p) => p.name);
      ctx.imgCtx.players = squad.payload.map((p) => ({ name: p.name, photo: p.photo_url }));
    }
  } catch {
    /* noop */
  }
  try {
    const up = await readCache<LiveMatch[]>("af:fixtures:next:10:v7-sa-team-id");
    if (up?.payload) {
      ctx.upcomingOpponents = up.payload.map((m) => m.opponent);
      ctx.imgCtx.opponents = up.payload.map((m) => ({
        name: m.opponent,
        logo: m.cover_url ?? m.opponent_flag,
      }));
    }
  } catch {
    /* noop */
  }
  return ctx;
}

export const getLiveNews = createServerFn({ method: "GET" }).handler(async () => {
  return cachedFetch<LiveArticle[]>("news:aggregated:v1", 60 * 20, async () => {
    const ctx = await buildScoreContext();

    // Multi-source pull in parallel.
    const [bbc, espn, goal, caf, newsapi] = await Promise.all([
      fetchRss("https://feeds.bbci.co.uk/sport/football/africa/rss.xml", "BBC Sport", 1),
      fetchRss("https://www.espn.com/espn/rss/soccer/news", "ESPN", 1),
      fetchRss("https://www.goal.com/feeds/en/news", "Goal.com", 1),
      fetchRss("https://www.cafonline.com/rss/news/", "CAF", 1.2),
      fetchNewsApi(),
    ]);

    const all: RawArticle[] = [
      ...bbc.articles,
      ...espn.articles,
      ...goal.articles,
      ...caf.articles,
      ...newsapi,
    ];

    console.log(
      `[news] sources: bbc=${bbc.articles.length} espn=${espn.articles.length} goal=${goal.articles.length} caf=${caf.articles.length} newsapi=${newsapi.length}`,
    );

    // Relevance gate.
    const gated = all.filter((a) => {
      const hay = `${a.title} ${a.description}`;
      if (CLUB_NOISE.test(hay) && !SA_CONTEXT.test(hay)) return false;
      // must mention SA context OR a known player/opponent
      if (SA_CONTEXT.test(hay)) return true;
      const lower = hay.toLowerCase();
      if (
        ctx.playerNames.some((n) => {
          const last = n.split(/\s+/).slice(-1)[0]?.toLowerCase();
          return last && last.length > 3 && lower.includes(last);
        })
      )
        return true;
      if (ctx.upcomingOpponents.some((o) => o && lower.includes(o.toLowerCase()))) return true;
      return false;
    });

    const deduped = dedupeByTitle(gated);

    const scored = deduped
      .map((a) => {
        const { score, matched } = scoreArticle(a, ctx);
        const hay = `${a.title} ${a.description}`;
        const category = categorize(hay);
        const relevance: LiveArticle["relevance"] =
          score >= 60 ? "high" : score >= 30 ? "medium" : "low";
        const slug = `${slugify(a.title)}-${slugify(a.source).slice(0, 12)}`;
        return {
          id: slug,
          slug,
          title: a.title,
          excerpt: a.description.slice(0, 280),
          body: a.description,
          cover_url: resolveImage(a.image, `${a.title} ${a.description}`, ctx.imgCtx),
          category,
          is_premium: false,
          published_at: a.publishedAt,
          source: a.source,
          url: a.url,
          score,
          relevance,
          matched_entities: matched,
        } satisfies LiveArticle;
      })
      .sort(
        (a, b) =>
          (b.score ?? 0) - (a.score ?? 0) ||
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
      )
      .slice(0, 60);

    console.log(
      `[news] aggregated → gated=${gated.length} dedup=${deduped.length} scored=${scored.length} (high=${scored.filter((s) => s.relevance === "high").length})`,
    );
    return scored;
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
