/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  Shield, Users, MessageSquare, Flag, CalendarDays, BarChart3, Loader2,
  Trash2, ScrollText, Tag, Check, X, Save, Eye, EyeOff, Download, ChevronDown, ChevronRight, Mail, Phone, MapPin, Calendar,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { AdminEventsTab } from "@/components/admin/AdminEventsTab";
import { WorldCupImportTab } from "@/components/admin/WorldCupImportTab";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { adminDeleteUser, adminDeletePost, adminResolveReport, adminUpdatePlan, adminListUsersDetailed, adminExportUsersCsv } from "@/lib/admin.functions";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

type Tab = "overview" | "users" | "events" | "import" | "posts" | "reports" | "plans" | "audit";

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

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "events", label: "Events" },
  { id: "import", label: "WC Import" },
  { id: "posts", label: "Posts" },
  { id: "reports", label: "Reports" },
  { id: "plans", label: "Plans" },
  { id: "audit", label: "Audit" },
];

function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <PageContainer>
      <AppHeader title="Super Admin" />
      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Super Admin</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          <Shield className="mr-2 inline h-7 w-7 text-primary" />Control room
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Full visibility. Every action is logged.</p>
      </section>

      <section className="mt-5 px-4">
        <div className="glass grid grid-cols-3 gap-1 rounded-xl p-1 text-[10px] font-black uppercase tracking-wider sm:grid-cols-4 lg:grid-cols-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg py-2 ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 px-4 pb-32">
        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersTab />}
        {tab === "events" && <AdminEventsTab />}
        {tab === "import" && <WorldCupImportTab />}
        {tab === "posts" && <PostsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "plans" && <PlansTab />}
        {tab === "audit" && <AuditTab />}
      </section>
    </PageContainer>
  );
}

function Overview() {
  const q = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const [users, posts, events, attendees, reports, logs] = await Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("posts").select("id", { count: "exact", head: true }),
        db.from("events").select("id", { count: "exact", head: true }),
        db.from("event_attendees").select("user_id", { count: "exact", head: true }).eq("status", "going"),
        db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        db.from("audit_logs").select("id", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0, posts: posts.count ?? 0, events: events.count ?? 0,
        attendees: attendees.count ?? 0, reports: reports.count ?? 0, logs: logs.count ?? 0,
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
      <Stat label="Audit entries" value={q.data.logs} icon={<ScrollText className="h-4 w-4" />} />
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
      const { data } = await db.from("profiles").select("id, full_name, username, avatar_url, plan, country, is_private, created_at").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  const deleteUser = useServerFn(adminDeleteUser);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleDelete = async (p: any) => {
    if (!confirm(`Permanently delete ${p.full_name || p.username || p.id}? This wipes their account and all related data.`)) return;
    setBusyId(p.id);
    try {
      await deleteUser({ data: { userId: p.id } });
      await logAudit("DELETE", "user", p.id, p, null);
      toast.success("User deleted");
      q.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      {q.data?.map((p: any) => (
        <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
          <UserAvatar name={p.full_name} src={p.avatar_url} size={40} ring={p.plan === "gold" ? "gold" : null} />
          <div className="min-w-0 flex-1">
            <Link to="/u/$id" params={{ id: p.id }} className="block truncate text-sm font-bold hover:text-primary">{p.full_name}</Link>
            <div className="text-[10px] text-muted-foreground">
              {p.username ? `@${p.username} · ` : ""}{p.country}
              {p.is_private && <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase">Private</span>}
            </div>
          </div>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-black uppercase">{p.plan}</span>
          <button
            onClick={() => handleDelete(p)}
            disabled={busyId === p.id}
            className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-[10px] font-bold text-destructive disabled:opacity-50"
            title="Delete user"
          >
            {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      ))}
    </div>
  );
}

function PostsTab() {
  const deletePost = useServerFn(adminDeletePost);
  const q = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data } = await db.from("posts").select("id, body, image_url, user_id, created_at").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const del = async (post: any) => {
    if (!confirm("Delete this post?")) return;
    try {
      await deletePost({ data: { postId: post.id } });
      await logAudit("DELETE", "post", post.id, post, null);
      toast.success("Deleted");
      q.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-2">
      {q.data?.map((p: any) => (
        <div key={p.id} className="glass rounded-2xl p-3">
          <div className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
          {p.body && <div className="mt-1 line-clamp-3 text-sm">{p.body}</div>}
          {p.image_url && <img src={p.image_url} alt="" className="mt-2 max-h-40 rounded-lg" />}
          <button onClick={() => del(p)} className="mt-2 inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-[10px] font-bold text-destructive">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function ReportsTab() {
  const resolveReport = useServerFn(adminResolveReport);
  const q = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data } = await db.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  const resolve = async (r: any) => {
    try {
      await resolveReport({ data: { reportId: r.id } });
      await logAudit("UPDATE", "report", r.id, { status: r.status }, { status: "resolved" });
      q.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
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
            <button onClick={() => resolve(r)} className="mt-2 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-bold text-primary">Mark resolved</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- PLANS ----------
function PlansTab() {
  const q = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data } = await db.from("plans").select("*").order("sort_order", { ascending: true });
      return data ?? [];
    },
  });
  if (!q.data) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-primary" />;
  return (
    <div className="space-y-3">
      {q.data.map((p: any) => <PlanRow key={p.id} plan={p} onSaved={() => q.refetch()} />)}
    </div>
  );
}

function PlanRow({ plan, onSaved }: { plan: any; onSaved: () => void }) {
  const updatePlan = useServerFn(adminUpdatePlan);
  const [name, setName] = useState(plan.name);
  const [tagline, setTagline] = useState(plan.tagline ?? "");
  const [priceRand, setPriceRand] = useState((plan.price_cents / 100).toFixed(2));
  const [perksText, setPerksText] = useState((plan.perks as string[]).join("\n"));
  const [visible, setVisible] = useState<boolean>(plan.visible);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const cents = Math.round(parseFloat(priceRand) * 100);
    if (Number.isNaN(cents) || cents < 0) return toast.error("Invalid price");
    const perks = perksText.split("\n").map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    try {
      await updatePlan({ data: { planId: plan.id, name, tagline: tagline || null, price_cents: cents, perks, visible } });
      toast.success(`${plan.id} saved · logged to audit`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass space-y-2 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <span className="font-display text-lg font-black uppercase">{plan.id}</span>
        </div>
        <button
          onClick={() => setVisible((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${visible ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted-foreground"}`}
        >
          {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {visible ? "Visible" : "Hidden"}
        </button>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm" placeholder="Display name" />
      <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm" placeholder="Tagline" />
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase text-muted-foreground">R</span>
        <input value={priceRand} onChange={(e) => setPriceRand(e.target.value)} className="w-32 rounded-lg bg-surface-2 px-3 py-2 text-sm" />
        <span className="text-[11px] text-muted-foreground">/ month</span>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Perks (one per line)</div>
        <textarea value={perksText} onChange={(e) => setPerksText(e.target.value)} rows={8} className="w-full rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs" />
      </div>
      <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
      </button>
    </div>
  );
}

// ---------- AUDIT LOGS ----------
function AuditTab() {
  const [action, setAction] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [month, setMonth] = useState<string>(""); // YYYY-MM
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["audit-logs", action, target, month],
    queryFn: async () => {
      let qb = db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
      if (action) qb = qb.eq("action_type", action);
      if (target) qb = qb.eq("target_type", target);
      if (month) {
        const start = `${month}-01T00:00:00Z`;
        const [y, m] = month.split("-").map(Number);
        const next = new Date(Date.UTC(y, m, 1)).toISOString();
        qb = qb.gte("created_at", start).lt("created_at", next);
      }
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!q.data) return [];
    if (!search) return q.data;
    const s = search.toLowerCase();
    return q.data.filter((r: any) =>
      (r.actor_email ?? "").toLowerCase().includes(s) ||
      (r.target_id ?? "").toLowerCase().includes(s) ||
      JSON.stringify(r.before_value ?? "").toLowerCase().includes(s) ||
      JSON.stringify(r.after_value ?? "").toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const actions = useMemo(() => Array.from(new Set((q.data ?? []).map((r: any) => r.action_type))) as string[], [q.data]);
  const targets = useMemo(() => Array.from(new Set((q.data ?? []).map((r: any) => r.target_type))) as string[], [q.data]);

  return (
    <div className="space-y-3">
      <div className="glass space-y-2 rounded-2xl p-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          <ScrollText className="mr-1 inline h-3 w-3" /> Immutable audit trail · super-admin only
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs" />
          <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs">
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs">
            <option value="">All targets</option>
            {targets.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email / id / value" className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs" />
        </div>
      </div>

      {!q.data && <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-primary" />}
      {q.data && filtered.length === 0 && (
        <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No audit entries match.</div>
      )}

      <div className="space-y-2">
        {filtered.map((r: any) => <AuditRow key={r.id} row={r} />)}
      </div>
    </div>
  );
}

function AuditRow({ row }: { row: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-2xl p-3 text-xs">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-black uppercase text-primary">{row.action_type}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase">{row.target_type}</span>
            {row.actor_role === "super_admin" && (
              <span className="rounded-full bg-[var(--safc-yellow)]/15 px-2 py-0.5 text-[9px] font-black uppercase text-[var(--safc-yellow)]">SA</span>
            )}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {row.actor_email ?? "system"} · {row.target_id ?? "—"}
          </div>
        </div>
        <div className="ml-3 shrink-0 text-right text-[10px] text-muted-foreground">
          {new Date(row.created_at).toLocaleString()}
        </div>
      </button>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <DiffBlock title="Before" value={row.before_value} />
          <DiffBlock title="After" value={row.after_value} />
          {row.metadata && <div className="sm:col-span-2"><DiffBlock title="Metadata" value={row.metadata} /></div>}
        </div>
      )}
    </div>
  );
}

function DiffBlock({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2">
      <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{title}</div>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px]">{value ? JSON.stringify(value, null, 2) : "—"}</pre>
    </div>
  );
}

// Suppress unused warnings for icons potentially trimmed by future edits
void Check; void X;
