import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminSupabase } from "@/lib/server-auth";

const RowSchema = z.object({
  home_team: z.string().min(1).max(120),
  away_team: z.string().min(1).max(120),
  home_flag: z.string().max(40).nullable().optional(),
  away_flag: z.string().max(40).nullable().optional(),
  kickoff_utc: z.string().min(1), // ISO UTC
  venue: z.string().max(200).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  stage: z.enum(["group", "r32", "r16", "qf", "sf", "third", "final", "other"]),
  group_note: z.string().max(120).nullable().optional(),
  external_id: z.string().min(3).max(200),
});

/**
 * Import World Cup matches into `world_cup_matches`. A BEFORE INSERT/UPDATE
 * trigger (`sync_wc_match_to_event`) mirrors each row into `events` with
 * `event_type='wc_match'` and links `world_cup_matches.event_id`. This is
 * how the public /worldcup page (which reads world_cup_matches) and event
 * detail / RSVP pages (which read events) stay in sync.
 */
export const adminImportWorldCupRows = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ rows: z.array(RowSchema).min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();

    // Pull existing matches so we can match incoming rows to current records
    // and only allocate new match_numbers for genuinely new fixtures.
    const { data: existingRaw, error: exErr } = await supabase
      .from("world_cup_matches")
      .select("match_number, home_team, away_team, kickoff_datetime_utc");
    if (exErr) throw new Error(exErr.message);
    const existing = (existingRaw ?? []) as Array<{
      match_number: number;
      home_team: string;
      away_team: string;
      kickoff_datetime_utc: string;
    }>;
    const usedNumbers = new Set<number>(existing.map((m) => m.match_number));
    const byKey = new Map<string, number>();
    for (const m of existing) {
      const k = `${m.home_team}|${m.away_team}|${new Date(m.kickoff_datetime_utc).toISOString()}`;
      byKey.set(k, m.match_number);
    }

    // Sort incoming rows by kickoff so any newly assigned match_numbers stay
    // chronological. Then resolve each row's match_number — reuse the
    // existing number if we already track this fixture, otherwise grab the
    // next free slot in [1, 104].
    const sorted = [...data.rows].sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
    let cursor = 1;
    const nextFreeNumber = (): number => {
      while (cursor <= 104 && usedNumbers.has(cursor)) cursor += 1;
      if (cursor > 104) throw new Error("World Cup match limit reached (104). Delete existing matches to import more.");
      const n = cursor;
      usedNumbers.add(n);
      cursor += 1;
      return n;
    };

    const payload = sorted.map((r) => {
      const iso = new Date(r.kickoff_utc).toISOString();
      const key = `${r.home_team}|${r.away_team}|${iso}`;
      const match_number = byKey.get(key) ?? nextFreeNumber();
      return {
        match_number,
        home_team: r.home_team,
        away_team: r.away_team,
        home_flag: r.home_flag || "🏳️",
        away_flag: r.away_flag || "🏳️",
        kickoff: iso,
        kickoff_datetime_utc: iso,
        venue: r.venue || null,
        city: r.city || null,
        stage: r.stage === "other" ? "group" : r.stage,
        group_name: r.group_note || null,
        status: "upcoming" as const,
      };
    });

    const { data: result, error } = await supabase
      .from("world_cup_matches")
      .upsert(payload, { onConflict: "match_number" })
      .select("id, match_number");

    if (error) throw new Error(error.message);
    return { ok: true, count: result?.length ?? 0 };
  });
