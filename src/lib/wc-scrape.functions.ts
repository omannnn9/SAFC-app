// Scrape FIFA World Cup 2026 fixtures via Firecrawl (JSON extract) and upsert
// into public.events. Free fallback to API-Football for users without a paid plan.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIFA_URL =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

const EXTRACTION_PROMPT = `Extract every FIFA World Cup 2026 match listed on this page.
For each match return: home team name, away team name, kickoff in ISO 8601 UTC,
venue, city, country, stage (group/r32/r16/qf/sf/third/final), group letter if group stage,
status (scheduled/live/finished), home score, away score, current minute if live,
home flag image URL, away flag image URL. Include placeholder/TBD matches.`;

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          home_team: { type: "string" },
          away_team: { type: "string" },
          kickoff: { type: "string", description: "ISO 8601 UTC kickoff" },
          venue: { type: "string" },
          city: { type: "string" },
          country: { type: "string" },
          stage: { type: "string", enum: ["group", "r32", "r16", "qf", "sf", "third", "final", "other"] },
          group: { type: "string" },
          status: { type: "string", enum: ["scheduled", "live", "finished"] },
          home_score: { type: ["number", "null"] },
          away_score: { type: ["number", "null"] },
          minute: { type: ["number", "null"] },
          home_team_flag: { type: ["string", "null"] },
          away_team_flag: { type: ["string", "null"] },
        },
        required: ["home_team", "away_team", "kickoff", "stage", "status"],
      },
    },
  },
  required: ["matches"],
};

type ScrapedMatch = {
  home_team: string;
  away_team: string;
  kickoff: string;
  venue?: string;
  city?: string;
  country?: string;
  stage?: string;
  group?: string;
  status?: "scheduled" | "live" | "finished";
  home_score?: number | null;
  away_score?: number | null;
  minute?: number | null;
  home_team_flag?: string | null;
  away_team_flag?: string | null;
};

async function assertAdmin(
  supabase: { from: (t: string) => { select: (s: string) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } } },
  userId: string,
) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

function stableExternalId(m: ScrapedMatch): string {
  // Stable across re-scrapes: stage + kickoff + teams
  const ko = new Date(m.kickoff).toISOString().slice(0, 16);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `wc-2026-fifa-${m.stage ?? "other"}-${ko}-${slug(m.home_team)}-vs-${slug(m.away_team)}`;
}

export async function scrapeAndUpsertWorldCup() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const { default: Firecrawl } = await import("@mendable/firecrawl-js");
  const firecrawl = new Firecrawl({ apiKey });

  const result = await firecrawl.scrape(FIFA_URL, {
    formats: [{ type: "json", schema: MATCH_SCHEMA, prompt: EXTRACTION_PROMPT }],
    onlyMainContent: true,
    waitFor: 4000,
  });

  // SDK v2 returns `json` on the result or under `data.json`
  type Raw = { json?: { matches?: ScrapedMatch[] }; data?: { json?: { matches?: ScrapedMatch[] } } };
  const raw = result as Raw;
  const matches: ScrapedMatch[] = raw.json?.matches ?? raw.data?.json?.matches ?? [];

  if (!matches.length) {
    return { scraped: 0, upserted: 0, message: "Firecrawl returned no matches — FIFA page may have changed." };
  }

  const rows = matches
    .filter((m) => m.home_team && m.away_team && m.kickoff)
    .map((m) => ({
      external_id: stableExternalId(m),
      title: `${m.home_team} vs ${m.away_team}`,
      description: `FIFA World Cup 2026 — ${m.stage ?? "other"}${m.group ? ` Group ${m.group}` : ""}`,
      event_type: "wc_match" as const,
      stage: (m.stage ?? "other") as never,
      competition: "FIFA World Cup 2026",
      home_team: m.home_team,
      away_team: m.away_team,
      home_team_flag: m.home_team_flag ?? null,
      away_team_flag: m.away_team_flag ?? null,
      kickoff: new Date(m.kickoff).toISOString(),
      venue: m.venue ?? null,
      city: m.city ?? null,
      country: m.country ?? null,
      status: m.status ?? "scheduled",
      home_score: m.home_score ?? null,
      away_score: m.away_score ?? null,
      minute: m.minute ?? null,
    }));

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await admin.from("events").upsert(rows, { onConflict: "external_id" });
  if (error) throw new Error(error.message);

  return { scraped: matches.length, upserted: rows.length, message: `Scraped ${matches.length} matches from FIFA, upserted ${rows.length}.` };
}

export const scrapeWorldCupFromFifa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    return scrapeAndUpsertWorldCup();
  });
