import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Users, MapPin, Trophy } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { FollowButton } from "@/components/FollowButton";
import { db } from "@/lib/db";

type DiscoverProfile = {
  id: string;
  full_name: string;
  username: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  favourite_team: string | null;
  avatar_url: string | null;
  plan: "bronze" | "silver" | "gold";
};

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [{ title: "Community — Bafana Connect" }] }),
  component: CommunityPage,
});

function CommunityPage() {
  const [q, setQ] = useState("");

  const peopleQ = useQuery({
    queryKey: ["discover-profiles"],
    queryFn: async () => {
      const { data } = await db
        .from("profiles")
        .select("id, full_name, username, bio, city, country, favourite_team, avatar_url, plan")
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? []) as DiscoverProfile[];
    },
  });

  const filtered = (peopleQ.data ?? []).filter((p) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return [p.full_name, p.username, p.city, p.country, p.favourite_team]
      .filter(Boolean)
      .some((s) => s!.toLowerCase().includes(needle));
  });

  return (
    <PageContainer>
      <AppHeader title="Community" />

      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Community</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          Meet <span className="text-gradient-gold">supporters</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover fans going to the same matches, fan zones and tournaments.
        </p>
      </section>

      <section className="mt-4 px-4">
        <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, city, team…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </label>
      </section>

      <section className="mt-4 px-4 pb-32 space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Users className="mr-1 inline h-3 w-3 text-primary" /> {filtered.length} supporters
        </h2>
        {peopleQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
        {filtered.map((p) => (
          <Link
            to="/u/$id"
            params={{ id: p.id }}
            key={p.id}
            className="glass flex items-center gap-3 rounded-2xl p-3 transition hover:ring-glow-gold"
          >
            <UserAvatar name={p.full_name} src={p.avatar_url} size={52} ring={p.plan === "gold" ? "gold" : null} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate font-display text-sm font-black">{p.full_name || "Supporter"}</div>
                {p.plan === "gold" && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">VIP</span>
                )}
              </div>
              {p.username && <div className="text-[11px] text-muted-foreground">@{p.username}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {(p.city || p.country) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {[p.city, p.country].filter(Boolean).join(", ")}
                  </span>
                )}
                {p.favourite_team && (
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="h-3 w-3 text-primary" /> {p.favourite_team}
                  </span>
                )}
              </div>
            </div>
            <FollowButton targetId={p.id} compact />
          </Link>
        ))}
        {!peopleQ.isLoading && filtered.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No supporters match that search yet.
          </div>
        )}
      </section>
    </PageContainer>
  );
}
