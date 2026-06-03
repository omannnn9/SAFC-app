import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Users, ArrowLeft, Check, Star, X as XIcon, Clock } from "lucide-react";
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

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, past: diff === 0 };
}

function EventDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"feed" | "attendees" | "meetups">("feed");

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
      const { data: profiles } = await db.from("profiles").select("id, full_name, username, avatar_url, plan").in("id", ids);
      const map = new Map<string, AuthorMini>(((profiles ?? []) as AuthorMini[]).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
    },
  });

  const followingQ = useQuery({
    queryKey: ["my-following", user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data } = await db.from("follows").select("following_id").eq("follower_id", user.id);
      return new Set(((data ?? []) as { following_id: string }[]).map((r) => r.following_id));
    },
    enabled: !!user,
  });

  const feedQ = useQuery({
    queryKey: ["event-feed", id, user?.id ?? "anon"],
    queryFn: () => fetchFeed(user?.id ?? null, { eventId: id }),
  });

  const myAttendance = attendeesQ.data?.find((a) => a.user_id === user?.id)?.status ?? null;
  const goingList = (attendeesQ.data ?? []).filter((a) => a.status === "going");
  const interestedList = (attendeesQ.data ?? []).filter((a) => a.status === "interested");
  const followingSet = followingQ.data ?? new Set<string>();
  const friendsGoing = goingList.filter((a) => followingSet.has(a.user_id));

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
  const cd = useCountdown(event.kickoff);

  return (
    <PageContainer>
      <AppHeader title="Event" />

      <div className="px-4 pt-3">
        <Link to="/events" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>
      </div>

      <section className="px-4 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{event.competition ?? event.event_type.replace("_", " ")}</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">{event.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-primary" /> {date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          {event.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.venue}</span>}
          {event.city && <span>· {event.city}</span>}
        </div>
        {event.description && <p className="mt-3 text-sm text-foreground/90">{event.description}</p>}
      </section>

      {/* Countdown */}
      {!cd.past && (
        <section className="mt-4 px-4">
          <div className="glass rounded-2xl p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Clock className="mr-1 inline h-3 w-3 text-primary" /> Kickoff in
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[["Days", cd.d], ["Hours", cd.h], ["Min", cd.m], ["Sec", cd.s]].map(([label, v]) => (
                <div key={label as string} className="rounded-xl bg-surface-2 py-2">
                  <div className="font-display text-2xl font-black">{String(v).padStart(2, "0")}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* RSVP */}
      <section className="mt-4 px-4">
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

      {/* Friends going */}
      {friendsGoing.length > 0 && (
        <section className="mt-4 px-4">
          <div className="glass rounded-2xl p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">People you follow are going</div>
            <div className="flex -space-x-2">
              {friendsGoing.slice(0, 8).map((a) => (
                <Link key={a.user_id} to="/u/$id" params={{ id: a.user_id }}>
                  <UserAvatar name={a.profile?.full_name} src={a.profile?.avatar_url} size={32} className="ring-2 ring-background" />
                </Link>
              ))}
              {friendsGoing.length > 8 && <span className="ml-3 self-center text-xs text-muted-foreground">+{friendsGoing.length - 8} more</span>}
            </div>
          </div>
        </section>
      )}

      {/* Tabs */}
      <section className="mt-4 px-4">
        <div className="glass grid grid-cols-3 rounded-xl p-1">
          <button onClick={() => setTab("feed")} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === "feed" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Discussion</button>
          <button onClick={() => setTab("attendees")} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === "attendees" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Going</button>
          <button onClick={() => setTab("meetups")} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === "meetups" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Meetups</button>
        </div>
      </section>

      {tab === "feed" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <CreatePost eventId={id} onPosted={() => feedQ.refetch()} />
          {feedQ.data?.map((p) => <PostCard key={p.id} post={p} onChange={() => feedQ.refetch()} />)}
          {feedQ.data?.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No posts yet. Be the first to start the conversation.</div>
          )}
        </section>
      )}

      {tab === "attendees" && (
        <section className="mt-4 px-4 pb-32 space-y-4">
          <AttendeesGroup title={`Going · ${goingList.length}`} list={goingList} />
          {interestedList.length > 0 && <AttendeesGroup title={`Interested · ${interestedList.length}`} list={interestedList} />}
        </section>
      )}

      {tab === "meetups" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Coordinate a meetup</div>
            <p className="mt-1 text-sm">Use the discussion to plan where to meet before kickoff, share travel arrangements, or organise a fan zone group.</p>
            <CreatePost eventId={id} onPosted={() => feedQ.refetch()} />
          </div>
          {feedQ.data?.filter((p) => p.body && /\b(meet|kickoff|travel|drive|flight|bus|train)\b/i.test(p.body)).map((p) => (
            <PostCard key={p.id} post={p} onChange={() => feedQ.refetch()} />
          ))}
        </section>
      )}
    </PageContainer>
  );
}

function RsvpBtn({ active, onClick, icon, label, tone }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone?: "primary" }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition ${active ? (tone === "primary" ? "bg-primary text-primary-foreground" : "bg-surface-2 ring-1 ring-primary text-foreground") : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}>
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
