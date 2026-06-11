import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, readJson, requireWatchPartyAdmin, safeSourceKey, type WatchPartySignupMetadata } from "@/lib/watchparty";

export const Route = createFileRoute("/api/watchparty/admin/random-winner")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!requireWatchPartyAdmin(request)) return jsonResponse({ error: "watch-party admin token required" }, { status: 403 });
        const body = await readJson(request);
        const source_key = safeSourceKey(body.source_key);
        const prize_label = String(body.prize_label || "Watch-party prize").trim().slice(0, 120);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("audit_logs").select("id,created_at,metadata").eq("action_type", "watchparty_signup").order("created_at", { ascending: true }).limit(5000);
        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        const pool = (data || [])
          .map((row) => ({ id: row.id, created_at: row.created_at, ...((row.metadata || {}) as WatchPartySignupMetadata) }))
          .filter((item) => (item.source_key || "main") === source_key);
        if (!pool.length) return jsonResponse({ error: "No sign-ups for this source yet" }, { status: 404 });
        const winner = pool[Math.floor(Math.random() * pool.length)];
        await supabaseAdmin.from("audit_logs").insert({
          action_type: "watchparty_winner_selected",
          actor_role: "admin",
          target_type: "watchparty",
          target_id: String(winner.supporter_code || winner.id),
          metadata: { source_key, prize_label, winner, selected_at: new Date().toISOString() },
        });
        return jsonResponse({ winner, email_sent: false, email_error: "SMTP notification is not configured in TanStack v1 route" });
      },
    },
  },
});
