import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: "wc_match" | "match" | "tournament" | "fan_zone" | "meetup" | "festival" | "travel";
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final" | "friendly" | "other" | null;
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  home_team_flag: string | null;
  away_team_flag: string | null;
  kickoff: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  cover_url: string | null;
  status: "scheduled" | "live" | "finished";
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  is_featured: boolean;
  created_by: string | null;
};

export type AuthorMini = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  plan: "bronze" | "silver" | "gold";
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
  shares: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
};

const PAGE_SIZE = 12;

export async function fetchFeed(
  currentUserId: string | null,
  opts: { eventId?: string; page?: number; userId?: string } = {},
): Promise<FeedPost[]> {
  const page = opts.page ?? 0;
  let q = db
    .from("posts")
    .select("id, user_id, body, image_url, event_id, created_at")
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (opts.eventId) q = q.eq("event_id", opts.eventId);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data: posts } = await q;
  const list = (posts ?? []) as FeedPost[];
  if (!list.length) return [];
  return enrichPosts(list, currentUserId);
}

export async function enrichPosts(
  list: FeedPost[],
  currentUserId: string | null,
): Promise<FeedPost[]> {
  const userIds = Array.from(new Set(list.map((p) => p.user_id)));
  const eventIds = Array.from(new Set(list.map((p) => p.event_id).filter(Boolean) as string[]));
  const postIds = list.map((p) => p.id);

  const [authorsRes, eventsRes, likeCountsRes, commentCountsRes, shareCountsRes, myLikesRes, mySavesRes] = await Promise.all([
    db.from("profiles").select("id, full_name, username, avatar_url, plan").in("id", userIds),
    eventIds.length ? db.from("events").select("id, title").in("id", eventIds) : Promise.resolve({ data: [] }),
    db.from("post_likes").select("post_id").in("post_id", postIds),
    db.from("post_comments").select("post_id").in("post_id", postIds),
    db.from("post_shares").select("post_id").in("post_id", postIds),
    currentUserId ? db.from("post_likes").select("post_id").eq("user_id", currentUserId).in("post_id", postIds) : Promise.resolve({ data: [] }),
    currentUserId ? db.from("post_saves").select("post_id").eq("user_id", currentUserId).in("post_id", postIds) : Promise.resolve({ data: [] }),
  ]);

  const authorMap = new Map<string, AuthorMini>(((authorsRes.data ?? []) as AuthorMini[]).map((a) => [a.id, a]));
  const eventMap = new Map<string, { id: string; title: string }>(((eventsRes.data ?? []) as { id: string; title: string }[]).map((e) => [e.id, e]));
  const tally = <T extends { post_id: string }>(rows: T[] | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1);
    return m;
  };
  const likeCount = tally(likeCountsRes.data as { post_id: string }[]);
  const commentCount = tally(commentCountsRes.data as { post_id: string }[]);
  const shareCount = tally(shareCountsRes.data as { post_id: string }[]);
  const myLikes = new Set(((myLikesRes.data ?? []) as { post_id: string }[]).map((r) => r.post_id));
  const mySaves = new Set(((mySavesRes.data ?? []) as { post_id: string }[]).map((r) => r.post_id));

  return list.map((p) => ({
    ...p,
    author: authorMap.get(p.user_id) ?? null,
    event: p.event_id ? eventMap.get(p.event_id) ?? null : null,
    likes: likeCount.get(p.id) ?? 0,
    comments: commentCount.get(p.id) ?? 0,
    shares: shareCount.get(p.id) ?? 0,
    liked_by_me: myLikes.has(p.id),
    saved_by_me: mySaves.has(p.id),
  }));
}

export async function togglePostLike(postId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    await db.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await db.from("post_likes").insert({ post_id: postId, user_id: userId });
  }
}

export async function togglePostSave(postId: string, userId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    await db.from("post_saves").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await db.from("post_saves").insert({ post_id: postId, user_id: userId });
  }
}

export async function recordShare(postId: string, userId: string, channel = "link") {
  await db.from("post_shares").insert({ post_id: postId, user_id: userId, channel });
}

export async function toggleFollow(targetId: string, userId: string, currentlyFollowing: boolean) {
  if (currentlyFollowing) {
    await db.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
  } else {
    await db.from("follows").insert({ follower_id: userId, following_id: targetId });
    await db.from("notifications").insert({
      user_id: targetId,
      type: "follow",
      title: "New follower",
      body: "Someone just followed you",
      link: `/u/${userId}`,
    });
    await db.from("user_achievements").insert({ user_id: userId, achievement_id: "first_follow" }).then(() => {}, () => {});
  }
}

export async function setAttendance(
  eventId: string,
  userId: string,
  status: "going" | "interested" | "not_going" | null,
) {
  if (status === null) {
    await db.from("event_attendees").delete().eq("event_id", eventId).eq("user_id", userId);
    return;
  }
  await db
    .from("event_attendees")
    .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: "event_id,user_id" });
  if (status === "going") {
    await db.from("user_achievements").insert({ user_id: userId, achievement_id: "first_event" }).then(() => {}, () => {});
  }
}

export async function uploadUserFile(userId: string, file: File, prefix: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("user-content").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("user-content").getPublicUrl(path);
  return data.publicUrl;
}

export type SuggestedUser = AuthorMini & {
  city: string | null;
  country: string | null;
  favourite_team: string | null;
  reason: string;
};

export async function fetchSuggestedUsers(currentUserId: string | null, limit = 6): Promise<SuggestedUser[]> {
  let myCity: string | null = null;
  let myCountry: string | null = null;
  const myFollowing = new Set<string>();
  if (currentUserId) {
    const [{ data: me }, { data: follows }] = await Promise.all([
      db.from("profiles").select("city, country").eq("id", currentUserId).maybeSingle(),
      db.from("follows").select("following_id").eq("follower_id", currentUserId),
    ]);
    myCity = (me as { city: string | null } | null)?.city ?? null;
    myCountry = (me as { country: string | null } | null)?.country ?? null;
    for (const f of (follows ?? []) as { following_id: string }[]) myFollowing.add(f.following_id);
  }
  const { data } = await db
    .from("profiles")
    .select("id, full_name, username, avatar_url, plan, city, country, favourite_team")
    .order("created_at", { ascending: false })
    .limit(40);
  const all = ((data ?? []) as SuggestedUser[]).filter((p) => p.id !== currentUserId && !myFollowing.has(p.id));
  const scored = all.map((p) => {
    let score = 0;
    let reason = "Supporter";
    if (p.city && myCity && p.city === myCity) { score += 3; reason = `Same city — ${p.city}`; }
    else if (p.country && myCountry && p.country === myCountry) { score += 1; reason = `From ${p.country}`; }
    if (p.plan === "gold") score += 0.5;
    return { ...p, reason, _s: score };
  });
  scored.sort((a, b) => b._s - a._s);
  return scored.slice(0, limit).map(({ _s, ...rest }) => rest);
}

export async function fetchTrendingPosts(currentUserId: string | null, limit = 5): Promise<FeedPost[]> {
  // last 14 days, sort by likes desc
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data } = await db
    .from("post_likes")
    .select("post_id")
    .gte("created_at", since);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { post_id: string }[]) counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (!top.length) return [];
  const { data: posts } = await db.from("posts").select("id, user_id, body, image_url, event_id, created_at").in("id", top);
  return enrichPosts((posts ?? []) as FeedPost[], currentUserId);
}

export type ProfileCompletion = { score: number; missing: string[] };
export function computeProfileCompletion(p: {
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  city: string | null;
  favourite_team: string | null;
  username: string | null;
  interests?: string[] | null;
}): ProfileCompletion {
  const checks: Array<[string, boolean]> = [
    ["Profile photo", !!p.avatar_url],
    ["Cover photo", !!p.cover_url],
    ["Username", !!p.username],
    ["Bio", !!(p.bio && p.bio.trim().length > 0)],
    ["City", !!p.city],
    ["Favourite team", !!p.favourite_team],
    ["Football interests", !!(p.interests && p.interests.length > 0)],
  ];
  const done = checks.filter((c) => c[1]).length;
  const score = Math.round((done / checks.length) * 100);
  return { score, missing: checks.filter((c) => !c[1]).map((c) => c[0]) };
}
