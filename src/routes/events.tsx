import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CalendarDays, Sparkles, Trophy, Users, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { EventCard } from "@/components/EventCard";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/social";

export const Route = createFileRoute("/events")({
  head: () => ({ meta: [{ title: "Events — SAFC" }] }),
  component: EventsPage,
});

function EventsPage() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  if (path !== "/events" && path !== "/events/") return <Outlet />;

  const eventsQ = useQuery({
    queryKey: ["events-all"],
    queryFn: async () => {
      const { data } = await db.from("events").select("*").order("kickoff", { ascending: true });
      return (data ?? []) as EventRow[];
    },
    refetchInterval: 30_000,
  });

  const attendeesQ = useQuery({
    queryKey: ["attendee-counts"],
    queryFn: async () => {
      const { data } = await db.from("event_attendees").select("event_id").eq("status", "going");
      const map = new Map<string, number>();
      for (const r of (data ?? []) as { event_id: string }[]) {
        map.set(r.event_id, (map.get(r.event_id) ?? 0) + 1);
      }
      return map;
    },
    refetchInterval: 10_000,
  });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const list = eventsQ.data ?? [];
    return {
      upcoming: list.filter((e) => new Date(e.kickoff).getTime() >= now),
      past: list.filter((e) => new Date(e.kickoff).getTime() < now).reverse(),
    };
  }, [eventsQ.data]);

  return (
    <PageContainer>
      <AppHeader title="Events" />

      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Events</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          Where supporters <span className="text-gradient-gold">gather</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          RSVP to matches, tournaments and fan zones. See who's going.
        </p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2 px-4">
        <Link to="/worldcup" className="glass flex items-center gap-2 rounded-2xl p-3 ring-1 ring-[var(--sa-gold)]/30 transition hover:bg-white/5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--sa-gold)]/15"><Trophy className="h-5 w-5 text-[var(--sa-gold)]" /></div>
          <div className="min-w-0">
            <div className="font-display text-sm font-black">World Cup 2026</div>
            <div className="truncate text-[10px] text-muted-foreground">Every match · live updates</div>
          </div>
        </Link>
        {user ? (
          <Link to="/my-events" className="glass flex items-center gap-2 rounded-2xl p-3 transition hover:bg-white/5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15"><Star className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <div className="font-display text-sm font-black">My events</div>
              <div className="truncate text-[10px] text-muted-foreground">Everything you've joined</div>
            </div>
          </Link>
        ) : (
          <Link to="/groups" className="glass flex items-center gap-2 rounded-2xl p-3 transition hover:bg-white/5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15"><Users className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <div className="font-display text-sm font-black">Travel & meetups</div>
              <div className="truncate text-[10px] text-muted-foreground">Coordinate with supporters</div>
            </div>
          </Link>
        )}
      </section>

      <section className="mt-5 px-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Upcoming · {upcoming.length}
        </h2>
        <div className="space-y-3">
          {eventsQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} attendees={attendeesQ.data?.get(e.id) ?? 0} />
          ))}
          {!eventsQ.isLoading && upcoming.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No upcoming events scheduled yet.
            </div>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="mt-6 px-4 pb-32">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <CalendarDays className="mr-1 inline h-3 w-3" /> Past · {past.length}
          </h2>
          <div className="space-y-3 opacity-70">
            {past.slice(0, 10).map((e) => (
              <EventCard key={e.id} event={e} attendees={attendeesQ.data?.get(e.id) ?? 0} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
