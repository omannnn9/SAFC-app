import { createFileRoute } from "@tanstack/react-router";
import {
  jsonResponse,
  safeSourceKey,
  WATCH_PARTY_SOURCES,
  type WatchPartySignupMetadata,
} from "@/lib/watchparty";

type SummaryItem = {
  source_key: string;
  label: string;
  signups: number;
  winners: number;
  legacy_intake_signups: number;
  account_signups: number;
};

function isTestSignup(email: unknown, fullName: unknown) {
  const e = String(email || "").toLowerCase();
  const n = String(fullName || "").toLowerCase();
  return (
    e.includes("example.com") ||
    e.includes("watchparty-test") ||
    e.includes("test+") ||
    n.includes("watchparty test") ||
    n.includes("safc watchparty test")
  );
}

function todayStartSastIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}T00:00:00+02:00`;
}

export const Route = createFileRoute("/api/watchparty/admin/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // This endpoint returns aggregate counts only — no supporter PII.
        // Detailed signup lists and winner actions remain protected by the admin token.
        const url = new URL(request.url);
        const since = url.searchParams.get("since") || todayStartSastIso();
        const includeTests = url.searchParams.get("include_tests") === "1";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const items = Object.entries(WATCH_PARTY_SOURCES).map(([source_key, source]) => ({
          source_key,
          label: source.label,
          signups: 0,
          winners: 0,
          legacy_intake_signups: 0,
          account_signups: 0,
        })) satisfies SummaryItem[];
        const byKey = new Map(items.map((item) => [item.source_key, item]));
        const counted = new Map<string, Set<string>>();
        for (const item of items) counted.set(item.source_key, new Set());
        const addSignup = (
          rawKey: unknown,
          rawEmail: unknown,
          rawName: unknown,
          source: "legacy" | "account",
        ) => {
          if (!includeTests && isTestSignup(rawEmail, rawName)) return;
          const key = safeSourceKey(rawKey);
          const item = byKey.get(key) || byKey.get("main")!;
          const email = String(rawEmail || "")
            .trim()
            .toLowerCase();
          const fallback = `${source}:${String(rawName || "")
            .trim()
            .toLowerCase()}:${Math.random()}`;
          const identity = email || fallback;
          const seen = counted.get(item.source_key)!;
          if (seen.has(identity)) return;
          seen.add(identity);
          item.signups += 1;
          if (source === "legacy") item.legacy_intake_signups += 1;
          if (source === "account") item.account_signups += 1;
        };

        const { data: auditRows, error: auditError } = await supabaseAdmin
          .from("audit_logs")
          .select("action_type,metadata,created_at")
          .in("action_type", ["watchparty_signup", "watchparty_winner_selected"])
          .gte("created_at", since)
          .limit(5000);
        if (auditError) return jsonResponse({ error: auditError.message }, { status: 500 });

        for (const row of auditRows || []) {
          const md = (row.metadata || {}) as WatchPartySignupMetadata;
          const key = String(md.source_key || "main");
          const item = byKey.get(key) || byKey.get("main")!;
          if (row.action_type === "watchparty_signup")
            addSignup(key, md.email, md.full_name, "legacy");
          if (row.action_type === "watchparty_winner_selected") item.winners += 1;
        }

        for (let page = 1; page <= 20; page += 1) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) return jsonResponse({ error: error.message }, { status: 500 });
          const users = data.users || [];
          for (const user of users) {
            if (new Date(user.created_at).getTime() < new Date(since).getTime()) continue;
            const md = user.user_metadata || {};
            const source = md.watchparty_source || md.source;
            if (!source) continue;
            addSignup(source, user.email, md.full_name, "account");
          }
          if (users.length < 1000) break;
        }

        return jsonResponse({ since, include_tests: includeTests, items });
      },
    },
  },
});
