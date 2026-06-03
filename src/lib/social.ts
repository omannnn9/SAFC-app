import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: "match" | "tournament" | "fan_zone" | "meetup" | "festival";
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  kickoff: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  cover_url: string | null;
  created_by: string | null;
};

export type AuthorMini = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  plan: "free" | "plus" | "vip";
};

export type FeedPost = {
  id: string;
  user_id: string;
  body: string | null;
  image_url: string | null;
  event_id: string | null;
  created_at: string;
  author: AuthorMini | null;
  event: { id: string; title: string } | null;
  likes: number;
  comments: number;
  liked_by_me: boolean;
};

export async function fetchFeed(currentUserId: string | null): Promise<FeedPost[]> {
  const { data: posts } = await supabase
    .from("posts")
    .select("id, user_id, body, image_url, event_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!posts?.length) return [];

  const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
  const eventIds = Array.from(new Set(posts.map((p) => p.event_id).filter(Boolean) as string[]));
  const postIds = posts.map((p) => p.id);

  const [authorsRes, eventsRes, likeCountsRes, commentCountsRes, myLikesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, username, avatar_url, plan").in("id", userIds),
    eventIds.length
      ? supabase.from("events").select("id, title").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    supabase.from("post_likes").select("post_id").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
    currentUserId
      ? supabase.from("post_likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const authorMap = new Map((authorsRes.data ?? []).map((a) => [a.id, a as AuthorMini]));
  const eventMap = new Map((eventsRes.data ?? []).map((e) => [e.id, e]));
  const likeCount = new Map<string, number>();
  for (const r of likeCountsRes.data ?? []) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
  const commentCount = new Map<string, number>();
  for (const r of commentCountsRes.data ?? []) commentCount.set(r.post_id, (commentCount.get(r.post_id) ?? 0) + 1);
  const myLikes = new Set((myLikesRes.data ?? []).map((r) => r.post_id));

  return posts.map((p) => ({
    ...p,
    author: authorMap.get(p.user_id) ?? null,
    event: p.event_id ? eventMap.get(p.event_id) ?? null : null,
    likes: likeCount.get(p.id) ?? 0,
    comments: commentCount.get(p.id) ?? 0,
    liked_by_me: myLikes.has(p.id),
  }));
}

export async function togglePostLike(postId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  }
}

export async function toggleFollow(targetId: string, userId: string, currentlyFollowing: boolean) {
  if (currentlyFollowing) {
    await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
  } else {
    await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
  }
}

export async function setAttendance(
  eventId: string,
  userId: string,
  status: "going" | "interested" | "not_going" | null,
) {
  if (status === null) {
    await supabase.from("event_attendees").delete().eq("event_id", eventId).eq("user_id", userId);
    return;
  }
  await supabase
    .from("event_attendees")
    .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: "event_id,user_id" });
}

export async function uploadUserFile(userId: string, file: File, prefix: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("user-content").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("user-content").getPublicUrl(path);
  return data.publicUrl;
}
