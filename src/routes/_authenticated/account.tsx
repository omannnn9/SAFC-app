import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Loader2, LogOut, Crown, Check, Camera, Bell, KeyRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { uploadUserFile } from "@/lib/social";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account — Bafana Connect" }] }),
  component: AccountPage,
});

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "R0",
    blurb: "Start connecting",
    perks: ["Create profile", "Follow supporters", "Join up to 3 events / month", "Community feed"],
  },
  {
    id: "plus",
    name: "Supporter Plus",
    price: "R49 / mo",
    blurb: "Get in the game",
    perks: ["Unlimited event joins", "Enhanced profile visibility", "Exclusive community groups", "Priority event discovery"],
    highlight: true,
  },
  {
    id: "vip",
    name: "VIP Supporter",
    price: "R149 / mo",
    blurb: "Premium experience",
    perks: ["Everything in Plus", "VIP badge on profile", "Premium supporter lounges", "Exclusive events", "Advanced networking"],
  },
] as const;

function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"profile" | "subscription">("profile");

  const onLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  if (!user) return null;

  return (
    <PageContainer>
      <AppHeader title="Account" />

      {/* Cover */}
      <CoverEditor userId={user.id} url={profile?.cover_url ?? null} onUpdated={refreshProfile} />

      {/* Profile header */}
      <section className="px-4 -mt-10">
        <div className="flex items-end gap-3">
          <AvatarEditor userId={user.id} name={profile?.full_name} url={profile?.avatar_url ?? null} plan={profile?.plan ?? "free"} onUpdated={refreshProfile} />
          <div className="ml-auto pb-2">
            <PlanBadge plan={profile?.plan ?? "free"} />
          </div>
        </div>
        <h1 className="mt-2 font-display text-2xl font-black">{profile?.full_name || "Supporter"}</h1>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </section>

      {/* Tabs */}
      <section className="mt-5 px-4">
        <div className="glass grid grid-cols-2 rounded-xl p-1">
          <button onClick={() => setTab("profile")} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Profile</button>
          <button onClick={() => setTab("subscription")} className={`rounded-lg py-2 text-xs font-black uppercase tracking-wider ${tab === "subscription" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Subscription</button>
        </div>
      </section>

      {tab === "profile" && (
        <section className="mt-4 px-4 pb-32 space-y-4">
          <ProfileEditor />
          <div className="glass overflow-hidden rounded-2xl">
            <Link to="/notifications" className="flex items-center gap-3 border-b border-border/40 px-4 py-3 hover:bg-white/5">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2"><Bell className="h-4 w-4" /></div>
              <div className="flex-1 text-sm font-semibold">Notifications</div>
            </Link>
            <ChangePasswordRow />
          </div>
          <button onClick={onLogout} className="glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </section>
      )}

      {tab === "subscription" && (
        <section className="mt-4 px-4 pb-32 space-y-3">
          <p className="text-sm text-muted-foreground">Choose the plan that fits how you supporter.</p>
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} current={profile?.plan ?? "free"} />
          ))}
          <p className="px-1 pt-2 text-[11px] text-muted-foreground">
            Billing coming soon. Plans are currently in preview.
          </p>
        </section>
      )}
    </PageContainer>
  );
}

function PlanBadge({ plan }: { plan: "free" | "plus" | "vip" }) {
  if (plan === "vip") return <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary"><Crown className="h-3 w-3" /> VIP</span>;
  if (plan === "plus") return <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-accent-foreground">Plus</span>;
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Free</span>;
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
    <div
      className="relative mx-4 mt-3 h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--sa-green)] to-[oklch(0.3_0.13_155)]"
      style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <button onClick={() => ref.current?.click()} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />} Cover
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </div>
  );
}

function AvatarEditor({ userId, name, url, plan, onUpdated }: { userId: string; name?: string | null; url: string | null; plan: "free" | "plus" | "vip"; onUpdated: () => void }) {
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
      <UserAvatar name={name} src={url} size={88} ring={plan === "vip" ? "gold" : null} className="ring-4 ring-background" />
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
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await db.from("profiles").update({
      full_name, username: username || null, bio: bio || null, city: city || null, country, favourite_team: favourite_team || null,
    }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    refreshProfile();
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
      <button onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save changes
      </button>
      <style>{`.input-base{width:100%;border-radius:.6rem;background:var(--surface-2);padding:.6rem .75rem;font-size:.875rem;outline:none;border:1px solid var(--border);}.input-base:focus{border-color:var(--ring);}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
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
    toast.success("Password updated");
    setPw("");
    setOpen(false);
  };
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5">
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

function PlanCard({ plan, current }: { plan: (typeof PLANS)[number]; current: "free" | "plus" | "vip" }) {
  const isCurrent = plan.id === current;
  const isUpgrade = (PLANS.findIndex((p) => p.id === plan.id) ?? 0) > (PLANS.findIndex((p) => p.id === current) ?? 0);
  return (
    <div className={`glass relative overflow-hidden rounded-2xl p-5 ${plan.highlight ? "ring-glow-gold" : ""}`}>
      {plan.highlight && <div className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary-foreground">Most popular</div>}
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{plan.blurb}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="font-display text-2xl font-black">{plan.name}</div>
        {plan.id === "vip" && <Crown className="h-4 w-4 text-primary" />}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{plan.price}</div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {perk}</li>
        ))}
      </ul>
      <button
        disabled={isCurrent}
        onClick={() => toast.info("Billing coming soon — plans are in preview.")}
        className={`mt-4 w-full rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition ${
          isCurrent ? "bg-surface-2 text-muted-foreground" : plan.highlight ? "bg-primary text-primary-foreground" : "bg-surface-2 ring-1 ring-primary text-foreground"
        }`}
      >
        {isCurrent ? "Current plan" : isUpgrade ? "Upgrade" : "Switch plan"}
      </button>
    </div>
  );
}
