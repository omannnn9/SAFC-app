import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, MapPin, Trophy, Users, ArrowLeft, Check, Star, X as XIcon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchFeed, setAttendance } from "@/lib/social";
import type { EventRow, AuthorMini } from "@/lib/social";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$id")({
  head: () => ({ meta: [{ title: "Event — Bafana Connect" }] }),
  component: EventDetailPage,
});

type Attendee = { user_id: string; status: "going" | "interested" | "not_going"; profile: AuthorMini | null };

function EventDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"feed" | "attendees">("feed");

  const eventQ = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data } = await db.from("events").select("*").eq("id", id).maybeSingle();
      if (!data) throw notFound();
      return data as EventRow;
    },
  });

  const attendeesQ = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: async (): Promise<Attendee[]> => {
      const { data } = await db.from("event_attendees").select("user_id, status").eq("event_id", id);
      const rows = (data ?? []) as { user_id: string; status: Attendee["status"] }[];
      if (!rows.length) return [];
      const ids = rows.map((r) => r.user_id);
      const { data: profiles } = await db
        .from("profiles")
        .select("id, full_name, username, avatar_url, plan")
        .in("id", ids);
      const map = new Map<string, AuthorMini>(((profiles ?? []) as AuthorMini[]).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    },
  });

  const feedQ = useQuery({
    queryKey: ["event-feed", id, user?.id ?? "anon"],
    queryFn: () => fetchFeed(user?.id ?? null, { eventId: id }),
  });

  const myAttendance = attendeesQ.data?.find((a) => a.user_id === user?.id)?.status ?? null;
  const goingList = (attendeesQ.data ?? []).filter((a) => a.status === "going");
  const interestedList = (attendeesQ.data ?? []).filter((a) => a.status === "interested");

  const setRSVP = async (status: "going" | "interested" | "not_going") => {
    if (!user) return toast.error("Sign in to RSVP");
    const next = myAttendance === status ? null : status;
    try {
      await setAttendance(id, user.id, next);
      qc.invalidateQueries({ queryKey: ["event-attendees", id] });
      qc.invalidateQueries({ queryKey: ["attendee-counts"] });
      toast.success(next === "going" ? "You're going!" : next === "interested" ? "Marked as interested" : next === "not_going" ? "Not attending" : "RSVP cleared");
    } catch {
      toast.error("Could not update RSVP");
    }
  };

  if (eventQ.isLoading) {
    return <PageContainer><AppHeader title="Event" /><div className="glass mx-4 mt-5 h-64 animate-pulse rounded-2xl" /></PageContainer>;
  }
  if (!eventQ.data) {
    return <PageContainer><AppHeader title="Event" /><div className="p-8 text-center text-muted-foreground">Event not found.</div></PageContainer>;
  }

  const event = eventQ.data;
  const date = new Date(event.kickoff);

  return (
    <PageContainer>
      <AppHeader title="Event" />

      <div className="px-4 pt-3">
        <Link to="/events" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>
      </div>

      <section className="px-4 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          {event.competition ?? event.event_type.replace("_", " ")}
        </div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">{event.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-primary" /> {date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          {event.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.venue}</span>}
          {event.city && <span>· {event.city}</span>}
        </div>
        {event.description && <p className="mt-3 text-sm text-foreground/90">{event.description}</p>}
      </section>

      {/* RSVP */}
      <section className="mt-5 px-4">
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Are you going?</div>
          <div className="grid grid-cols-3 gap-2">
            <RsvpBtn active={myAttendance === "going"} onClick={() => setRSVP("going")} icon={<Check className="h-4 w-4" />} label="Going" tone="primary" />
            <RsvpBtn active={myAttendance === "interested"} onClick={() => setRSVP("interested")} icon={<Star className="h-4 w-4" />} label="Interested" />
            <RsvpBtn active={myAttendance === "not_going"} onClick={() => setRSVP("not_going")} icon={<XIcon className="h-4 w-4" />} label="Can't go" />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-primary" /> {goingList.length} going · {interestedList.length} interested</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="mt-5 px-4">
        <div className="glass grid grid-cols-2 rounded-xl p-1">
          <button onClick={() => setTab("feed")} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === "feed" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Discussion</button>
          <button onClick={() => setTab("attendees")} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === "attendees" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Who's going</button>
        </div>
      </section>

      {tab === "feed" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <CreatePost eventId={id} onPosted={() => feedQ.refetch()} />
          {feedQ.data?.map((p) => <PostCard key={p.id} post={p} onChange={() => feedQ.refetch()} />)}
          {feedQ.data?.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No posts yet. Be the first to start the conversation.
            </div>
          )}
        </section>
      )}

      {tab === "attendees" && (
        <section className="mt-4 px-4 pb-32 space-y-4">
          <AttendeesGroup title={`Going · ${goingList.length}`} list={goingList} />
          {interestedList.length > 0 && <AttendeesGroup title={`Interested · ${interestedList.length}`} list={interestedList} />}
        </section>
      )}
    </PageContainer>
  );
}

function RsvpBtn({ active, onClick, icon, label, tone }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone?: "primary" }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition ${
        active ? (tone === "primary" ? "bg-primary text-primary-foreground" : "bg-surface-2 ring-1 ring-primary text-foreground") : "bg-surface-2 text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function AttendeesGroup({ title, list }: { title: string; list: Attendee[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((a) => (
          <Link key={a.user_id} to="/u/$id" params={{ id: a.user_id }} className="glass flex items-center gap-2 rounded-xl p-2.5 transition hover:ring-glow-gold">
            <UserAvatar name={a.profile?.full_name} src={a.profile?.avatar_url} size={36} ring={a.profile?.plan === "vip" ? "gold" : null} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold">{a.profile?.full_name ?? "Supporter"}</div>
              {a.profile?.username && <div className="truncate text-[10px] text-muted-foreground">@{a.profile.username}</div>}
            </div>
          </Link>
        ))}
        {list.length === 0 && <div className="col-span-full text-xs text-muted-foreground">Nobody yet.</div>}
      </div>
    </div>
  );
}
