import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { listConversations } from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — SAFC" }] }),
  component: MessagesInbox,
});

function MessagesInbox() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => listConversations(user!.id),
    enabled: !!user,
    refetchInterval: 10_000,
  });
  return (
    <PageContainer>
      <AppHeader title="Messages" />
      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Inbox</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Your <span className="text-gradient-gold">conversations</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">Chat with supporters one-on-one in real time.</p>
      </section>
      <section className="mt-4 px-4 pb-32 space-y-2">
        {q.isLoading && <div className="glass h-20 animate-pulse rounded-2xl" />}
        {q.data?.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <MessageCircle className="mx-auto h-7 w-7 text-primary" />
            <div className="mt-2 font-display text-lg font-black">No messages yet</div>
            <p className="mt-1 text-sm text-muted-foreground">Visit a supporter's profile and tap Message to start a chat.</p>
            <Link to="/community" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground">
              <Plus className="h-3.5 w-3.5" /> Find supporters
            </Link>
          </div>
        )}
        {q.data?.map((c) => (
          <Link
            key={c.id}
            to="/messages/$id"
            params={{ id: c.id }}
            className="glass flex items-center gap-3 rounded-2xl p-3 transition hover:ring-glow-gold"
          >
            <UserAvatar name={c.other?.full_name} src={c.other?.avatar_url} size={48} ring={c.other?.plan === "gold" ? "gold" : null} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate font-display text-sm font-black">{c.other?.full_name ?? c.title ?? "Conversation"}</div>
                {c.unread > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-black text-primary-foreground">{c.unread}</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{c.last_message ?? "Say hi 👋"}</div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(c.last_message_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </div>
          </Link>
        ))}
      </section>
    </PageContainer>
  );
}
