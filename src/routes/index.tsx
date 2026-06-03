import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Trophy, CalendarDays, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { PostCard } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { EventCard } from "@/components/EventCard";
import { useAuth } from "@/lib/auth";
import { fetchFeed } from "@/lib/social";
import type { EventRow } from "@/lib/social";
import { db } from "@/lib/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bafana Connect — Premium supporter network" },
      {
        name: "description",
        content:
          "Connect with South African football supporters attending the same matches, tournaments and fan zones.",
      },
      { property: "og:title", content: "Bafana Connect" },
      { property: "og:description", content: "The premium social network for South African football supporters." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, profile } = useAuth();

  const feedQ = useQuery({
    queryKey: ["feed", user?.id ?? "anon"],
    queryFn: () => fetchFeed(user?.id ?? null),
  });

  const eventsQ = useQuery({
    queryKey: ["events-upcoming"],
    queryFn: async () => {
      const { data } = await db
        .from("events")
        .select("*")
        .gte("kickoff", new Date().toISOString())
        .order("kickoff", { ascending: true })
        .limit(5);
      return (data ?? []) as EventRow[];
    },
  });

  return (
    <PageContainer>
      <AppHeader title="Connect" />

      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          Bafana Connect
        </div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          {user ? `Welcome back, ${profile?.full_name?.split(" ")[0] ?? "supporter"}` : (
            <>The pulse of <span className="text-gradient-gold">SA supporters</span></>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share match-day moments. Meet supporters going to the same events.
        </p>
      </section>

      {/* Upcoming events strip */}
      {eventsQ.data && eventsQ.data.length > 0 && (
        <section className="mt-5 px-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <CalendarDays className="mr-1 inline h-3 w-3 text-primary" /> Upcoming
            </h2>
            <Link to="/events" className="text-[11px] font-semibold text-primary">View all →</Link>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 scrollbar-none">
            {eventsQ.data.map((e) => (
              <div key={e.id} className="min-w-[280px] max-w-[280px]">
                <EventCard event={e} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Composer */}
      <section className="mt-5 px-4">
        <CreatePost onPosted={() => feedQ.refetch()} />
      </section>

      {/* Feed */}
      <section className="mt-4 px-4 pb-32 space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Supporter feed
        </h2>
        {feedQ.isLoading && (
          <div className="glass h-40 animate-pulse rounded-2xl" />
        )}
        {feedQ.data?.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <Trophy className="mx-auto h-7 w-7 text-primary" />
            <div className="mt-2 font-display text-lg font-black">The feed is quiet</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to post. Share a match memory or a meetup plan.
            </p>
            <Link
              to="/community"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground"
            >
              <Users className="h-3.5 w-3.5" /> Find supporters
            </Link>
          </div>
        )}
        {feedQ.data?.map((p) => (
          <PostCard key={p.id} post={p} onChange={() => feedQ.refetch()} />
        ))}
      </section>
    </PageContainer>
  );
}
