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

export const adminImportWorldCupRows = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ rows: z.array(RowSchema).min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { supabase, userId: adminUserId } = await requireAdminSupabase();

    const payload = data.rows.map((r) => ({
      title: `${r.home_team} vs ${r.away_team}`,
      event_type: "wc_match" as const,
      stage: r.stage,
      competition: "FIFA World Cup 2026",
      home_team: r.home_team,
      away_team: r.away_team,
      home_team_flag: r.home_flag || null,
      away_team_flag: r.away_flag || null,
      kickoff: r.kickoff_utc,
      venue: r.venue || null,
      city: r.city || null,
      country: r.country || null,
      status: "scheduled" as const,
      external_id: r.external_id,
      description: r.group_note || null,
      created_by: adminUserId,
    }));

    const { data: result, error } = await supabase
      .from("events")
      .upsert(payload, { onConflict: "external_id" })
      .select("id, external_id");

    if (error) throw new Error(error.message);
    return { ok: true, count: result?.length ?? 0 };
  });
