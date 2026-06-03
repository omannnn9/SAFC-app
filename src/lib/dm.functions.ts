import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DmPermission = {
  allowed: boolean;
  reason: string;
  requiredPlan?: "silver" | "gold";
};

/**
 * Tier-based DM rule:
 *  - Sender is Gold      → always allowed (premium networking)
 *  - Recipient is Gold   → always allowed (Gold accepts all)
 *  - Sender is Silver    → mutual follow OR co-attendee of any event
 *  - Sender is Bronze    → mutual follow only
 *  - Same user           → never (no self-DM)
 *  - Recipient deleted   → never
 */
async function evaluatePermission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  senderId: string,
  recipientId: string,
): Promise<DmPermission> {
  if (senderId === recipientId) return { allowed: false, reason: "You can't message yourself." };

  const [{ data: sender }, { data: recipient }] = await Promise.all([
    admin.from("profiles").select("plan").eq("id", senderId).maybeSingle(),
    admin.from("profiles").select("plan, is_deleted, full_name").eq("id", recipientId).maybeSingle(),
  ]);
  if (!recipient || recipient.is_deleted) return { allowed: false, reason: "This account is no longer available." };

  const senderPlan = (sender?.plan ?? "bronze") as "bronze" | "silver" | "gold";
  const recipientPlan = (recipient.plan ?? "bronze") as "bronze" | "silver" | "gold";

  if (senderPlan === "gold" || recipientPlan === "gold") {
    return { allowed: true, reason: "Gold supporter networking" };
  }

  // Mutual follow check
  const { data: follows } = await admin
    .from("follows")
    .select("follower_id, following_id")
    .or(
      `and(follower_id.eq.${senderId},following_id.eq.${recipientId}),and(follower_id.eq.${recipientId},following_id.eq.${senderId})`,
    );
  const set = new Set(
    ((follows ?? []) as { follower_id: string; following_id: string }[]).map((r) => `${r.follower_id}:${r.following_id}`),
  );
  const mutual = set.has(`${senderId}:${recipientId}`) && set.has(`${recipientId}:${senderId}`);

  if (mutual) return { allowed: true, reason: "Mutual followers" };

  if (senderPlan === "silver") {
    // Co-attendee check
    const { data: mine } = await admin
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", senderId)
      .in("status", ["going", "interested"]);
    const ids = ((mine ?? []) as { event_id: string }[]).map((r) => r.event_id);
    if (ids.length) {
      const { data: shared } = await admin
        .from("event_attendees")
        .select("event_id")
        .eq("user_id", recipientId)
        .in("event_id", ids)
        .limit(1);
      if ((shared ?? []).length) return { allowed: true, reason: "You're attending the same event" };
    }
    return {
      allowed: false,
      reason: "Silver supporters can only message mutual followers or supporters attending the same event. Upgrade to Gold to message anyone.",
      requiredPlan: "gold",
    };
  }

  // Bronze
  return {
    allowed: false,
    reason: "Bronze supporters can only message mutual followers. Follow each other or upgrade to Silver/Gold to expand your network.",
    requiredPlan: "silver",
  };
}

/**
 * Validate tier rules and return-or-create a 1:1 conversation.
 * Throws on policy violation with a friendly message.
 */
export const startDirectConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recipientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senderId = context.userId;
    const recipientId = data.recipientId;

    const verdict = await evaluatePermission(supabaseAdmin, senderId, recipientId);
    if (!verdict.allowed) {
      const err = new Error(verdict.reason) as Error & { code: string; requiredPlan?: string };
      err.code = "dm_not_allowed";
      err.requiredPlan = verdict.requiredPlan;
      throw err;
    }

    // Find existing 1:1 conversation
    const { data: mine } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", senderId);
    const myIds = ((mine ?? []) as { conversation_id: string }[]).map((r) => r.conversation_id);
    if (myIds.length) {
      const { data: shared } = await supabaseAdmin
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", recipientId)
        .in("conversation_id", myIds);
      for (const row of ((shared ?? []) as { conversation_id: string }[])) {
        const { data: conv } = await supabaseAdmin
          .from("conversations")
          .select("id, is_group")
          .eq("id", row.conversation_id)
          .maybeSingle();
        if (conv && !conv.is_group) {
          return { conversationId: conv.id as string, allowed: true };
        }
      }
    }

    // Create
    const { data: created, error: cErr } = await supabaseAdmin
      .from("conversations")
      .insert({ is_group: false, created_by: senderId })
      .select("id")
      .single();
    if (cErr || !created) throw new Error(cErr?.message ?? "Could not create conversation");
    const cid = created.id as string;
    await supabaseAdmin.from("conversation_participants").insert([
      { conversation_id: cid, user_id: senderId },
      { conversation_id: cid, user_id: recipientId },
    ]);
    return { conversationId: cid, allowed: true };
  });

/** Read-only check used to gate UI (button label / tooltip). */
export const checkDmPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ recipientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return evaluatePermission(supabaseAdmin, context.userId, data.recipientId);
  });
