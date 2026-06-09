// Production sync endpoint, invoked by Vercel Cron every 5 minutes.
// Vercel registers this route via vercel.json. The handler:
//   * pulls all WC matches from Football-Data in ONE bulk request (cached 60s)
//   * updates ONLY scores, status, and last_synced_at on world_cup_matches
//   * respects admin overrides (status_override is never touched)
//   * never inserts, deletes, or modifies RSVPs / chats / posts / user data
//
// Security:
//   * Optional CRON_SECRET env var. If set, callers must send
//     `Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this automatically
//     when CRON_SECRET is configured in the project).
//   * If unset, we accept the request as Vercel Cron will only invoke this URL
//     from its own infrastructure on production deployments.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/wc-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return json({ error: "Unauthorized" }, 401);
    }
  }
  try {
    const { runWorldCupSyncInternal } = await import("@/lib/wc-sync.functions");
    const result = await runWorldCupSyncInternal();
    return json(result);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
