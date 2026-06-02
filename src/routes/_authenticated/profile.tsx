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

  return (
    <PageContainer>
      <AppHeader title="Profile" />

      {/* Digital supporter card */}
      <section className="px-4 pt-4">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-[var(--sa-green)] via-black to-black p-5 shadow-[var(--shadow-glow-gold)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-primary/80">
                Bafana Supporters Club
              </div>
              <div className="mt-1 font-display text-2xl font-bold leading-tight text-white">
                {profile?.full_name || "Supporter"}
              </div>
              <div className="mt-0.5 text-xs text-white/70">{profile?.country}</div>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground font-display text-lg font-bold">
              {initials}
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">Status</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-white">
                {profile?.is_premium ? (
                  <>
                    <Crown className="h-4 w-4 text-primary" /> Premium Pass
                  </>
                ) : (
                  "Free supporter"
                )}
              </div>
            </div>
            <QrCodePlaceholder value={user?.id ?? ""} />
          </div>
        </div>
      </section>

      {/* Premium CTA */}
      {!profile?.is_premium && (
        <section className="px-4 pt-4">
          <Link
            to="/premium"
            className="flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/10 p-4 transition hover:bg-primary/15"
          >
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-primary">Upgrade</div>
              <div className="mt-0.5 font-semibold">Get Bafana Premium Pass</div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary" />
          </Link>
        </section>
      )}

      {/* Account */}
      <section className="mt-6 px-4">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Account
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
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
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>
    </PageContainer>
  );
}

function Row({ icon, label, hint }: { icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function QrCodePlaceholder({ value }: { value: string }) {
  // Simple visual QR placeholder built from the user id hash
  const cells = Array.from({ length: 49 }, (_, i) => {
    const code = value.charCodeAt(i % Math.max(value.length, 1)) || 0;
    return (code + i) % 3 === 0;
  });
  return (
    <div className="grid h-16 w-16 grid-cols-7 gap-[2px] rounded-md bg-white p-1.5">
      {cells.map((on, i) => (
        <div key={i} className={on ? "bg-black" : "bg-white"} />
      ))}
    </div>
  );
}
