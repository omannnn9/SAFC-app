import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AttendanceSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["going", "interested", "maybe", "not_going"]).nullable(),
});

export const updateEventRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AttendanceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { supabase } = context;

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, city, country, created_by")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventError || !event) throw new Error("Event not found");

    const { data: current } = await supabase
      .from("event_attendees")
      .select("status")
      .eq("event_id", data.eventId)
      .eq("user_id", uid)
      .maybeSingle();

    if (data.status === null) {
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", data.eventId)
        .eq("user_id", uid);
      if (error) throw new Error(error.message);
      return { status: null, chatId: null };
    }

    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", uid).maybeSingle();
    const plan = (profile as { plan?: string } | null)?.plan ?? "bronze";
    const wasCounted = current?.status === "going" || current?.status === "interested";
    if (plan === "bronze" && !wasCounted && (data.status === "going" || data.status === "interested")) {
      const { data: count } = await supabase.rpc("monthly_event_joins", { _user: uid });
      if ((typeof count === "number" ? count : 0) >= 5) {
        throw new Error("Bronze members can join up to 5 events per month. Upgrade to Silver for unlimited access.");
      }
    }

    const { error: upsertError } = await supabase
      .from("event_attendees")
      .upsert({ event_id: data.eventId, user_id: uid, status: data.status }, { onConflict: "event_id,user_id" });
    if (upsertError) throw new Error(upsertError.message);

    await supabase
      .from("user_achievements")
      .insert({ user_id: uid, achievement_id: "first_event" })
      .then(() => {}, () => {});

    if (data.status !== "going" && data.status !== "interested") {
      return { status: data.status, chatId: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ownerId = (event.created_by as string | null) ?? uid;

    const { data: existingGroup } = await supabaseAdmin
      .from("groups")
      .select("id")
      .eq("event_id", data.eventId)
      .eq("type", "community")
      .maybeSingle();
    let groupId = (existingGroup as { id?: string } | null)?.id;
    if (!groupId) {
      const { data: createdGroup } = await supabaseAdmin
        .from("groups")
        .insert({
          event_id: data.eventId,
          type: "community",
          name: event.title,
          description: `Official supporter community for ${event.title}.`,
          city: event.city,
          country: event.country,
          is_private: false,
          min_plan: "bronze",
          owner_id: ownerId,
        })
        .select("id")
        .single();
      groupId = (createdGroup as { id?: string } | null)?.id;
    }
    if (groupId) {
      await supabaseAdmin.from("group_members").upsert(
        [
          { group_id: groupId, user_id: ownerId, role: "owner" },
          { group_id: groupId, user_id: uid, role: "member" },
        ],
        { onConflict: "group_id,user_id" },
      );
    }

    const { data: existingChat } = await supabaseAdmin
      .from("event_chats")
      .select("id")
      .eq("event_id", data.eventId)
      .maybeSingle();
    let chatId = (existingChat as { id?: string } | null)?.id;
    if (!chatId) {
      const { data: createdChat, error: chatError } = await supabaseAdmin
        .from("event_chats")
        .insert({ event_id: data.eventId, created_by: ownerId })
        .select("id")
        .single();
      if (chatError) throw new Error(chatError.message);
      chatId = (createdChat as { id: string }).id;
    }
    await supabaseAdmin
      .from("event_chat_members")
      .upsert({ chat_id: chatId, user_id: uid }, { onConflict: "chat_id,user_id" });

    return { status: data.status, chatId };
  });