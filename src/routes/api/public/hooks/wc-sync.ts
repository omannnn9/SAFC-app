// Cron-driven World Cup live sync. Scheduled via pg_cron every 5 minutes.
// Auth: requires the Supabase anon key in `apikey` header (set by pg_cron).
// Never inserts or deletes match rows.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/wc-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const provided = request.headers.get("apikey") || request.headers.get("x-api-key");
  if (expected && provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const { runWorldCupSyncInternal } = await import("@/lib/wc-sync.functions");
    const result = await runWorldCupSyncInternal();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
