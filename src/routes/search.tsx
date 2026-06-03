import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search as SearchIcon, Users, CalendarDays, MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { db } from "@/lib/db";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Bafana Connect" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const term = q.trim();

  const sQ = useQuery({
    queryKey: ["search", term],
    queryFn: async () => {
      if (term.length < 2) return { people: [], events: [], posts: [] };
      const like = `%${term}%`;
      const [{ data: people }, { data: events }, { data: posts }] = await Promise.all([
        db.from("profiles").select("id, full_name, username, avatar_url, plan, city").or(`full_name.ilike.${like},username.ilike.${like},favourite_team.ilike.${like},city.ilike.${like}`).limit(15),
        db.from("events").select("id, title, kickoff, venue").or(`title.ilike.${like},competition.ilike.${like},venue.ilike.${like},city.ilike.${like}`).limit(15),
        db.from("posts").select("id, body, user_id, created_at").ilike("body", like).limit(15),
      ]);
      return { people: people ?? [], events: events ?? [], posts: posts ?? [] };
    },
    enabled: term.length >= 2,
  });

  return (
    <PageContainer>
      <AppHeader title="Search" />
      <section className="px-4 pt-5">
        <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search supporters, events, posts…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </label>
      </section>
      <section className="mt-4 px-4 pb-32 space-y-6">
        {term.length < 2 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">Type at least 2 characters to search.</div>}
        {sQ.data && (
          <>
            <Group icon={<Users className="h-3 w-3 text-primary" />} label={`People · ${sQ.data.people.length}`}>
              {sQ.data.people.map((p: any) => (
                <Link key={p.id} to="/u/$id" params={{ id: p.id }} className="glass flex items-center gap-3 rounded-xl p-2.5">
                  <UserAvatar name={p.full_name} src={p.avatar_url} size={40} ring={p.plan === "vip" ? "gold" : null} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{p.full_name}</div>
                    {p.username && <div className="text-[10px] text-muted-foreground">@{p.username}{p.city ? ` · ${p.city}` : ""}</div>}
                  </div>
                </Link>
              ))}
              {sQ.data.people.length === 0 && <Empty label="No supporters" />}
            </Group>

            <Group icon={<CalendarDays className="h-3 w-3 text-primary" />} label={`Events · ${sQ.data.events.length}`}>
              {sQ.data.events.map((e: any) => (
                <Link key={e.id} to="/events/$id" params={{ id: e.id }} className="glass flex items-center gap-3 rounded-xl p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{e.title}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(e.kickoff).toLocaleString()} {e.venue ? `· ${e.venue}` : ""}</div>
                  </div>
                </Link>
              ))}
              {sQ.data.events.length === 0 && <Empty label="No events" />}
            </Group>

            <Group icon={<MessageSquare className="h-3 w-3 text-primary" />} label={`Posts · ${sQ.data.posts.length}`}>
              {sQ.data.posts.map((p: any) => (
                <div key={p.id} className="glass rounded-xl p-3 text-sm">{p.body}</div>
              ))}
              {sQ.data.posts.length === 0 && <Empty label="No posts" />}
            </Group>
          </>
        )}
      </section>
    </PageContainer>
  );
}

function Group({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{icon} <span className="ml-1">{label}</span></h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Empty({ label }: { label: string }) {
  return <div className="glass rounded-xl p-4 text-center text-xs text-muted-foreground">{label}</div>;
}
