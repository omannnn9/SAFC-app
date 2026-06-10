import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Plus, Plane, MapPin, Crown, Lock, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchGroups, createGroup, joinGroup, leaveGroup, type GroupRow } from "@/lib/social";
import { canUseFeature, planMeets, type Plan, type Feature, FEATURE_MIN_PLAN } from "@/lib/plans";
import { planToTier, effectiveTier } from "@/lib/tiers";
import { toast } from "sonner";

type Search = { event?: string; id?: string; type?: GroupRow["type"] };

export const Route = createFileRoute("/groups")({
  head: () => ({ meta: [{ title: "Groups — SA FC" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    event: typeof s.event === "string" ? s.event : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
    type: typeof s.type === "string" ? (s.type as GroupRow["type"]) : undefined,
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user, profile } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const plan: Plan = (profile?.plan as Plan | undefined) ?? "bronze";
  const [creating, setCreating] = useState(false);
  const [upgrade, setUpgrade] = useState<{ open: boolean; feature?: Feature; reason?: string }>({ open: false });

  const groupsQ = useQuery({ queryKey: ["groups-list", search.event, search.type], queryFn: () => fetchGroups({ eventId: search.event, type: search.type, limit: 100 }) });

  // Filter Gold-only groups for non-Gold users
  const visible = (groupsQ.data ?? []).filter((g) => planMeets(plan, g.min_plan));

  const tryCreate = (type: GroupRow["type"]) => {
    const feat: Feature | null = type === "travel" ? "create_travel_group" : type === "private" ? "create_private_group" : type === "gold" ? "gold_communities" : "create_meetup_group";
    if (!canUseFeature(plan, feat)) {
      setUpgrade({ open: true, feature: feat, reason: `Creating ${type} groups requires a higher plan.` });
      return;
    }
    setCreating(true);
  };

  return (
    <PageContainer>
      <AppHeader title="Groups" />
      <UpgradeModal open={upgrade.open} onClose={() => setUpgrade({ open: false })} currentTier={effectiveTier(profile)} targetTier={upgrade.feature ? planToTier(FEATURE_MIN_PLAN[upgrade.feature]) : "premium"} reason={upgrade.reason} />

      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Groups</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Travel, meetup & community <span className="text-gradient-gold">groups</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect with supporters travelling to the same events, or running meetups in your city.</p>
      </section>

      <section className="mt-4 px-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => tryCreate("meetup")} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-300"><Plus className="h-3 w-3" /> Meetup</button>
          <button onClick={() => tryCreate("travel")} className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-blue-300"><Plane className="h-3 w-3" /> Travel</button>
          <button onClick={() => tryCreate("private")} className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-purple-300"><Lock className="h-3 w-3" /> Private</button>
          <button onClick={() => tryCreate("gold")} className="inline-flex items-center gap-1 rounded-full bg-[var(--sa-gold)]/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[var(--sa-gold)]"><Crown className="h-3 w-3" /> Gold-only</button>
        </div>
      </section>

      {creating && user && (
        <CreateGroupForm eventId={search.event ?? null} userId={user.id} plan={plan} onDone={(id) => { setCreating(false); qc.invalidateQueries({ queryKey: ["groups-list"] }); if (id) navigate({ to: "/groups", search: { id } }); }} onCancel={() => setCreating(false)} />
      )}

      <section className="mt-4 px-4 pb-32 space-y-3">
        {groupsQ.isLoading && <div className="glass h-24 animate-pulse rounded-2xl" />}
        {visible.length === 0 && !groupsQ.isLoading && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No groups yet. Create the first one.</div>
        )}
        {visible.map((g) => <GroupCard key={g.id} g={g} userId={user?.id} onChange={() => qc.invalidateQueries({ queryKey: ["groups-list"] })} />)}
      </section>
    </PageContainer>
  );
}

function CreateGroupForm({ eventId, userId, plan, onDone, onCancel }: { eventId: string | null; userId: string; plan: Plan; onDone: (id?: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<GroupRow["type"]>("meetup");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (name.trim().length < 3) return toast.error("Name too short");
    setBusy(true);
    try {
      const id = await createGroup({
        event_id: eventId, type, name: name.trim(), description: description.trim() || null,
        city: city.trim() || null, country: null, cover_url: null, is_private: type === "private",
        min_plan: type === "gold" ? "gold" : "bronze", owner_id: userId,
      });
      toast.success(`Group "${name}" created`);
      onDone(id);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="glass mx-4 mt-4 rounded-2xl p-4 space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary">New {plan} group</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary" />
      <select value={type} onChange={(e) => setType(e.target.value as GroupRow["type"])} className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary">
        <option value="meetup">Meetup</option>
        <option value="travel">Travel</option>
        <option value="community">Community</option>
        <option value="private">Private (Gold)</option>
        <option value="gold">Gold-only</option>
      </select>
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group about?" rows={3} className="w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg bg-surface-2 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Cancel</button>
        <button onClick={submit} disabled={busy} className="flex-1 rounded-lg bg-primary py-2 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create"}</button>
      </div>
    </div>
  );
}

function GroupCard({ g, userId, onChange }: { g: GroupRow; userId?: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<boolean | null>(null);
  // Lazy check membership
  useQuery({
    queryKey: ["group-member", g.id, userId ?? "anon"],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await db.from("group_members").select("user_id").eq("group_id", g.id).eq("user_id", userId).maybeSingle();
      const m = !!data;
      setMember(m);
      return m;
    },
    enabled: !!userId,
  });
  const toggle = async () => {
    if (!userId) return toast.error("Sign in first");
    setBusy(true);
    try {
      if (member) { await leaveGroup(g.id, userId); setMember(false); toast.success("Left group"); }
      else { await joinGroup(g.id, userId); setMember(true); toast.success("Joined group"); }
      onChange();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  const typeColor: Record<string, string> = { travel: "bg-blue-500/20 text-blue-300", meetup: "bg-emerald-500/20 text-emerald-300", community: "bg-primary/15 text-primary", private: "bg-purple-500/20 text-purple-300", gold: "bg-[var(--sa-gold)]/20 text-[var(--sa-gold)]" };
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${typeColor[g.type] ?? "bg-surface-2"}`}>{g.type}</span>
        <div className="font-display text-base font-black">{g.name}</div>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" /> {g.member_count}</span>
      </div>
      {g.city && <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" /> {g.city}</div>}
      {g.description && <p className="mt-2 text-sm text-foreground/90">{g.description}</p>}
      {g.event_id && (
        <Link to="/events/$id" params={{ id: g.event_id }} className="mt-2 inline-block text-[11px] font-semibold text-primary hover:underline">View related event →</Link>
      )}
      <button onClick={toggle} disabled={busy} className={`mt-3 w-full rounded-xl py-2 text-xs font-black uppercase tracking-wider transition disabled:opacity-60 ${member ? "bg-surface-2 text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
        {busy ? "…" : member ? "Leave group" : "Join group"}
      </button>
    </div>
  );
}
