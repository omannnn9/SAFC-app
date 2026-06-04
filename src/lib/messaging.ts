import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import type { AuthorMini } from "@/lib/social";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
};

export type ConversationSummary = {
  id: string;
  kind: "dm" | "event";
  is_group: boolean;
  title: string | null;
  last_message_at: string;
  other: AuthorMini | null;
  last_message: string | null;
  unread: number;
  event_id?: string | null;
  cover_url?: string | null;
  members_count?: number;
};

export async function listEventChats(currentUserId: string): Promise<ConversationSummary[]> {
  const { data: mems } = await db
    .from("event_chat_members")
    .select("chat_id, last_read_at")
    .eq("user_id", currentUserId);
  const rows = (mems ?? []) as { chat_id: string; last_read_at: string | null }[];
  if (!rows.length) return [];
  const chatIds = rows.map((r) => r.chat_id);
  const lastReadMap = new Map(rows.map((r) => [r.chat_id, r.last_read_at]));

  const [{ data: chats }, { data: allMembers }, { data: lastMsgs }] = await Promise.all([
    db.from("event_chats").select("id, event_id, last_message_at, created_at").in("id", chatIds),
    db.from("event_chat_members").select("chat_id, user_id").in("chat_id", chatIds),
    db.from("event_chat_messages").select("id, chat_id, sender_id, body, created_at").in("chat_id", chatIds).order("created_at", { ascending: false }),
  ]);

  const eventIds = Array.from(new Set(((chats ?? []) as { event_id: string }[]).map((c) => c.event_id)));
  const { data: events } = eventIds.length
    ? await db.from("events").select("id, title, home_team, away_team, home_team_flag, away_team_flag, cover_url, kickoff").in("id", eventIds)
    : { data: [] };
  const evtMap = new Map(
    ((events ?? []) as Array<{ id: string; title: string; home_team: string | null; away_team: string | null; home_team_flag: string | null; away_team_flag: string | null; cover_url: string | null; kickoff: string }>).map((e) => [e.id, e]),
  );

  const memberCount = new Map<string, number>();
  for (const m of (allMembers ?? []) as { chat_id: string; user_id: string }[]) {
    memberCount.set(m.chat_id, (memberCount.get(m.chat_id) ?? 0) + 1);
  }

  const lastByChat = new Map<string, { body: string | null; created_at: string; sender_id: string }>();
  const unreadByChat = new Map<string, number>();
  for (const m of (lastMsgs ?? []) as { chat_id: string; body: string | null; created_at: string; sender_id: string }[]) {
    if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
    const lr = lastReadMap.get(m.chat_id);
    if (m.sender_id !== currentUserId && (!lr || new Date(m.created_at) > new Date(lr))) {
      unreadByChat.set(m.chat_id, (unreadByChat.get(m.chat_id) ?? 0) + 1);
    }
  }

  return ((chats ?? []) as { id: string; event_id: string; last_message_at: string | null; created_at: string }[]).map((c) => {
    const evt = evtMap.get(c.event_id);
    const flagPair = evt?.home_team_flag && evt?.away_team_flag ? `${evt.home_team_flag} ${evt.away_team_flag} ` : "";
    const title = evt
      ? evt.home_team && evt.away_team
        ? `${flagPair}${evt.home_team} vs ${evt.away_team}`
        : evt.title
      : "Event chat";
    const lm = lastByChat.get(c.id);
    return {
      id: c.id,
      kind: "event" as const,
      is_group: true,
      title,
      last_message_at: c.last_message_at ?? c.created_at,
      other: null,
      last_message: lm?.body ?? null,
      unread: unreadByChat.get(c.id) ?? 0,
      event_id: c.event_id,
      cover_url: evt?.cover_url ?? null,
      members_count: memberCount.get(c.id) ?? 1,
    };
  });
}

export async function listConversations(currentUserId: string): Promise<ConversationSummary[]> {
  const { data: parts } = await db
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", currentUserId);
  const rows = (parts ?? []) as { conversation_id: string; last_read_at: string }[];
  if (!rows.length) return [];
  const convIds = rows.map((r) => r.conversation_id);
  const lastReadMap = new Map(rows.map((r) => [r.conversation_id, r.last_read_at]));

  const [{ data: convs }, { data: otherParts }, { data: lastMsgs }] = await Promise.all([
    db.from("conversations").select("id, is_group, title, last_message_at").in("id", convIds),
    db.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds),
    db.from("messages").select("id, conversation_id, body, image_url, created_at, sender_id").in("conversation_id", convIds).order("created_at", { ascending: false }),
  ]);

  const otherUserByConv = new Map<string, string>();
  for (const p of (otherParts ?? []) as { conversation_id: string; user_id: string }[]) {
    if (p.user_id !== currentUserId) otherUserByConv.set(p.conversation_id, p.user_id);
  }
  const otherIds = Array.from(new Set(otherUserByConv.values()));
  const { data: profiles } = otherIds.length
    ? await db.from("profiles").select("id, full_name, username, avatar_url, plan").in("id", otherIds)
    : { data: [] };
  const profMap = new Map<string, AuthorMini>(((profiles ?? []) as AuthorMini[]).map((p) => [p.id, p]));

  const lastByConv = new Map<string, { body: string | null; image_url: string | null; created_at: string }>();
  const unreadByConv = new Map<string, number>();
  for (const m of (lastMsgs ?? []) as { conversation_id: string; body: string | null; image_url: string | null; created_at: string; sender_id: string }[]) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    const lr = lastReadMap.get(m.conversation_id);
    if (m.sender_id !== currentUserId && lr && new Date(m.created_at) > new Date(lr)) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return ((convs ?? []) as { id: string; is_group: boolean; title: string | null; last_message_at: string }[])
    .map((c) => {
      const lm = lastByConv.get(c.id);
      const otherId = otherUserByConv.get(c.id);
      return {
        id: c.id,
        kind: "dm" as const,
        is_group: c.is_group,
        title: c.title,
        last_message_at: c.last_message_at,
        other: otherId ? profMap.get(otherId) ?? null : null,
        last_message: lm ? lm.body ?? (lm.image_url ? "📷 Photo" : null) : null,
        unread: unreadByConv.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}

export async function findOrCreateDirectConversation(currentUserId: string, otherUserId: string): Promise<string> {
  // Find a 1:1 conversation that already includes both users
  const { data: mine } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId);
  const myConvIds = ((mine ?? []) as { conversation_id: string }[]).map((r) => r.conversation_id);
  if (myConvIds.length) {
    const { data: shared } = await db
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myConvIds);
    const candidate = ((shared ?? []) as { conversation_id: string }[])[0]?.conversation_id;
    if (candidate) {
      const { data: conv } = await db.from("conversations").select("is_group").eq("id", candidate).maybeSingle();
      if (conv && !(conv as { is_group: boolean }).is_group) return candidate;
    }
  }
  const { data: created } = await db
    .from("conversations")
    .insert({ is_group: false, created_by: currentUserId })
    .select("id")
    .single();
  const convId = (created as { id: string }).id;
  await db.from("conversation_participants").insert([
    { conversation_id: convId, user_id: currentUserId },
    { conversation_id: convId, user_id: otherUserId },
  ]);
  return convId;
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data } = await db
    .from("messages")
    .select("id, conversation_id, sender_id, body, image_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string | null, imageUrl: string | null) {
  const { data: inserted, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body, image_url: imageUrl })
    .select("id, conversation_id, sender_id, body, image_url, created_at")
    .single();
  if (error) throw error;
  // Notify other participants
  try {
    const { data: parts } = await db
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId);
    const others = ((parts ?? []) as { user_id: string }[]).map((p) => p.user_id).filter((id) => id !== senderId);
    if (others.length) {
      const { data: sender } = await db.from("profiles").select("full_name").eq("id", senderId).maybeSingle();
      const name = (sender as { full_name: string } | null)?.full_name || "Someone";
      const preview = body ? body.slice(0, 80) : imageUrl ? "📷 Photo" : "New message";
      const { createNotification } = await import("@/lib/notifications");
      await Promise.all(
        others.map((uid) =>
          createNotification({
            userId: uid,
            actorId: senderId,
            type: "message",
            title: name,
            body: preview,
            link: `/messages/${conversationId}`,
          }),
        ),
      );
    }
  } catch (e) {
    console.warn("DM notification failed", e);
  }
  return inserted as Message;
}

export async function markRead(conversationId: string, userId: string) {
  await db
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

export function subscribeToMessages(conversationId: string, onMessage: (m: Message) => void) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export type PresenceMeta = { typing: boolean; lastTyped: number };

export function subscribeToPresence(
  conversationId: string,
  userId: string,
  onState: (others: Map<string, PresenceMeta>) => void,
) {
  const channel = supabase.channel(`presence:${conversationId}`, {
    config: { presence: { key: userId } },
  });
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const others = new Map<string, PresenceMeta>();
    for (const [key, metas] of Object.entries(state)) {
      if (key === userId) continue;
      const m = (metas as Array<{ typing?: boolean; lastTyped?: number }>)[0] ?? {};
      others.set(key, { typing: !!m.typing, lastTyped: m.lastTyped ?? 0 });
    }
    onState(others);
  });
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ online: true, typing: false, lastTyped: 0 });
    }
  });
  const setTyping = async (typing: boolean) => {
    await channel.track({ online: true, typing, lastTyped: Date.now() });
  };
  return {
    setTyping,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
