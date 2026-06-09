import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthenticatedSupabase } from "@/lib/server-auth";
import { planToTier, type Tier } from "@/lib/tiers";

export type DmPermission = {
  allowed: boolean;
  reason: string;
  requiredTier?: Tier;
};

/**
 * Tier-based DM rule (SAFC membership):
 *  - Sender is Founder/Premium → always allowed (VIP networking)
 *  - Recipient is Founder/Premium → always allowed (they accept all)
 *  - Sender is Basic → mutual follow OR co-attendee of any event
 *  - Sender is Free  → mutual follow only
 *  - Same user / deleted recipient → never
 */
async function evaluatePermission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  senderId: string,
  recipientId: string,
): Promise<DmPermission> {
  if (senderId === recipientId) return { allowed: false, reason: "You can't message yourself." };

  const [{ data: sender }, { data: recipient }] = await Promise.all([
    admin.from("profiles").select("plan, tier").eq("id", senderId).maybeSingle(),
    admin.from("profiles").select("plan, tier, is_deleted, full_name").eq("id", recipientId).maybeSingle(),
  ]);
  if (!recipient || recipient.is_deleted) return { allowed: false, reason: "This account is no longer available." };

  const senderTier: Tier = (sender?.tier as Tier | undefined) ?? planToTier(sender?.plan);
  const recipientTier: Tier = (recipient.tier as Tier | undefined) ?? planToTier(recipient.plan);

  const isPaid = (t: Tier) => t === "premium" || t === "founder";
  if (isPaid(senderTier) || isPaid(recipientTier)) {
    return { allowed: true, reason: "Premium / Founder networking" };
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

  if (senderTier === "basic") {
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
      reason: "Basic members can only message mutual followers or supporters attending the same event. Upgrade to Premium to message anyone.",
      requiredTier: "premium",
    };
  }

  // Free
  return {
    allowed: false,
    reason: "Free members can only message mutual followers. Follow each other or upgrade to Basic / Premium to expand your network.",
    requiredTier: "basic",
  };
}

/**
 * Validate tier rules and return-or-create a 1:1 conversation.
 * Throws on policy violation with a friendly message.
 */
export const startDirectConversation = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ recipientId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId: senderId } = await requireAuthenticatedSupabase();
    const recipientId = data.recipientId;

    const verdict = await evaluatePermission(supabaseAdmin, senderId, recipientId);
    if (!verdict.allowed) {
      const err = new Error(verdict.reason) as Error & { code: string; requiredTier?: string };
      err.code = "dm_not_allowed";
      err.requiredTier = verdict.requiredTier;
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
  .inputValidator((input) => z.object({ recipientId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requireAuthenticatedSupabase();
    return evaluatePermission(supabaseAdmin, userId, data.recipientId);
  });
