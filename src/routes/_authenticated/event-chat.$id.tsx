import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Users, Loader2, Clock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import type { AuthorMini, EventRow } from "@/lib/social";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/event-chat/$id")({
  head: () => ({ meta: [{ title: "Event chat — SAFC" }] }),
  component: EventChatPage,
});

type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function useCountdown(target?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return "Kicked off";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function EventChatPage() {
  const { id: chatId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const initQ = useQuery({
    queryKey: ["event-chat-init", chatId],
    enabled: !!user,
    queryFn: async () => {
      const { data: chat } = await db
        .from("event_chats")
        .select("id, event_id")
        .eq("id", chatId)
        .maybeSingle();
      if (!chat) throw new Error("Chat not found or no access");
      const eventId = (chat as { event_id: string }).event_id;
      const [{ data: evt }, { data: msgs }, { data: mems }] = await Promise.all([
        db.from("events").select("*").eq("id", eventId).maybeSingle(),
        db
          .from("event_chat_messages")
          .select("id, chat_id, sender_id, body, created_at")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true })
          .limit(300),
        db.from("event_chat_members").select("user_id").eq("chat_id", chatId),
      ]);
      const memberIds = ((mems ?? []) as { user_id: string }[]).map((r) => r.user_id);
      const { data: profs } = memberIds.length
        ? await db
            .from("profiles")
            .select("id, full_name, username, avatar_url, plan")
            .in("id", memberIds)
        : { data: [] };
      setMessages((msgs ?? []) as ChatMessage[]);
      return {
        event: (evt as EventRow | null) ?? null,
        members: (profs ?? []) as AuthorMini[],
      };
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`event-chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_chat_messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [chatId]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const event = initQ.data?.event ?? null;
  const members = initQ.data?.members ?? [];
  const profMap = new Map(members.map((p) => [p.id, p]));
  const countdown = useCountdown(event?.kickoff);

  const onSend = async () => {
    if (!user) return;
    const body = text.trim();
    if (!body) return;
    setText("");
    setBusy(true);
    const { error } = await db
      .from("event_chat_messages")
      .insert({ chat_id: chatId, sender_id: user.id, body });
    if (error) {
      toast.error("Couldn't send");
      setText(body);
    }
    setBusy(false);
  };

  if (!user) return null;

  const headerLabel = event?.home_team && event?.away_team
    ? `${event.home_team} vs ${event.away_team}`
    : event?.title ?? "Event chat";

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader title="Event chat" />

      {/* Header card */}
      <div className="glass mx-4 mt-3 flex items-center gap-3 rounded-2xl p-3">
        <button
          onClick={() => navigate({ to: "/events/$id", params: { id: event?.id ?? "" } })}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-black uppercase tracking-wide">
            {headerLabel}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            {countdown && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Clock className="h-3 w-3" /> {countdown}
              </span>
            )}
            <span>· {members.length} supporters</span>
          </div>
        </div>
        <button
          onClick={() => setShowMembers((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-muted-foreground hover:text-foreground"
          aria-label="Members"
        >
          <Users className="h-4 w-4" />
        </button>
      </div>

      {/* Members drawer */}
      {showMembers && (
        <div className="glass mx-4 mt-2 rounded-2xl p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Participants · {members.length}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((p) => (
              <Link
                key={p.id}
                to="/u/$id"
                params={{ id: p.id }}
                className="flex items-center gap-2 rounded-lg bg-surface-2 p-2"
              >
                <UserAvatar name={p.full_name} src={p.avatar_url} size={28} ring={p.plan === "gold" ? "gold" : null} />
                <span className="truncate text-xs font-semibold">{p.full_name ?? "Supporter"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {initQ.isLoading && <div className="glass h-20 animate-pulse rounded-2xl" />}
        {!initQ.isLoading && messages.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Be the first to say something. The chat is live for everyone going.
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === user.id;
          const prof = profMap.get(m.sender_id);
          const showAuthor = !mine && (i === 0 || messages[i - 1].sender_id !== m.sender_id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground"}`}>
                {showAuthor && (
                  <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    {prof?.full_name ?? "Supporter"}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={`mt-1 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="glass mx-4 mb-[max(env(safe-area-inset-bottom),12px)] flex items-end gap-2 rounded-2xl p-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder="Message the matchday crew…"
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
          maxLength={2000}
        />
        <button
          onClick={onSend}
          disabled={!text.trim() || busy}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
