// World Cup live-sync server functions. Pulls Football-Data.org and updates
// scores/status/placeholder-team-resolution on world_cup_matches. NEVER
// inserts or deletes match rows — the database remains the source of truth
// for fixtures, venues, RSVPs, chats, photos.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminSupabase } from "@/lib/server-auth";

type SyncResult = {
  ok: true;
  scanned: number;
  mapped: number;
  scoreUpdates: number;
  statusUpdates: number;
  placeholderResolutions: number;
  teamsUpserted: number;
  errors: string[];
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A "placeholder" team is a TBD slot like "Winner SF1", "Group A Runner-Up",
// "TBD", etc. — anything we should let the API replace once known.
function isPlaceholderTeam(name: string | null | undefined): boolean {
  if (!name) return true;
  const n = name.toLowerCase();
  return (
    n.includes("tbd") ||
    n.includes("winner") ||
    n.includes("runner") ||
    n.includes("group ") ||
    n.startsWith("w") && /^w\d/.test(n) ||
    n.startsWith("l") && /^l\d/.test(n) ||
    /^\w{1,3}\d+$/.test(n)
  );
}

async function runSync(): Promise<SyncResult> {
  const { fetchWorldCupMatches, mapFdStatus } = await import("@/lib/football-data.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const result: SyncResult = {
    ok: true,
    scanned: 0,
    mapped: 0,
    scoreUpdates: 0,
    statusUpdates: 0,
    placeholderResolutions: 0,
    teamsUpserted: 0,
    errors: [],
  };

  const fdMatches = await fetchWorldCupMatches({ forceRefresh: true });
  result.scanned = fdMatches.length;

  // 1) Upsert team map for every team we encounter.
  const teamMap = new Map<number, { id: number; name: string; shortName: string | null; tla: string | null; crest: string | null }>();
  for (const m of fdMatches) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (t?.id && !teamMap.has(t.id)) teamMap.set(t.id, t);
    }
  }

  // Fetch country -> flag mapping so we can stamp emoji flags on resolved teams.
  const { data: flagRows } = await supabaseAdmin
    .from("world_cup_country_flags")
    .select("country_name, flag");
  const flagByCountry = new Map<string, string>();
  for (const r of flagRows ?? []) flagByCountry.set(normalize(r.country_name), r.flag);

  if (teamMap.size > 0) {
    const teamRows = Array.from(teamMap.values()).map((t) => ({
      team_id: t.id,
      country_name: t.name,
      short_name: t.shortName,
      tla: t.tla,
      flag: flagByCountry.get(normalize(t.name)) ?? null,
      crest_url: t.crest,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("football_data_team_map")
      .upsert(teamRows, { onConflict: "team_id" });
    if (error) result.errors.push(`team_map upsert: ${error.message}`);
    else result.teamsUpserted = teamRows.length;
  }

  // 2) Load all mapped WC matches.
  const { data: wcRows, error: wcErr } = await supabaseAdmin
    .from("world_cup_matches")
    .select(
      "id, match_number, home_team, away_team, home_flag, away_flag, home_score, away_score, status, status_override, football_data_match_id, football_data_home_team_id, football_data_away_team_id",
    );
  if (wcErr) {
    result.errors.push(`load wc_matches: ${wcErr.message}`);
    return result;
  }

  const fdById = new Map<number, (typeof fdMatches)[number]>();
  for (const m of fdMatches) fdById.set(m.id, m);

  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

  for (const row of wcRows ?? []) {
    if (!row.football_data_match_id) continue;
    result.mapped += 1;
    const fd = fdById.get(Number(row.football_data_match_id));
    if (!fd) continue;

    const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString() };

    // Score updates
    const newHome = fd.score.fullTime.home ?? null;
    const newAway = fd.score.fullTime.away ?? null;
    if (newHome !== row.home_score || newAway !== row.away_score) {
      patch.home_score = newHome;
      patch.away_score = newAway;
      result.scoreUpdates += 1;
    }

    // Status (skipped if admin set status_override)
    const newStatus = mapFdStatus(fd.status);
    if (!row.status_override && newStatus !== row.status) {
      patch.status = newStatus;
      result.statusUpdates += 1;
    }

    // Placeholder resolution — replace TBD/Winner-X slots with real team
    if (isPlaceholderTeam(row.home_team) && fd.homeTeam?.name && !isPlaceholderTeam(fd.homeTeam.name)) {
      patch.home_team = fd.homeTeam.name;
      patch.home_flag = flagByCountry.get(normalize(fd.homeTeam.name)) ?? row.home_flag ?? "🏳️";
      patch.football_data_home_team_id = fd.homeTeam.id;
      result.placeholderResolutions += 1;
    } else if (!row.football_data_home_team_id && fd.homeTeam?.id) {
      patch.football_data_home_team_id = fd.homeTeam.id;
    }
    if (isPlaceholderTeam(row.away_team) && fd.awayTeam?.name && !isPlaceholderTeam(fd.awayTeam.name)) {
      patch.away_team = fd.awayTeam.name;
      patch.away_flag = flagByCountry.get(normalize(fd.awayTeam.name)) ?? row.away_flag ?? "🏳️";
      patch.football_data_away_team_id = fd.awayTeam.id;
      result.placeholderResolutions += 1;
    } else if (!row.football_data_away_team_id && fd.awayTeam?.id) {
      patch.football_data_away_team_id = fd.awayTeam.id;
    }

    updates.push({ id: row.id, patch });
  }

  // Apply updates serially so each fires the events-sync trigger correctly.
  for (const u of updates) {
    const { error } = await supabaseAdmin.from("world_cup_matches").update(u.patch).eq("id", u.id);
    if (error) result.errors.push(`update ${u.id}: ${error.message}`);
  }

  return result;
}

/** Admin-triggered sync (button in admin panel). */
export const adminSyncWorldCupNow = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminSupabase();
  return runSync();
});

/** Internal entry used by the public cron route. */
export async function runWorldCupSyncInternal() {
  return runSync();
}

/**
 * Auto-map DB matches to Football-Data matches using kickoff date + team name
 * similarity. Only fills in football_data_match_id where it's currently NULL,
 * so admins can override mappings manually without being clobbered.
 */
export const adminAutoMapWorldCupMatches = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ remap: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdminSupabase();
    const { fetchWorldCupMatches } = await import("@/lib/football-data.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fd = await fetchWorldCupMatches({ forceRefresh: true });
    const { data: wc, error } = await supabaseAdmin
      .from("world_cup_matches")
      .select("id, match_number, home_team, away_team, kickoff_datetime_utc, football_data_match_id");
    if (error) throw new Error(error.message);

    let mapped = 0;
    let skipped = 0;

    for (const row of wc ?? []) {
      if (!data.remap && row.football_data_match_id) {
        skipped += 1;
        continue;
      }
      const wcKickoff = new Date(row.kickoff_datetime_utc).getTime();
      const home = normalize(row.home_team);
      const away = normalize(row.away_team);

      let best: { id: number; score: number } | null = null;
      for (const fm of fd) {
        const fdKickoff = new Date(fm.utcDate).getTime();
        const hoursDiff = Math.abs(fdKickoff - wcKickoff) / (1000 * 60 * 60);
        if (hoursDiff > 36) continue;
        const fh = normalize(fm.homeTeam?.name ?? "");
        const fa = normalize(fm.awayTeam?.name ?? "");
        let score = 0;
        if (fh && (fh === home || fh.includes(home) || home.includes(fh))) score += 2;
        if (fa && (fa === away || fa.includes(away) || away.includes(fa))) score += 2;
        if (hoursDiff < 2) score += 1;
        if (score >= 3 && (!best || score > best.score)) best = { id: fm.id, score };
      }

      if (best) {
        const fm = fd.find((m) => m.id === best!.id)!;
        await supabaseAdmin
          .from("world_cup_matches")
          .update({
            football_data_match_id: fm.id,
            football_data_home_team_id: fm.homeTeam?.id ?? null,
            football_data_away_team_id: fm.awayTeam?.id ?? null,
          })
          .eq("id", row.id);
        mapped += 1;
      }
    }

    return { ok: true, mapped, skipped, total: (wc ?? []).length };
  });

/** Manual override: link a specific DB match to a specific Football-Data match id. */
export const adminSetFootballDataMatch = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        wc_match_id: z.string().uuid(),
        football_data_match_id: z.number().int().positive().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminSupabase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { football_data_match_id: data.football_data_match_id };
    if (data.football_data_match_id === null) {
      patch.football_data_home_team_id = null;
      patch.football_data_away_team_id = null;
    }
    const { error } = await supabaseAdmin.from("world_cup_matches").update(patch).eq("id", data.wc_match_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
