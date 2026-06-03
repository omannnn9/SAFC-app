import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

type CreateParams = {
  userId: string; // recipient
  actorId?: string; // sender (skip if equal to recipient)
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

/** Insert an in-app notification. Silently no-ops if actor == recipient. */
export async function createNotification(params: CreateParams) {
  if (params.actorId && params.actorId === params.userId) return;
  try {
    await db.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    });
  } catch (e) {
    // never let notification failure break the parent action
    console.warn("createNotification failed", e);
  }
}

export async function fetchMyNotifications(limit = 30): Promise<NotificationRow[]> {
  const { data } = await db
    .from("notifications")
    .select("id, user_id, type, title, body, link, read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  return count ?? 0;
}

export async function markAllRead(userId: string) {
  await db.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export async function markOneRead(id: string) {
  await db.from("notifications").update({ read: true }).eq("id", id);
}

export function subscribeToMyNotifications(userId: string, onInsert: (n: NotificationRow) => void) {
  const channel = supabase
    .channel(`notif:${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new as NotificationRow),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
