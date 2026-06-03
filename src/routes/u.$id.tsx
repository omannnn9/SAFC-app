import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Trophy, ArrowLeft, Crown, MessageCircle, Tag } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard } from "@/components/PostCard";
import { FollowButton } from "@/components/FollowButton";
import { AchievementsList } from "@/components/AchievementsList";
import { db } from "@/lib/db";
import { fetchFeed } from "@/lib/social";
import { startDirectConversation } from "@/lib/dm.functions";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type FullProfile = {
  id: string;
  full_name: string;
  username: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  favourite_team: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  plan: "bronze" | "silver" | "gold";
  interests: string[] | null;
  created_at: string;
};

export const Route = createFileRoute("/u/$id")({
  head: () => ({ meta: [{ title: "Supporter — Bafana Connect" }] }),
  component: UserPage,
});

function UserPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const profileQ = useQuery({
    queryKey: ["user-profile", id],
    queryFn: async () => {
      const { data } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
      return data as FullProfile | null;
    },
  });

  const statsQ = useQuery({
    queryKey: ["user-stats", id],
    queryFn: async () => {
      const [{ data: followers }, { data: following }, { data: posts }] = await Promise.all([
        db.from("follows").select("follower_id").eq("following_id", id),
        db.from("follows").select("following_id").eq("follower_id", id),
        db.from("posts").select("id").eq("user_id", id),
      ]);
      return { followers: followers?.length ?? 0, following: following?.length ?? 0, posts: posts?.length ?? 0 };
    },
  });

  const postsQ = useQuery({
    queryKey: ["user-posts", id, user?.id ?? "anon"],
    queryFn: async () => fetchFeed(user?.id ?? null, { userId: id }),
  });

  const onMessage = async () => {
    if (!user) return toast.error("Sign in to message");
    if (user.id === id) return;
    try {
      const res = await startDirectConversation({ data: { recipientId: id } });
      navigate({ to: "/messages/$id", params: { id: res.conversationId } });
    } catch (e) {
      const msg = (e as Error)?.message ?? "Couldn't open chat";
      toast.error(msg, { duration: 6000 });
    }
  };

  if (profileQ.isLoading) {
    return <PageContainer><AppHeader /><div className="glass mx-4 mt-5 h-48 animate-pulse rounded-2xl" /></PageContainer>;
  }
  if (!profileQ.data) {
    return <PageContainer><AppHeader /><div className="p-8 text-center text-muted-foreground">Supporter not found.</div></PageContainer>;
  }

  const p = profileQ.data;
  const memberSince = new Date(p.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" });

  return (
    <PageContainer>
      <AppHeader title="Profile" />

      <div className="px-4 pt-3">
        <Link to="/community" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Community
        </Link>
      </div>

      <div
        className="mx-4 mt-3 h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--sa-green)] to-[oklch(0.3_0.13_155)]"
        style={p.cover_url ? { backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />

      <section className="px-4 -mt-8">
        <div className="flex items-end gap-3">
          <UserAvatar name={p.full_name} src={p.avatar_url} size={88} ring={p.plan === "gold" ? "gold" : null} className="ring-4 ring-background" />
          <div className="ml-auto flex items-center gap-2 pb-2">
            {user && user.id !== p.id && (
              <button onClick={onMessage} className="glass inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider hover:ring-glow-gold">
                <MessageCircle className="h-3.5 w-3.5" /> Message
              </button>
            )}
            <FollowButton targetId={p.id} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="font-display text-2xl font-black">{p.full_name || "Supporter"}</h1>
          {p.plan === "gold" && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sa-gold)]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--sa-gold)]"><Crown className="h-3 w-3" /> Gold</span>}
          {p.plan === "silver" && <span className="rounded-full bg-zinc-300/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-200">Silver</span>}
          {p.plan === "bronze" && <span className="rounded-full bg-amber-700/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-500">Bronze</span>}
        </div>
        {p.username && <div className="text-xs text-muted-foreground">@{p.username}</div>}
        {p.bio && <p className="mt-2 text-sm text-foreground/90">{p.bio}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {(p.city || p.country) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {[p.city, p.country].filter(Boolean).join(", ")}</span>}
          {p.favourite_team && <span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3 text-primary" /> {p.favourite_team}</span>}
          <span>Joined {memberSince}</span>
        </div>

        {p.interests && p.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.interests.map((i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold">
                <Tag className="h-3 w-3 text-primary" /> {i}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat n={statsQ.data?.posts ?? 0} label="Posts" />
          <Stat n={statsQ.data?.followers ?? 0} label="Followers" />
          <Stat n={statsQ.data?.following ?? 0} label="Following" />
        </div>
      </section>

      <section className="mt-5 px-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Achievements</h2>
        <AchievementsList userId={id} />
      </section>

      <section className="mt-5 px-4 pb-32 space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Posts</h2>
        {postsQ.data?.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No posts yet.</div>}
        {postsQ.data?.map((post) => <PostCard key={post.id} post={post} onChange={() => postsQ.refetch()} />)}
      </section>
    </PageContainer>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="glass rounded-xl py-2">
      <div className="font-display text-xl font-black">{n}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
