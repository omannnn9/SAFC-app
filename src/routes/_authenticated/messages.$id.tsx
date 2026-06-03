import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Send, Loader2, Check, CheckCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchMessages, sendMessage, markRead, subscribeToMessages, subscribeToPresence } from "@/lib/messaging";
import type { Message, PresenceMeta } from "@/lib/messaging";
import { uploadUserFile } from "@/lib/social";
import type { AuthorMini } from "@/lib/social";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({ meta: [{ title: "Chat — Bafana Connect" }] }),
  component: ThreadPage,
});

function ThreadPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState<AuthorMini | null>(null);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [presence, setPresence] = useState<Map<string, PresenceMeta>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const presenceApi = useRef<{ setTyping: (t: boolean) => Promise<void> } | null>(null);
  const otherIdRef = useRef<string | null>(null);

  // initial load
  useQuery({
    queryKey: ["thread-init", id],
    queryFn: async () => {
      const [msgs, partsRes] = await Promise.all([
        fetchMessages(id),
        db.from("conversation_participants").select("user_id, last_read_at").eq("conversation_id", id),
      ]);
      setMessages(msgs);
      const parts = (partsRes.data ?? []) as { user_id: string; last_read_at: string }[];
      const otherPart = parts.find((r) => r.user_id !== user?.id);
      if (otherPart) {
        otherIdRef.current = otherPart.user_id;
        setOtherLastRead(otherPart.last_read_at);
        const { data: prof } = await db.from("profiles").select("id, full_name, username, avatar_url, plan").eq("id", otherPart.user_id).maybeSingle();
        setOther((prof as AuthorMini) ?? null);
      }
      return true;
    },
    enabled: !!user,
  });

  // realtime messages
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToMessages(id, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      markRead(id, user.id);
    });
    return unsub;
  }, [id, user]);

  // presence
  useEffect(() => {
    if (!user) return;
    const api = subscribeToPresence(id, user.id, setPresence);
    presenceApi.current = api;
    return () => api.unsubscribe();
  }, [id, user]);

  // mark read on open
  useEffect(() => {
    if (user) markRead(id, user.id).then(() => qc.invalidateQueries({ queryKey: ["conversations"] }));
  }, [id, user, qc]);

  // scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const onTyping = (val: string) => {
    setText(val);
    presenceApi.current?.setTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => presenceApi.current?.setTyping(false), 1500);
  };

  const onSend = async () => {
    if (!user || (!text.trim() && !busy)) return;
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      await sendMessage(id, user.id, body, null);
    } catch (e) {
      toast.error("Couldn't send");
      setText(body);
    }
  };

  const onImage = async (f: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const url = await uploadUserFile(user.id, f, "msg");
      await sendMessage(id, user.id, null, url);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const someoneTyping = Array.from(presence.values()).some((p) => p.typing && Date.now() - p.lastTyped < 4000);

  if (!user) return null;

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader title="Chat" />
      <div className="glass mx-4 mt-3 flex items-center gap-3 rounded-2xl p-3">
        <button onClick={() => navigate({ to: "/messages" })} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/5">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <UserAvatar name={other?.full_name} src={other?.avatar_url} size={40} ring={other?.plan === "gold" ? "gold" : null} />
        <Link to="/u/$id" params={{ id: other?.id ?? "" }} className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-black">{other?.full_name ?? "Supporter"}</div>
          <div className="text-[10px] text-muted-foreground">
            {someoneTyping ? <span className="text-primary">typing…</span> : presence.size > 0 ? "Online" : "Offline"}
          </div>
        </Link>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground"}`}>
                {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                {m.image_url && <img src={m.image_url} alt="" className="mt-1 max-h-72 rounded-lg" />}
                <div className={`mt-1 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Say hello 👋</div>
        )}
      </div>

      <div className="glass mx-4 mb-[max(env(safe-area-inset-bottom),12px)] flex items-end gap-2 rounded-2xl p-2">
        <button onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
        <textarea
          value={text}
          onChange={(e) => onTyping(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
        />
        <button onClick={onSend} disabled={!text.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
