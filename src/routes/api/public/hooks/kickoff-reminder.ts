import { createFileRoute } from "@tanstack/react-router";
import { broadcast } from "@/lib/push.server";
import { fetchSafaUpcomingFixtures, verifyKickoff } from "@/lib/safa.server";

/**
 * Cron: every 5 minutes. Notifies subscribers 15 minutes before kickoff.
 * Dedup by `kickoff:<fixture_id>` so we never send twice for the same match.
 */
export const Route = createFileRoute("/api/public/hooks/kickoff-reminder")({
  server: {
    handlers: {
      POST: async () => run(),
      GET: async () => run(),
    },
  },
});

async function run() {
  try {
    const fixtures = await fetchSafaUpcomingFixtures();
    const now = Date.now();
    const events: string[] = [];
    for (const raw of fixtures) {
      const f = verifyKickoff(raw);
      const ko = new Date(f.kickoff).getTime();
      const minsToKo = (ko - now) / 60000;
      // Fire when between 13 and 17 minutes before kickoff (one cron tick = 5 min)
      if (minsToKo >= 13 && minsToKo <= 17) {
        const opp = f.opponent || "opponent";
        const koTime = new Date(f.kickoff).toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Johannesburg",
        });
        await broadcast(
          "kickoff",
          {
            title: `🇿🇦 Bafana kick off in 15 min`,
            body: `vs ${opp} · ${koTime} SAST · ${f.competition ?? ""}`.trim(),
            url: `/fixtures/${f.id}`,
            tag: `kickoff-${f.id}`,
          },
          `kickoff:${f.id}`,
        );
        events.push(`kickoff-${f.id}`);
      }
    }
    return new Response(JSON.stringify({ checked: fixtures.length, events }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[kickoff-reminder]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
