import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function getBearerToken() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const authHeader = getRequest()?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized: please sign in again");
  return authHeader.replace("Bearer ", "").trim();
}

async function requireAdminUserId() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(await getBearerToken());
  const userId = userData.user?.id;
  if (userError || !userId) throw new Error("Unauthorized: please sign in again");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
  return userId;
}

export const adminDeleteEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Detach / remove linked World Cup match first so the sync trigger doesn't
    // recreate the event. Then delete the event (FKs cascade to attendees,
    // chats, groups, photos).
    await supabaseAdmin.from("world_cup_matches").delete().eq("event_id", data.eventId);
    const { error } = await supabaseAdmin.from("events").delete().eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminClearAllEvents = createServerFn({ method: "POST" })
  .handler(async () => {
    await requireAdminUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Wipe WC matches first (their trigger would otherwise re-create events on update),
    // then wipe all events.
    const wc = await supabaseAdmin.from("world_cup_matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (wc.error) throw new Error(wc.error.message);
    const ev = await supabaseAdmin.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
