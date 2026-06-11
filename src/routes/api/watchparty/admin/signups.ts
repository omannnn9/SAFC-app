import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, requireWatchPartyAdmin, safeSourceKey, WATCH_PARTY_SOURCES, type WatchPartySignupMetadata } from "@/lib/watchparty";

export const Route = createFileRoute("/api/watchparty/admin/signups")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireWatchPartyAdmin(request)) return jsonResponse({ error: "watch-party admin token required" }, { status: 403 });
        const url = new URL(request.url);
        const source_key = safeSourceKey(url.searchParams.get("source"));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("audit_logs").select("id,created_at,metadata").eq("action_type", "watchparty_signup").order("created_at", { ascending: false }).limit(1000);
        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        const items = (data || [])
          .map((row) => ({ id: row.id, created_at: row.created_at, ...((row.metadata || {}) as WatchPartySignupMetadata) }))
          .filter((item) => (item.source_key || "main") === source_key);
        return jsonResponse({ source_key, label: WATCH_PARTY_SOURCES[source_key].label, items });
      },
    },
  },
});
