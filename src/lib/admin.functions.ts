import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminSupabase, requireAdminUserId } from "@/lib/server-auth";

const EventPayloadSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).nullable(),
  event_type: z.enum(["wc_match", "match", "tournament", "fan_zone", "meetup", "festival", "travel"]),
  stage: z.enum(["group", "r32", "r16", "qf", "sf", "third", "final", "friendly", "other"]).nullable(),
  competition: z.string().max(160).nullable(),
  home_team: z.string().max(120).nullable(),
  away_team: z.string().max(120).nullable(),
  home_team_flag: z.string().max(40).nullable(),
  away_team_flag: z.string().max(40).nullable(),
  kickoff: z.string().datetime(),
  venue: z.string().max(200).nullable(),
  city: z.string().max(120).nullable(),
  country: z.string().max(120).nullable(),
  cover_url: z.string().max(1000).nullable(),
  status: z.enum(["scheduled", "live", "finished"]),
  home_score: z.number().int().nullable(),
  away_score: z.number().int().nullable(),
  minute: z.number().int().nullable(),
  is_featured: z.boolean(),
  created_by: z.string().uuid().nullable().optional(),
});

export const adminSaveEvent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid().nullable().optional(),
        event: EventPayloadSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase, userId: adminUserId } = await requireAdminSupabase();
    const payload = {
      ...data.event,
      created_by: data.event.created_by ?? adminUserId,
      updated_at: new Date().toISOString(),
    };
    const request = data.eventId
      ? supabase.from("events").update(payload).eq("id", data.eventId).select("id").single()
      : supabase.from("events").insert(payload).select("id").single();
    const { data: saved, error } = await request;
    if (error) throw new Error(error.message);
    return { ok: true, id: saved?.id as string };
  });

export const adminDeleteEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();

    // Detach / remove linked World Cup match first so the sync trigger doesn't
    // recreate the event. Then delete the event (FKs cascade to attendees,
    // chats, groups, photos).
    await supabase.from("world_cup_matches").delete().eq("event_id", data.eventId);
    const { error } = await supabase.from("events").delete().eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminClearAllEvents = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabase } = await requireAdminSupabase();
    // Wipe WC matches first (their trigger would otherwise re-create events on update),
    // then wipe all events.
    const wc = await supabase.from("world_cup_matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (wc.error) throw new Error(wc.error.message);
    const ev = await supabase.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (ev.error) throw new Error(ev.error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const adminUserId = await requireAdminUserId();
    if (data.userId === adminUserId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();
    const { error } = await supabase.from("posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ reportId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();
    const { error } = await supabase.from("reports").update({ status: "resolved" }).eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        planId: z.enum(["bronze", "silver", "gold"]),
        name: z.string().min(1).max(80),
        tagline: z.string().max(180).nullable(),
        price_cents: z.number().int().min(0),
        perks: z.array(z.string().min(1).max(180)).max(30),
        visible: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireAdminSupabase();
    const { error } = await supabase
      .from("plans")
      .update({
        name: data.name,
        tagline: data.tagline,
        price_cents: data.price_cents,
        perks: data.perks,
        visible: data.visible,
      })
      .eq("id", data.planId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
