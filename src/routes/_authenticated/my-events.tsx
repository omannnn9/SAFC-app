import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CalendarDays, Sparkles, ArrowLeft, Star, Check, HelpCircle, X as XIcon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { EventCard } from "@/components/EventCard";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { EventRow } from "@/lib/social";
import type { AttendanceStatus } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/my-events")({
  head: () => ({ meta: [{ title: "My Events — Bafana Connect" }] }),
  component: MyEventsPage,
});

type Row = EventRow & { _status: AttendanceStatus };

function MyEventsPage() {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["my-events", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Row[]> => {
      const { data: att } = await db
        .from("event_attendees")
        .select("event_id, status")
        .eq("user_id", user!.id);
      const rows = (att ?? []) as { event_id: string; status: AttendanceStatus }[];
      if (!rows.length) return [];
      const statusMap = new Map(rows.map((r) => [r.event_id, r.status]));
      const { data: evs } = await db
        .from("events")
        .select("*")
        .in("id", rows.map((r) => r.event_id))
        .order("kickoff", { ascending: true });
      return ((evs ?? []) as EventRow[]).map((e) => ({ ...e, _status: statusMap.get(e.id) ?? "going" }));
    },
  });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const list = q.data ?? [];
    return {
      upcoming: list.filter((e) => new Date(e.kickoff).getTime() >= now),
      past: list.filter((e) => new Date(e.kickoff).getTime() < now).reverse(),
    };
  }, [q.data]);

  return (
    <PageContainer>
      <AppHeader title="My events" />

      <div className="px-4 pt-3">
        <Link to="/events" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>
      </div>

      <section className="px-4 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Your calendar</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          Events you're <span className="text-gradient-gold">part of</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything you've RSVP'd to. Auto-joined community chats appear in Groups.</p>
      </section>

      <section className="mt-5 px-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Upcoming · {upcoming.length}
        </h2>
        <div className="space-y-3">
          {q.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
          {upcoming.map((e) => (
            <div key={e.id} className="relative">
              <EventCard event={e} />
              <StatusBadge status={e._status} />
            </div>
          ))}
          {!q.isLoading && upcoming.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              You haven't joined any upcoming events yet.
              <div className="mt-3"><Link to="/events" className="rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground">Browse events</Link></div>
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
            {past.slice(0, 20).map((e) => (
              <div key={e.id} className="relative">
                <EventCard event={e} />
                <StatusBadge status={e._status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const map: Record<AttendanceStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    going: { label: "Going", icon: <Check className="h-3 w-3" />, cls: "bg-primary text-primary-foreground" },
    interested: { label: "Interested", icon: <Star className="h-3 w-3" />, cls: "bg-[var(--sa-gold)]/20 text-[var(--sa-gold)]" },
    maybe: { label: "Maybe", icon: <HelpCircle className="h-3 w-3" />, cls: "bg-surface-2 text-muted-foreground" },
    not_going: { label: "Can't", icon: <XIcon className="h-3 w-3" />, cls: "bg-surface-2 text-muted-foreground" },
  };
  const m = map[status];
  return (
    <div className={`pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${m.cls}`}>
      {m.icon} {m.label}
    </div>
  );
}
