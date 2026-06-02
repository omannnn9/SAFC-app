import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, ChevronRight, Receipt, LogOut, Bell, Settings as Cog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Bafana" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: payments } = useQuery({
    queryKey: ["payments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "BB";

  const onLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  const tierLabel = profile?.is_premium ? "VIP" : "Bronze";

  return (
    <PageContainer>
      <AppHeader title="Profile" />

      {/* Digital Fan ID */}
      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          Digital Fan ID
        </div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          Your <span className="text-gradient-gold">supporter card</span>
        </h1>
      </section>

      <section className="px-4 pt-4">
        <div
          className={`noise relative overflow-hidden rounded-2xl p-5 ${
            profile?.is_premium
              ? "border border-primary/50 bg-gradient-to-br from-[oklch(0.2_0.06_85)] via-black to-black shadow-[var(--shadow-glow-gold)]"
              : "border border-primary/20 bg-gradient-to-br from-[var(--sa-green)] via-black to-black shadow-[var(--shadow-glow-green)]"
          }`}
        >
          {/* shimmer border */}
          {profile?.is_premium && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 -top-px h-px shimmer-gold" />
              <div className="absolute inset-x-0 -bottom-px h-px shimmer-gold" />
            </div>
          )}
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/25 blur-3xl breathe" />

          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-primary/90">
                Bafana Supporters Club
              </div>
              <div className="mt-1.5 font-display text-2xl font-black leading-tight text-white">
                {profile?.full_name || "Supporter"}
              </div>
              <div className="mt-0.5 text-[11px] text-white/60">{profile?.country || "South Africa"}</div>
            </div>
            <div
              className={`grid h-16 w-16 place-items-center rounded-full font-display text-xl font-black ${
                profile?.is_premium
                  ? "shimmer-gold text-black ring-glow-gold"
                  : "bg-primary text-primary-foreground ring-glow-gold"
              }`}
            >
              {initials}
            </div>
          </div>

          <div className="relative mt-6 flex items-end justify-between">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">Tier</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-primary">
                {profile?.is_premium && <Crown className="h-3 w-3" />} {tierLabel}
              </div>
              <div className="mt-3 text-[9px] font-mono uppercase tracking-widest text-white/40">
                ID · {(user?.id ?? "").slice(0, 8).toUpperCase()}
              </div>
            </div>
            <QrCodePlaceholder value={user?.id ?? ""} glow={!!profile?.is_premium} />
          </div>
        </div>
      </section>

      {/* Fan stats */}
      <section className="mt-5 px-4">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Matches" value="24" />
          <StatTile label="Points" value="1.2K" />
          <StatTile label="Streak" value="7d" />
        </div>
      </section>

      {!profile?.is_premium && (
        <section className="px-4 pt-5">
          <Link
            to="/premium"
            className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-[oklch(0.15_0.05_85)] to-black p-4 ring-glow-gold transition"
          >
            <div className="relative">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Upgrade</div>
              <div className="mt-0.5 font-display text-base font-black">
                Become a <span className="text-gradient-gold">VIP supporter</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary" />
          </Link>
        </section>
      )}

      <section className="mt-6 px-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Account
        </h2>
        <div className="glass overflow-hidden rounded-2xl">
          <Row icon={<Cog className="h-4 w-4" />} label="Personal details" hint={user?.email ?? ""} />
          <Row icon={<Bell className="h-4 w-4" />} label="Notifications" hint="Manage alerts" />
          <Row
            icon={<Receipt className="h-4 w-4" />}
            label="Payment history"
            hint={`${payments?.length ?? 0} transactions`}
          />
        </div>
      </section>

      <section className="mt-6 px-4">
        <button
          onClick={onLogout}
          className="glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>
    </PageContainer>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <div className="font-display text-xl font-black">{value}</div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Row({ icon, label, hint }: { icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function QrCodePlaceholder({ value, glow }: { value: string; glow?: boolean }) {
  const cells = Array.from({ length: 49 }, (_, i) => {
    const code = value.charCodeAt(i % Math.max(value.length, 1)) || 0;
    return (code + i) % 3 === 0;
  });
  return (
    <div
      className={`grid h-16 w-16 grid-cols-7 gap-[2px] rounded-md bg-white p-1.5 ${
        glow ? "ring-glow-gold" : "ring-glow-green"
      }`}
    >
      {cells.map((on, i) => (
        <div key={i} className={on ? "bg-black" : "bg-white"} />
      ))}
    </div>
  );
}
