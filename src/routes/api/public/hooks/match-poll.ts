import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { broadcast } from "@/lib/push.server";
import {
  fetchSafaUpcomingFixtures,
  verifyKickoff,
} from "@/lib/safa.server";

/**
 * Cron: every 30s. Polls API-Football for current Bafana match state and fires
 * goal / full-time notifications when state changes. Cheap: only hits API
 * when a Bafana fixture should be live (kickoff <= now <= kickoff + 3h).
 */
export const Route = createFileRoute("/api/public/hooks/match-poll")({
  server: {
    handlers: {
      POST: async () => {
        const result = await runMatchPoll();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        const result = await runMatchPoll();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

const SA_TEAM_ID = 1531;

type ApiFixture = {
  fixture: { id: number; status: { short: string; long: string }; date: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
  league: { name: string };
};

async function isMatchLikelyLive(): Promise<boolean> {
  try {
    const fixtures = await fetchSafaUpcomingFixtures();
    const now = Date.now();
    return fixtures.some((f) => {
      const verified = verifyKickoff(f);
      const ko = new Date(verified.kickoff).getTime();
      return now >= ko - 5 * 60 * 1000 && now <= ko + 3 * 60 * 60 * 1000;
    });
  } catch {
    return false;
  }
}

async function runMatchPoll() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return { skipped: "no-api-key" };

  const live = await isMatchLikelyLive();
  if (!live) return { skipped: "no-live-window" };

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?team=${SA_TEAM_ID}&live=all`,
    { headers: { "x-apisports-key": apiKey } },
  );
  if (!res.ok) return { error: `api-football ${res.status}` };
  const json = (await res.json()) as { response: ApiFixture[] };
  const fixtures = json.response ?? [];

  const events: string[] = [];
  for (const f of fixtures) {
    const fid = String(f.fixture.id);
    const homeIsSA = f.teams.home.id === SA_TEAM_ID;
    const opponent = homeIsSA ? f.teams.away.name : f.teams.home.name;
    const homeScore = f.goals.home ?? 0;
    const awayScore = f.goals.away ?? 0;
    const status = f.fixture.status.short; // 1H, HT, 2H, ET, FT, AET, PEN

    const { data: prev } = await supabaseAdmin
      .from("match_state")
      .select("home_score, away_score, status")
      .eq("fixture_id", fid)
      .maybeSingle();

    const totalNow = homeScore + awayScore;
    const totalPrev = (prev?.home_score ?? 0) + (prev?.away_score ?? 0);

    // Goal detected
    if (prev && totalNow > totalPrev) {
      const saScored = homeIsSA ? homeScore > (prev.home_score ?? 0) : awayScore > (prev.away_score ?? 0);
      const title = saScored ? "⚽ GOAL! Bafana scores" : `⚽ Goal — ${opponent}`;
      const score = homeIsSA ? `South Africa ${homeScore}–${awayScore} ${opponent}` : `${opponent} ${homeScore}–${awayScore} South Africa`;
      await broadcast("goal", { title, body: score, url: `/fixtures/${fid}`, tag: `goal-${fid}-${totalNow}` }, `goal:${fid}:${totalNow}`);
      events.push(`goal-${fid}-${totalNow}`);
    }

    // Full-time detected
    const ftStatuses = ["FT", "AET", "PEN"];
    if (ftStatuses.includes(status) && (!prev || !ftStatuses.includes(prev.status))) {
      const score = homeIsSA ? `South Africa ${homeScore}–${awayScore} ${opponent}` : `${opponent} ${homeScore}–${awayScore} South Africa`;
      await broadcast("fulltime", { title: "Full-time", body: score, url: `/fixtures/${fid}`, tag: `ft-${fid}` }, `ft:${fid}`);
      events.push(`ft-${fid}`);
    }

    await supabaseAdmin.from("match_state").upsert({
      fixture_id: fid,
      status,
      home_score: homeScore,
      away_score: awayScore,
      opponent,
      updated_at: new Date().toISOString(),
    });
  }

  return { polled: fixtures.length, events };
}
