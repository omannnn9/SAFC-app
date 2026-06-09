import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { joinEventChat } from "@/lib/event-chat.functions";
import { CalendarDays, MapPin, Users, ArrowLeft, Check, Star, X as XIcon, Clock, HelpCircle, Camera, Loader2, Radio } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { fetchFeed, fetchEventPhotos, uploadEventPhoto, fetchGroups, type AttendanceStatus } from "@/lib/social";
import { updateEventRsvp } from "@/lib/rsvp.functions";
import type { EventRow, AuthorMini, EventPhoto, GroupRow } from "@/lib/social";
import type { Plan } from "@/lib/plans";
import { effectiveTier } from "@/lib/tiers";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$id")({
  head: () => ({ meta: [{ title: "Event — SAFC" }] }),
  component: EventDetailPage,
});

type Attendee = { user_id: string; status: AttendanceStatus; profile: AuthorMini | null };

function useCountdown(target?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!target) return { d: 0, h: 0, m: 0, s: 0, past: true };
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, past: diff === 0 };
}

function EventDetailPage() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"feed" | "attendees" | "meetups" | "photos">("feed");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>();
  const [chatId, setChatId] = useState<string | null>(null);
  const [joiningChat, setJoiningChat] = useState(false);

  const eventQ = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data } = await db.from("events").select("*").eq("id", id).maybeSingle();
      if (!data) throw notFound();
      return data as EventRow;
    },
  });

  // Realtime live score
  useEffect(() => {
    const ch = supabase.channel(`event-${id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${id}` }, () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  // Realtime RSVP counts + attendee list
  useEffect(() => {
    const ch = supabase
      .channel(`event-attendees-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_attendees", filter: `event_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["event-attendees", id] });
        qc.invalidateQueries({ queryKey: ["attendee-counts"] });
        qc.invalidateQueries({ queryKey: ["my-events"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const attendeesQ = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: async (): Promise<Attendee[]> => {
      const { data } = await db.from("event_attendees").select("user_id, status").eq("event_id", id);
      const rows = (data ?? []) as { user_id: string; status: AttendanceStatus }[];
      if (!rows.length) return [];
      const ids = rows.map((r) => r.user_id);
      const { data: profiles } = await db.from("profiles").select("id, full_name, username, avatar_url, plan, tier").in("id", ids);
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

  const photosQ = useQuery({ queryKey: ["event-photos", id], queryFn: () => fetchEventPhotos(id) });
  const groupsQ = useQuery({ queryKey: ["event-groups", id], queryFn: () => fetchGroups({ eventId: id }) });

  const myAttendance = attendeesQ.data?.find((a) => a.user_id === user?.id)?.status ?? null;
  const goingList = (attendeesQ.data ?? []).filter((a) => a.status === "going");
  const interestedList = (attendeesQ.data ?? []).filter((a) => a.status === "interested");
  const maybeList = (attendeesQ.data ?? []).filter((a) => a.status === "maybe");
  // Priority placement: Founder first, Premium next, then Basic, then Free
  const sortByPlan = (list: Attendee[]) => [...list].sort((a, b) => {
    const r: Record<string, number> = { founder: 0, premium: 1, basic: 2, free: 3 };
    return (r[effectiveTier(a.profile)] ?? 9) - (r[effectiveTier(b.profile)] ?? 9);
  });
  const followingSet = followingQ.data ?? new Set<string>();
  const friendsGoing = goingList.filter((a) => followingSet.has(a.user_id));
  const event = eventQ.data;
  const cd = useCountdown(event?.kickoff);

  const setRSVP = async (status: AttendanceStatus) => {
    if (!user) return toast.error("Sign in to RSVP");
    const next = myAttendance === status ? null : status;
    try {
      const res = await updateEventRsvp({ data: { eventId: id, status: next } });
      qc.setQueryData<Attendee[]>(["event-attendees", id], (prev = []) => {
        const withoutMe = prev.filter((a) => a.user_id !== user.id);
        if (!next) return withoutMe;
        const me: AuthorMini = {
          id: user.id,
          full_name: profile?.full_name ?? user.email ?? "Supporter",
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          plan: (profile?.plan as Plan | undefined) ?? "bronze",
        };
        return [...withoutMe, { user_id: user.id, status: next, profile: me }];
      });
      qc.invalidateQueries({ queryKey: ["event-attendees", id] });
      qc.invalidateQueries({ queryKey: ["attendee-counts"] });
      qc.invalidateQueries({ queryKey: ["my-events"] });

      if ((next === "going" || next === "interested") && res.chatId) {
        qc.invalidateQueries({ queryKey: ["event-groups", id] });
        setChatId(res.chatId);
        if (next === "going") {
          toast.success("You're going · matchday chat unlocked");
          return;
        }
        toast.success("Marked as interested · matchday chat unlocked");
        return;
      }
      toast.success(
        next === "maybe" ? "Marked as maybe" :
        next === "not_going" ? "Not attending" : "RSVP cleared"
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not update RSVP";
      if (message.includes("Free supporters") || message.includes("Bronze members")) {
        setUpgradeReason(message);
        setUpgradeOpen(true);
        return;
      }
      toast.error("Could not update RSVP");
    }
  };

  // Look up existing chat id when user already RSVP'd (for the Join Chat button)
  useEffect(() => {
    if (!user || !myAttendance || (myAttendance !== "going" && myAttendance !== "interested")) {
      setChatId(null);
      return;
    }
    db.from("event_chats").select("id").eq("event_id", id).maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => setChatId(data?.id ?? null));
  }, [user, myAttendance, id]);

  const openChat = async () => {
    if (chatId) {
      navigate({ to: "/event-chat/$id", params: { id: chatId } });
      return;
    }
    setJoiningChat(true);
    try {
      const res = await joinEventChat({ data: { eventId: id } });
      navigate({ to: "/event-chat/$id", params: { id: res.chatId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoiningChat(false);
    }
  };

  if (eventQ.isLoading) return <PageContainer><AppHeader title="Event" /><div className="glass mx-4 mt-5 h-64 animate-pulse rounded-2xl" /></PageContainer>;
  if (!eventQ.data) return <PageContainer><AppHeader title="Event" /><div className="p-8 text-center text-muted-foreground">Event not found.</div></PageContainer>;

  if (!event) return <PageContainer><AppHeader title="Event" /><div className="p-8 text-center text-muted-foreground">Event not found.</div></PageContainer>;
  const date = new Date(event.kickoff);
  const isLive = event.status === "live";
  const isFinished = event.status === "finished";
  const isWC = event.event_type === "wc_match";

  return (
    <PageContainer>
      <AppHeader title="Event" />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentPlan={(profile?.plan as Plan | undefined) ?? "bronze"} feature="join_event" title="Bronze monthly limit reached" reason={upgradeReason} />

      <div className="px-4 pt-3">
        <Link to="/events" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>
      </div>

      {/* HEADER: Teams + flags */}
      <section className="px-4 pt-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          {event.competition ?? event.event_type.replace("_", " ")}
          {isWC && event.stage && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{event.stage}</span>}
        </div>

        {event.home_team && event.away_team ? (
          <div className="glass mt-3 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <Side flag={event.home_team_flag} name={event.home_team} />
              <div className="text-center">
                {isLive || isFinished ? (
                  <div className="font-display text-4xl font-black tracking-tighter">{event.home_score ?? 0}–{event.away_score ?? 0}</div>
                ) : (
                  <div className="font-display text-2xl font-black text-muted-foreground">vs</div>
                )}
                {isLive && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400">
                    <Radio className="h-2.5 w-2.5 animate-pulse" /> Live · {event.minute ?? 0}'
                  </div>
                )}
                {isFinished && <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full time</div>}
              </div>
              <Side flag={event.away_team_flag} name={event.away_team} />
            </div>
          </div>
        ) : (
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">{event.title}</h1>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-primary" /> {date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          {event.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.venue}</span>}
          {event.city && <span>· {event.city}</span>}
        </div>
        {event.description && <p className="mt-3 text-sm text-foreground/90">{event.description}</p>}
      </section>

      {/* Countdown (only when not live/finished) */}
      {!cd.past && !isLive && !isFinished && (
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
          <div className="grid grid-cols-4 gap-2">
            <RsvpBtn active={myAttendance === "going"} onClick={() => setRSVP("going")} icon={<Check className="h-4 w-4" />} label="Going" tone="primary" />
            <RsvpBtn active={myAttendance === "interested"} onClick={() => setRSVP("interested")} icon={<Star className="h-4 w-4" />} label="Interested" />
            <RsvpBtn active={myAttendance === "maybe"} onClick={() => setRSVP("maybe")} icon={<HelpCircle className="h-4 w-4" />} label="Maybe" />
            <RsvpBtn active={myAttendance === "not_going"} onClick={() => setRSVP("not_going")} icon={<XIcon className="h-4 w-4" />} label="Can't" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-primary" /> {goingList.length} going · {interestedList.length} interested · {maybeList.length} maybe</span>
            {(myAttendance === "going" || myAttendance === "interested") && (
              <button
                onClick={openChat}
                disabled={joiningChat}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-50"
              >
                {joiningChat ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Join chat
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Community Pulse — SAFC messaging + attendee avatars + chat + photo strip */}
      <section className="mt-4 px-4">
        <div className="relative overflow-hidden rounded-2xl p-4 ring-1 ring-white/10"
             style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--safc-pink) 18%, transparent), color-mix(in oklab, var(--safc-cobalt) 16%, transparent) 60%, transparent)" }}>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--safc-yellow)]/10 blur-3xl" />
          <div className="relative">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--safc-yellow)]">SAFC · Community pulse</div>
            <h3 className="mt-1 font-display text-xl font-black leading-tight">
              {goingList.length === 0
                ? "Be the first SAFC supporter going."
                : friendsGoing.length > 0
                ? "You're not attending alone."
                : `${goingList.length} ${goingList.length === 1 ? "supporter is" : "supporters are"} going.`}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {goingList.length === 0
                ? "Tap RSVP to open the matchday chat and rally the community."
                : "Meet supporters going to this match. Join the matchday conversation."}
            </p>

            {goingList.length > 0 && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {sortByPlan(friendsGoing.length > 0 ? friendsGoing : goingList).slice(0, 7).map((a) => (
                    <Link key={a.user_id} to="/u/$id" params={{ id: a.user_id }}>
                      <UserAvatar
                        name={a.profile?.full_name}
                        src={a.profile?.avatar_url}
                        size={38}
                        ring={effectiveTier(a.profile) === "founder" ? "gold" : null}
                        className="ring-2 ring-background"
                      />
                    </Link>
                  ))}
                  {goingList.length > 7 && (
                    <div className="grid h-[38px] w-[38px] place-items-center rounded-full bg-surface-2 text-[10px] font-black ring-2 ring-background">
                      +{goingList.length - 7}
                    </div>
                  )}
                </div>
                <button onClick={() => setTab("attendees")} className="ml-auto text-[10px] font-black uppercase tracking-wider text-primary">
                  View all →
                </button>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={openChat}
                disabled={joiningChat || !(myAttendance === "going" || myAttendance === "interested")}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow-pink)] disabled:opacity-50"
              >
                {joiningChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Matchday chat
              </button>
              <button
                onClick={() => setTab("feed")}
                className="glass-strong inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-wider"
              >
                Supporter activity
              </button>
            </div>
            {!(myAttendance === "going" || myAttendance === "interested") && (
              <p className="mt-2 text-[10px] text-muted-foreground">RSVP <span className="font-bold text-foreground">Going</span> or <span className="font-bold text-foreground">Interested</span> to unlock the chat.</p>
            )}
          </div>
        </div>
      </section>

      {/* Shared photos strip */}
      {(photosQ.data?.length ?? 0) > 0 && (
        <section className="mt-4 px-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Camera className="mr-1 inline h-3 w-3 text-primary" /> Shared from the stands
            </h3>
            <button onClick={() => setTab("photos")} className="text-[10px] font-black uppercase tracking-wider text-primary">View all →</button>
          </div>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none">
            {photosQ.data!.slice(0, 8).map((p) => (
              <button key={p.id} onClick={() => setTab("photos")} className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-surface-2">
                <img src={p.image_url} alt={p.caption ?? "Event photo"} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <section className="mt-4 px-4">
        <div className="glass grid grid-cols-4 rounded-xl p-1">
          {(["feed", "attendees", "photos", "meetups"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 text-[11px] font-black uppercase tracking-wider ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t === "feed" ? "Discuss" : t}</button>
          ))}
        </div>
      </section>

      {tab === "feed" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <CreatePost eventId={id} onPosted={() => feedQ.refetch()} />
          {feedQ.data?.map((p) => <PostCard key={p.id} post={p} onChange={() => feedQ.refetch()} />)}
          {feedQ.data?.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">Join the matchday conversation — every great supporters' movement starts here.</div>}
        </section>
      )}

      {tab === "attendees" && (
        <section className="mt-4 px-4 pb-32 space-y-4">
          <AttendeesGroup title={`Going · ${goingList.length}`} list={sortByPlan(goingList)} />
          {interestedList.length > 0 && <AttendeesGroup title={`Interested · ${interestedList.length}`} list={sortByPlan(interestedList)} />}
          {maybeList.length > 0 && <AttendeesGroup title={`Maybe · ${maybeList.length}`} list={sortByPlan(maybeList)} />}
        </section>
      )}

      {tab === "photos" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <PhotoUploader eventId={id} userId={user?.id} onUploaded={() => photosQ.refetch()} />
          {(photosQ.data?.length ?? 0) === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No photos yet. Share your view from the stands and build the SAFC story.</div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photosQ.data?.map((p) => (
                <a key={p.id} href={p.image_url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-surface-2">
                  <img src={p.image_url} alt={p.caption ?? "Event photo"} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "meetups" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <div className="glass rounded-2xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Travel & meetup groups</div>
            <p className="mt-1 text-sm text-muted-foreground">Coordinate with supporters travelling to and meeting at this event.</p>
            <Link to="/groups" search={{ event: id } as never} className="mt-3 inline-block rounded-lg bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground">Create a group</Link>
          </div>
          {(groupsQ.data?.length ?? 0) === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No groups yet for this event.</div>
          ) : (
            groupsQ.data?.map((g: GroupRow) => <GroupRowCard key={g.id} g={g} />)
          )}
        </section>
      )}
    </PageContainer>
  );
}

function Side({ flag, name }: { flag: string | null; name: string }) {
  const isImageFlag = !!flag && /^(https?:|\/|data:image)/.test(flag);
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
      {isImageFlag ? (
        <img src={flag} alt={name} className="h-10 w-10 rounded-full object-cover ring-2 ring-border" />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-2xl">
          {flag || name.slice(0, 2)}
        </div>
      )}
      <div className="text-xs font-black uppercase tracking-wider">{name}</div>
    </div>
  );
}

function RsvpBtn({ active, onClick, icon, label, tone }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone?: "primary" }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-wider transition ${active ? (tone === "primary" ? "bg-primary text-primary-foreground" : "bg-surface-2 ring-1 ring-primary text-foreground") : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}>
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
            <UserAvatar name={a.profile?.full_name} src={a.profile?.avatar_url} size={36} ring={effectiveTier(a.profile) === "founder" ? "gold" : null} />
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

function PhotoUploader({ eventId, userId, onUploaded }: { eventId: string; userId?: string; onUploaded: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (f: File) => {
    if (!userId) return toast.error("Sign in to upload");
    setBusy(true);
    try { await uploadEventPhoto(eventId, userId, f); onUploaded(); toast.success("Photo uploaded"); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <button onClick={() => ref.current?.click()} className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black uppercase tracking-wider hover:bg-white/5">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Upload photo
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </button>
  );
}

function GroupRowCard({ g }: { g: GroupRow }) {
  const typeColor: Record<string, string> = { travel: "bg-blue-500/20 text-blue-300", meetup: "bg-emerald-500/20 text-emerald-300", community: "bg-primary/15 text-primary", private: "bg-purple-500/20 text-purple-300", gold: "bg-[var(--sa-gold)]/20 text-[var(--sa-gold)]" };
  return (
    <Link to="/groups" search={{ id: g.id } as never} className="glass block rounded-2xl p-3 hover:bg-white/5">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${typeColor[g.type] ?? "bg-surface-2"}`}>{g.type}</span>
        <div className="font-display text-base font-black">{g.name}</div>
        <span className="ml-auto text-[11px] text-muted-foreground">{g.member_count} members</span>
      </div>
      {g.description && <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>}
    </Link>
  );
}
