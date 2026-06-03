import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Find-or-create the official community group for an event and add the
 * authenticated user as a member. Called after a user RSVPs going/interested.
 *
 * - Group is owned by the event's `created_by` when present, otherwise by the
 *   first joiner. Service-role bypasses RLS so we can seed it safely.
 * - Membership insert is idempotent (ignored on conflict).
 */
export const joinEventCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const eventId = data.eventId;

    // 1. Look up the event (needed for title + owner fallback)
    const { data: evt, error: evtErr } = await supabaseAdmin
      .from("events")
      .select("id, title, city, country, created_by")
      .eq("id", eventId)
      .maybeSingle();
    if (evtErr || !evt) throw new Error("Event not found");

    // 2. Find existing community group for this event
    const { data: existing } = await supabaseAdmin
      .from("groups")
      .select("id")
      .eq("event_id", eventId)
      .eq("type", "community")
      .maybeSingle();

    let groupId = existing?.id as string | undefined;

    if (!groupId) {
      const ownerId = (evt.created_by as string | null) ?? uid;
      const { data: created, error: cErr } = await supabaseAdmin
        .from("groups")
        .insert({
          event_id: eventId,
          type: "community",
          name: evt.title,
          description: `Official supporter community for ${evt.title}. Auto-created when fans started RSVPing.`,
          city: evt.city,
          country: evt.country,
          is_private: false,
          min_plan: "bronze",
          owner_id: ownerId,
        })
        .select("id")
        .single();
      if (cErr || !created) throw new Error(cErr?.message ?? "Could not create community");
      groupId = created.id as string;

      // Ensure the owner is a member with owner role
      await supabaseAdmin
        .from("group_members")
        .insert({ group_id: groupId, user_id: ownerId, role: "owner" })
        .then(() => {}, () => {});
    }

    // 3. Add the joining user as a member (idempotent)
    await supabaseAdmin
      .from("group_members")
      .insert({ group_id: groupId, user_id: uid, role: "member" })
      .then(() => {}, () => {});

    return { groupId };
  });
