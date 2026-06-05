import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthenticatedSupabase } from "@/lib/server-auth";

/**
 * Find-or-create the event chat for an event and add the authenticated user
 * as a member. Returns the chat id so the client can navigate straight to it.
 *
 * Membership is server-only; the only path in is via this function (which
 * verifies the user has an RSVP of going / interested for the event).
 */
export const joinEventChat = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId: uid } = await requireAuthenticatedSupabase();
    const eventId = data.eventId;

    // Verify event exists
    const { data: evt, error: evtErr } = await supabaseAdmin
      .from("events")
      .select("id, created_by")
      .eq("id", eventId)
      .maybeSingle();
    if (evtErr || !evt) throw new Error("Event not found");

    // Verify RSVP exists and is going/interested
    const { data: rsvp } = await supabaseAdmin
      .from("event_attendees")
      .select("status")
      .eq("event_id", eventId)
      .eq("user_id", uid)
      .maybeSingle();
    const status = (rsvp as { status?: string } | null)?.status;
    if (status !== "going" && status !== "interested") {
      throw new Error("RSVP required to join event chat");
    }

    // Find or create chat
    const { data: existing } = await supabaseAdmin
      .from("event_chats")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    let chatId = (existing as { id?: string } | null)?.id;
    if (!chatId) {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("event_chats")
        .insert({ event_id: eventId, created_by: (evt as { created_by: string | null }).created_by ?? uid })
        .select("id")
        .single();
      if (cErr || !created) throw new Error(cErr?.message ?? "Could not create chat");
      chatId = (created as { id: string }).id;
    }

    // Add as member (idempotent)
    await supabaseAdmin
      .from("event_chat_members")
      .insert({ chat_id: chatId, user_id: uid })
      .then(() => {}, () => {});

    return { chatId };
  });
