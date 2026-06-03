import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Trophy, ArrowLeft, Crown } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard } from "@/components/PostCard";
import { FollowButton } from "@/components/FollowButton";
import { db } from "@/lib/db";
import { fetchFeed } from "@/lib/social";
import { useAuth } from "@/lib/auth";

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
  plan: "free" | "plus" | "vip";
};

export const Route = createFileRoute("/u/$id")({
  head: () => ({ meta: [{ title: "Supporter — Bafana Connect" }] }),
  component: UserPage,
});

function UserPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();

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
      const [{ data: followers }, { data: following }] = await Promise.all([
        db.from("follows").select("follower_id").eq("following_id", id),
        db.from("follows").select("following_id").eq("follower_id", id),
      ]);
      return { followers: followers?.length ?? 0, following: following?.length ?? 0 };
    },
  });

  const postsQ = useQuery({
    queryKey: ["user-posts", id, user?.id ?? "anon"],
    queryFn: async () => {
      return fetchFeed(user?.id ?? null, { userId: id });
    },
  });

  if (profileQ.isLoading) {
    return <PageContainer><AppHeader /><div className="glass mx-4 mt-5 h-48 animate-pulse rounded-2xl" /></PageContainer>;
  }
  if (!profileQ.data) {
    return <PageContainer><AppHeader /><div className="p-8 text-center text-muted-foreground">Supporter not found.</div></PageContainer>;
  }

  const p = profileQ.data;
  return (
    <PageContainer>
      <AppHeader title="Profile" />

      <div className="px-4 pt-3">
        <Link to="/community" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Community
        </Link>
      </div>

      {/* Cover */}
      <div
        className="mx-4 mt-3 h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--sa-green)] to-[oklch(0.3_0.13_155)]"
        style={p.cover_url ? { backgroundImage: `url(${p.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />

      <section className="px-4 -mt-8">
        <div className="flex items-end gap-3">
          <UserAvatar name={p.full_name} src={p.avatar_url} size={88} ring={p.plan === "vip" ? "gold" : null} className="ring-4 ring-background" />
          <div className="ml-auto pb-2">
            <FollowButton targetId={p.id} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="font-display text-2xl font-black">{p.full_name || "Supporter"}</h1>
          {p.plan === "vip" && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary"><Crown className="h-3 w-3" /> VIP</span>}
          {p.plan === "plus" && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-accent-foreground">Plus</span>}
        </div>
        {p.username && <div className="text-xs text-muted-foreground">@{p.username}</div>}
        {p.bio && <p className="mt-2 text-sm text-foreground/90">{p.bio}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {(p.city || p.country) && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {[p.city, p.country].filter(Boolean).join(", ")}</span>}
          {p.favourite_team && <span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3 text-primary" /> {p.favourite_team}</span>}
        </div>
        <div className="mt-3 flex gap-4 text-xs">
          <div><span className="font-display font-black text-foreground">{statsQ.data?.followers ?? 0}</span> <span className="text-muted-foreground">Followers</span></div>
          <div><span className="font-display font-black text-foreground">{statsQ.data?.following ?? 0}</span> <span className="text-muted-foreground">Following</span></div>
        </div>
      </section>

      <section className="mt-5 px-4 pb-32 space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Posts</h2>
        {postsQ.data?.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No posts yet.</div>}
        {postsQ.data?.map((post) => <PostCard key={post.id} post={post} onChange={() => postsQ.refetch()} />)}
      </section>
    </PageContainer>
  );
}
