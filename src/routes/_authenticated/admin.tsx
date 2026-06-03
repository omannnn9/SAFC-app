import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, Users, MessageSquare, Flag, CalendarDays, BarChart3, Loader2, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — SAFC" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) throw redirect({ to: "/login" });
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (!roles) throw redirect({ to: "/" });
  },
  component: AdminPage,
});

function AdminPage() {
  const [tab, setTab] = useState<"overview" | "users" | "posts" | "reports">("overview");

  return (
    <PageContainer>
      <AppHeader title="Admin" />
      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Admin</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          <Shield className="mr-2 inline h-7 w-7 text-primary" />Control room
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Moderate the supporter community.</p>
      </section>

      <section className="mt-5 px-4">
        <div className="glass grid grid-cols-4 rounded-xl p-1 text-[10px] font-black uppercase tracking-wider">
          {(["overview", "users", "posts", "reports"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </section>

      <section className="mt-4 px-4 pb-32">
        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersTab />}
        {tab === "posts" && <PostsTab />}
        {tab === "reports" && <ReportsTab />}
      </section>
    </PageContainer>
  );
}

function Overview() {
  const q = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const [users, posts, events, attendees, reports] = await Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("posts").select("id", { count: "exact", head: true }),
        db.from("events").select("id", { count: "exact", head: true }),
        db.from("event_attendees").select("user_id", { count: "exact", head: true }).eq("status", "going"),
        db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      return {
        users: users.count ?? 0, posts: posts.count ?? 0, events: events.count ?? 0,
        attendees: attendees.count ?? 0, reports: reports.count ?? 0,
      };
    },
  });
  if (!q.data) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-primary" />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label="Supporters" value={q.data.users} icon={<Users className="h-4 w-4" />} />
      <Stat label="Posts" value={q.data.posts} icon={<MessageSquare className="h-4 w-4" />} />
      <Stat label="Events" value={q.data.events} icon={<CalendarDays className="h-4 w-4" />} />
      <Stat label="Going RSVPs" value={q.data.attendees} icon={<BarChart3 className="h-4 w-4" />} />
      <Stat label="Open reports" value={q.data.reports} icon={<Flag className="h-4 w-4" />} />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{icon} <span className="ml-1">{label}</span></div>
      <div className="mt-2 font-display text-3xl font-black">{value}</div>
    </div>
  );
}

function UsersTab() {
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await db.from("profiles").select("id, full_name, username, avatar_url, plan, country, created_at").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      {q.data?.map((p: any) => (
        <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
          <UserAvatar name={p.full_name} src={p.avatar_url} size={40} ring={p.plan === "gold" ? "gold" : null} />
          <div className="min-w-0 flex-1">
            <Link to="/u/$id" params={{ id: p.id }} className="block truncate text-sm font-bold hover:text-primary">{p.full_name}</Link>
            <div className="text-[10px] text-muted-foreground">{p.username ? `@${p.username} · ` : ""}{p.country}</div>
          </div>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-black uppercase">{p.plan}</span>
        </div>
      ))}
    </div>
  );
}

function PostsTab() {
  const q = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data } = await db.from("posts").select("id, body, image_url, user_id, created_at").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const del = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await db.from("posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    q.refetch();
  };
  return (
    <div className="space-y-2">
      {q.data?.map((p: any) => (
        <div key={p.id} className="glass rounded-2xl p-3">
          <div className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
          {p.body && <div className="mt-1 line-clamp-3 text-sm">{p.body}</div>}
          {p.image_url && <img src={p.image_url} alt="" className="mt-2 max-h-40 rounded-lg" />}
          <button onClick={() => del(p.id)} className="mt-2 inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-[10px] font-bold text-destructive">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function ReportsTab() {
  const q = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data } = await db.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  const resolve = async (id: string) => {
    await db.from("reports").update({ status: "resolved" }).eq("id", id);
    q.refetch();
  };
  return (
    <div className="space-y-2">
      {q.data?.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No reports.</div>}
      {q.data?.map((r: any) => (
        <div key={r.id} className="glass rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase">{r.target_type}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.status === "open" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{r.reason}</div>
          <div className="mt-1 truncate text-[10px] text-muted-foreground">Target: {r.target_id}</div>
          {r.status === "open" && (
            <button onClick={() => resolve(r.id)} className="mt-2 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-bold text-primary">Mark resolved</button>
          )}
        </div>
      ))}
    </div>
  );
}
