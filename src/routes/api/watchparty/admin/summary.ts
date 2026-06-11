import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, requireWatchPartyAdmin, WATCH_PARTY_SOURCES, type WatchPartySignupMetadata } from "@/lib/watchparty";

export const Route = createFileRoute("/api/watchparty/admin/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireWatchPartyAdmin(request)) return jsonResponse({ error: "watch-party admin token required" }, { status: 403 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("audit_logs").select("action_type,metadata").in("action_type", ["watchparty_signup", "watchparty_winner_selected"]).limit(5000);
        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        const items = Object.entries(WATCH_PARTY_SOURCES).map(([source_key, source]) => ({ source_key, label: source.label, signups: 0, winners: 0 }));
        const byKey = new Map(items.map((item) => [item.source_key, item]));
        for (const row of data || []) {
          const md = (row.metadata || {}) as WatchPartySignupMetadata;
          const key = String(md.source_key || "main");
          const item = byKey.get(key) || byKey.get("main")!;
          if (row.action_type === "watchparty_signup") item.signups += 1;
          if (row.action_type === "watchparty_winner_selected") item.winners += 1;
        }
        return jsonResponse({ items });
      },
    },
  },
});
