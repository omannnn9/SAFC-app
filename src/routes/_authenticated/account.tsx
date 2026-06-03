import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Loader2, LogOut, Check, Camera, Bell, KeyRound, Shield, Sparkles, Star } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { PlanBadge } from "@/components/PlanBadge";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { uploadUserFile, computeProfileCompletion } from "@/lib/social";
import { PLANS, planTone, type Plan } from "@/lib/plans";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account — Bafana Connect" }] }),
  component: AccountPage,
});

const INTEREST_OPTIONS = [
  "Bafana Bafana", "AFCON", "FIFA World Cup", "PSL", "Kaizer Chiefs", "Orlando Pirates",
  "Mamelodi Sundowns", "Banyana Banyana", "Travel", "Stadium photography", "Tactics", "Fantasy football",
];

function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"profile" | "subscription" | "settings">("profile");

  const isAdminQ = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const onLogout = async () => { await signOut(); toast.success("Signed out"); navigate({ to: "/" }); };

  if (!user) return null;
  const currentPlan: Plan = (profile?.plan as Plan | undefined) ?? "bronze";
  const completion = profile ? computeProfileCompletion(profile) : { score: 0, missing: [] };

  return (
    <PageContainer>
      <AppHeader title="Account" />

      <CoverEditor userId={user.id} url={profile?.cover_url ?? null} onUpdated={refreshProfile} />

      <section className="px-4 -mt-10">
        <div className="flex items-end gap-3">
          <AvatarEditor userId={user.id} name={profile?.full_name} url={profile?.avatar_url ?? null} plan={currentPlan} onUpdated={refreshProfile} />
          <div className="ml-auto pb-2"><PlanBadge plan={currentPlan} size="md" /></div>
        </div>
        <h1 className="mt-2 font-display text-2xl font-black">{profile?.full_name || "Supporter"}</h1>
        <div className="text-xs text-muted-foreground">{user.email}</div>

        {completion.score < 100 && (
          <div className="glass mt-4 rounded-2xl p-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
              <span><Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Profile {completion.score}%</span>
              <span className="text-muted-foreground">Complete to be seen</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-gradient-to-r from-primary to-[var(--sa-gold)]" style={{ width: `${completion.score}%` }} />
            </div>
            {completion.missing.length > 0 && <div className="mt-2 text-[10px] text-muted-foreground">Add: {completion.missing.join(" · ")}</div>}
          </div>
        )}
      </section>

      <section className="mt-5 px-4">
        <div className="glass grid grid-cols-3 rounded-xl p-1">
          {(["profile", "subscription", "settings"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </section>

      {tab === "profile" && (<section className="mt-4 px-4 pb-32 space-y-4"><ProfileEditor /></section>)}

      {tab === "subscription" && (
        <section className="mt-4 px-4 pb-32 space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Membership</div>
            <h2 className="mt-1 font-display text-2xl font-black tracking-tight">Choose your supporter tier</h2>
            <p className="mt-1 text-sm text-muted-foreground">Three tiers. Real benefits. Cancel anytime.</p>
          </div>
          {PLANS.map((plan) => (<PlanCard key={plan.id} plan={plan} current={currentPlan} userId={user.id} onChanged={refreshProfile} />))}
          <p className="px-1 pt-2 text-center text-[11px] text-muted-foreground">Billing in preview — plan changes apply instantly while we finalise payments.</p>
        </section>
      )}

      {tab === "settings" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <div className="glass overflow-hidden rounded-2xl">
            <Link to="/notifications" className="flex items-center gap-3 border-b border-border/40 px-4 py-3 hover:bg-white/5">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2"><Bell className="h-4 w-4" /></div>
              <div className="flex-1 text-sm font-semibold">Notifications</div>
            </Link>
            <ChangePasswordRow />
            {isAdminQ.data && (
              <Link to="/admin" className="flex items-center gap-3 border-t border-border/40 px-4 py-3 hover:bg-white/5">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15"><Shield className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 text-sm font-semibold">Admin portal</div>
              </Link>
            )}
          </div>
          <DangerZone onLogout={onLogout} />
        </section>
      )}
    </PageContainer>
  );
}

function CoverEditor({ userId, url, onUpdated }: { userId: string; url: string | null; onUpdated: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (f: File) => {
    setBusy(true);
    try {
      const newUrl = await uploadUserFile(userId, f, "cover");
      await db.from("profiles").update({ cover_url: newUrl }).eq("id", userId);
      onUpdated();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="relative mx-4 mt-3 h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--sa-green)] to-[oklch(0.3_0.13_155)]" style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <button onClick={() => ref.current?.click()} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />} Cover
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </div>
  );
}

function AvatarEditor({ userId, name, url, plan, onUpdated }: { userId: string; name?: string | null; url: string | null; plan: Plan; onUpdated: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (f: File) => {
    setBusy(true);
    try {
      const newUrl = await uploadUserFile(userId, f, "avatar");
      await db.from("profiles").update({ avatar_url: newUrl }).eq("id", userId);
      onUpdated();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="relative">
      <UserAvatar name={name} src={url} size={88} ring={plan === "gold" ? "gold" : null} className="ring-4 ring-background" />
      <button onClick={() => ref.current?.click()} className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </div>
  );
}

function ProfileEditor() {
  const { user, profile, refreshProfile } = useAuth();
  const [full_name, setFullName] = useState(profile?.full_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [country, setCountry] = useState(profile?.country ?? "South Africa");
  const [favourite_team, setTeam] = useState(profile?.favourite_team ?? "");
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [busy, setBusy] = useState(false);
  const toggleInterest = (i: string) => setInterests((arr) => arr.includes(i) ? arr.filter((x) => x !== i) : [...arr, i]);
  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await db.from("profiles").update({
      full_name, username: username || null, bio: bio || null, city: city || null, country, favourite_team: favourite_team || null, interests,
    }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved"); refreshProfile();
  };
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <Field label="Full name"><input value={full_name} onChange={(e) => setFullName(e.target.value)} className="input-base" /></Field>
      <Field label="Username"><input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))} placeholder="lebo10" className="input-base" /></Field>
      <Field label="Bio"><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="input-base resize-none" placeholder="Tell other supporters about yourself" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className="input-base" placeholder="Johannesburg" /></Field>
        <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} className="input-base" /></Field>
      </div>
      <Field label="Favourite team"><input value={favourite_team} onChange={(e) => setTeam(e.target.value)} className="input-base" placeholder="Bafana Bafana, Kaizer Chiefs…" /></Field>
      <Field label="Football interests">
        <div className="flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((i) => {
            const on = interests.includes(i);
            return (
              <button key={i} type="button" onClick={() => toggleInterest(i)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${on ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground"}`}>{i}</button>
            );
          })}
        </div>
      </Field>
      <button onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save changes
      </button>
      <style>{`.input-base{width:100%;border-radius:.6rem;background:var(--surface-2);padding:.6rem .75rem;font-size:.875rem;outline:none;border:1px solid var(--border);}.input-base:focus{border-color:var(--ring);}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>{children}</label>);
}

function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 8) return toast.error("Min 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated"); setPw(""); setOpen(false);
  };
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 border-t border-border/40 px-4 py-3 hover:bg-white/5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2"><KeyRound className="h-4 w-4" /></div>
        <div className="flex-1 text-left text-sm font-semibold">Change password</div>
      </button>
      {open && (
        <div className="px-4 pb-3">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          <button onClick={save} disabled={busy} className="mt-2 w-full rounded-lg bg-primary py-2 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Update password"}</button>
        </div>
      )}
    </div>
  );
}

function DangerZone({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="space-y-2">
      <button onClick={onLogout} className="glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function PlanCard({ plan, current, userId, onChanged }: { plan: (typeof PLANS)[number]; current: Plan; userId: string; onChanged: () => void }) {
  const Icon = plan.icon;
  const tone = planTone(plan.id);
  const isCurrent = plan.id === current;
  const rank = { bronze: 0, silver: 1, gold: 2 } as const;
  const isUpgrade = rank[plan.id] > rank[current];
  const [busy, setBusy] = useState(false);
  const choose = async () => {
    if (isCurrent) return;
    setBusy(true);
    const { error } = await db.from("profiles").update({ plan: plan.id }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    await db.from("user_achievements").insert({ user_id: userId, achievement_id: `${plan.id}_supporter` }).then(() => {}, () => {});
    toast.success(`Welcome to ${plan.name} ${plan.badge}`);
    onChanged();
  };
  return (
    <div className={`glass relative overflow-hidden rounded-2xl p-5 ring-1 ${plan.highlight ? "ring-2 ring-[var(--sa-gold)]/60 shadow-[0_0_40px_-12px_var(--sa-gold)]" : "ring-border/40"}`}>
      {plan.highlight && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--sa-gold)] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-black">
          <Star className="h-3 w-3" /> Most popular
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone.bg}`}><Icon className={`h-5 w-5 ${tone.text}`} /></div>
        <div>
          <div className="font-display text-xl font-black">{plan.name}</div>
          <div className="text-[11px] font-semibold text-muted-foreground">{plan.tagline}</div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-display text-3xl font-black">{plan.price.split(" / ")[0]}</div>
        <div className="text-xs font-bold text-muted-foreground">/ month</div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {plan.perks.map((perk) => (<li key={perk} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {perk}</li>))}
      </ul>
      <button
        disabled={isCurrent || busy}
        onClick={choose}
        className={`mt-4 w-full rounded-xl py-3 text-xs font-black uppercase tracking-wider transition disabled:opacity-60 ${isCurrent ? "bg-surface-2 text-muted-foreground" : plan.highlight ? "bg-[var(--sa-gold)] text-black hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"}`}
      >
        {busy ? "Updating…" : isCurrent ? "Current plan" : isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
      </button>
    </div>
  );
}
