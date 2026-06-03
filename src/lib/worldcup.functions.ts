// World Cup 2026 ingestion + live score refresh via API-Football
// Server-only — secrets read inside handler.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const WC_LEAGUE_ID = 1; // FIFA World Cup (API-Football)
const WC_SEASON = 2026;

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: { round: string };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
};

function stageFromRound(round: string): string {
  const r = round.toLowerCase();
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter") && !r.includes("third")) return "final";
  if (r.includes("third")) return "third";
  if (r.includes("semi")) return "sf";
  if (r.includes("quarter")) return "qf";
  if (r.includes("round of 16") || r.includes("1/8")) return "r16";
  if (r.includes("round of 32") || r.includes("1/16")) return "r32";
  if (r.includes("group")) return "group";
  return "other";
}

function statusFromShort(s: string): "scheduled" | "live" | "finished" {
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(s)) return "live";
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(s)) return "finished";
  return "scheduled";
}

export const importWorldCupFixtures = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");

  const url = `https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`;
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  const json = (await res.json()) as { response: ApiFixture[] };
  const fixtures = json.response ?? [];

  if (!fixtures.length) {
    return { imported: 0, total: 0, message: "No fixtures returned (season may be unpublished)." };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const rows = fixtures.map((f) => ({
    external_id: `wc-${WC_SEASON}-${f.fixture.id}`,
    title: `${f.teams.home.name} vs ${f.teams.away.name}`,
    description: `FIFA World Cup ${WC_SEASON} — ${f.league.round}`,
    event_type: "wc_match",
    stage: stageFromRound(f.league.round),
    competition: `FIFA World Cup ${WC_SEASON}`,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    home_team_flag: f.teams.home.logo,
    away_team_flag: f.teams.away.logo,
    kickoff: f.fixture.date,
    venue: f.fixture.venue.name,
    city: f.fixture.venue.city,
    country: null,
    status: statusFromShort(f.fixture.status.short),
    home_score: f.goals.home,
    away_score: f.goals.away,
    minute: f.fixture.status.elapsed,
  }));

  const { error } = await admin.from("events").upsert(rows, { onConflict: "external_id" });
  if (error) throw new Error(error.message);
  return { imported: rows.length, total: fixtures.length, message: `Imported ${rows.length} World Cup matches.` };
});

export const refreshLiveScores = createServerFn({ method: "POST" })
  .inputValidator(z.object({ live: z.boolean().optional() }).parse)
  .handler(async () => {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error("API_FOOTBALL_KEY not configured");

    const url = `https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&live=all`;
    const res = await fetch(url, { headers: { "x-apisports-key": key } });
    if (!res.ok) throw new Error(`API-Football ${res.status}`);
    const json = (await res.json()) as { response: ApiFixture[] };
    const fixtures = json.response ?? [];

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    for (const f of fixtures) {
      await admin.from("events").update({
        status: statusFromShort(f.fixture.status.short),
        home_score: f.goals.home,
        away_score: f.goals.away,
        minute: f.fixture.status.elapsed,
      }).eq("external_id", `wc-${WC_SEASON}-${f.fixture.id}`);
    }
    return { updated: fixtures.length };
  });
