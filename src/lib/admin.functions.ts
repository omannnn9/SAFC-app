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

export const adminListUsersDetailed = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminUserId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (pErr) throw new Error(pErr.message);

  const ids = (profiles ?? []).map((p) => p.id as string);

  // Auth users (email, last sign-in, providers) — page through admin API
  const authMap = new Map<string, { email: string | null; last_sign_in_at: string | null; provider: string | null; confirmed_at: string | null }>();
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data.users) {
      authMap.set(u.id, {
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        provider: u.app_metadata?.provider ?? null,
        confirmed_at: u.confirmed_at ?? u.email_confirmed_at ?? null,
      });
    }
    if (data.users.length < 200) break;
    page++;
    if (page > 50) break;
  }

  // Roles
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const rolesMap = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const arr = rolesMap.get(r.user_id as string) ?? [];
    arr.push(r.role as string);
    rolesMap.set(r.user_id as string, arr);
  }

  // Counts via individual head queries are expensive; do groupings
  const countBy = async (table: "posts" | "event_attendees" | "follows", col: "user_id" | "following_id" | "follower_id") => {
    const { data } = await supabaseAdmin.from(table).select(col);
    const m = new Map<string, number>();
    for (const row of (data ?? []) as unknown as Record<string, string>[]) {
      const k = row[col];
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const [postsM, attendM, followersM, followingM] = await Promise.all([
    countBy("posts", "user_id"),
    countBy("event_attendees", "user_id"),
    countBy("follows", "following_id"),
    countBy("follows", "follower_id"),
  ]);

  return (profiles ?? []).map((p) => {
    const a = authMap.get(p.id as string);
    return {
      ...p,
      email: a?.email ?? null,
      last_sign_in_at: a?.last_sign_in_at ?? null,
      auth_provider: a?.provider ?? null,
      confirmed_at: a?.confirmed_at ?? null,
      roles: rolesMap.get(p.id as string) ?? [],
      posts_count: postsM.get(p.id as string) ?? 0,
      rsvps_count: attendM.get(p.id as string) ?? 0,
      followers_count: followersM.get(p.id as string) ?? 0,
      following_count: followingM.get(p.id as string) ?? 0,
    };
  });
});

export const adminExportUsersCsv = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminUserId();
  // Reuse the detailed list to keep one source of truth
  const rows = await (adminListUsersDetailed as unknown as () => Promise<any[]>)();
  const headers = [
    "id","email","full_name","username","phone","country","city","favourite_team",
    "plan","is_premium","premium_until","is_private","is_deleted","deleted_at",
    "roles","auth_provider","confirmed_at","last_sign_in_at","last_seen","created_at",
    "posts_count","rsvps_count","followers_count","following_count","bio","interests",
  ];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join("|") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc((r as Record<string, unknown>)[h])).join(","));
  return { csv: lines.join("\n"), count: rows.length };
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
