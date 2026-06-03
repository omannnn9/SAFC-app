import { createFileRoute } from "@tanstack/react-router";
import { scrapeAndUpsertWorldCup } from "@/lib/wc-scrape.functions";

// Public cron endpoint: pg_cron hits this every 5 minutes to refresh WC fixtures
// & scores from fifa.com via Firecrawl. No auth required — safe because it only
// writes to events via service role and reads a public page.
export const Route = createFileRoute("/api/public/hooks/wc-scrape")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler() {
  try {
    const res = await scrapeAndUpsertWorldCup();
    return new Response(JSON.stringify({ ok: true, ...res }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
