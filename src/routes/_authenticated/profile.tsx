import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Crown,
  ChevronRight,
  Receipt,
  LogOut,
  User as UserIcon,
  KeyRound,
  Sparkles,
  CalendarDays,
  Mail,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Account — Bafana Supporters Club" }] }),
  component: ProfilePage,
});

type Dialog = null | "edit" | "password";

function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);

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

  const isPremium = !!profile?.is_premium;
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
,
      })

    : "—";

  return (
    <PageContainer>
      <AppHeader title="Account" />

      {/* Hero */}
      <section className="px-4 pt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          My Account
        </div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
          Manage your <span className="text-gradient-gold">membership</span>
        </h1>
      </section>

      {/* Profile card */}
      <section className="px-4 pt-4">
        <div className="glass relative overflow-hidden rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div
              className={`grid h-16 w-16 shrink-0 place-items-center rounded-full font-display text-xl font-black ${
                isPremium
                  ? "shimmer-gold text-black ring-glow-gold"
                  : "bg-[var(--sa-green)] text-white"
              }`}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-lg font-black">
                {profile?.full_name || "Supporter"}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                {isPremium ? <Crown className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}{" "}
                {isPremium ? "Premium Plan" : "Free Plan"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Membership card */}
      <section className="mt-5 px-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Membership
        </h2>
        <div className="glass rounded-2xl p-4">
          <KV label="Plan" value={isPremium ? "Premium Pass" : "Free"} />
          <KV
            label="Status"
            value={
              <span
                className={
                  isPremium ? "text-primary font-bold" : "text-muted-foreground font-semibold"
                }
              >
                {isPremium ? "Active" : "Inactive"}
              </span>
            }
          />
          {isPremium && profile?.premium_until && (
            <KV
              label="Renews"
              value={new Date(profile.premium_until).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
,
              })}

            />
          )}
          <KV
            label={
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Joined
              </span>
            }
            value={joinDate}
            last
          />

          {!isPremium && (
            <Link
              to="/premium"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-primary-foreground"
            >
              <Crown className="h-4 w-4" /> Upgrade to Premium
            </Link>
          )}
        </div>
      </section>

      {/* Manage account */}
      <section className="mt-5 px-4">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Manage Account
        </h2>
        <div className="glass overflow-hidden rounded-2xl">
          <RowButton
            icon={<UserIcon className="h-4 w-4" />}
            label="Edit profile"
            hint="Name & contact details"
            onClick={() => setDialog("edit")}
          />
          <RowButton
            icon={<KeyRound className="h-4 w-4" />}
            label="Change password"
            hint="Update your sign-in password"
            onClick={() => setDialog("password")}
          />
          <RowLink
            to="/premium"
            icon={<Crown className="h-4 w-4" />}
            label={isPremium ? "Manage subscription" : "View premium plans"}
            hint={isPremium ? "Premium Pass · Active" : "Unlock VIP perks"}
          />
          <RowLink
            to="/premium"
            icon={<Receipt className="h-4 w-4" />}
            label="Payment history"
            hint={`${payments?.length ?? 0} transactions`}
          />
        </div>
      </section>

      {/* Logout */}
      <section className="mt-6 px-4">
        <button
          onClick={onLogout}
          className="glass flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </section>

      {dialog === "edit" && (
        <EditProfileDialog
          initialName={profile?.full_name ?? ""}
          initialPhone={profile?.phone ?? ""}
          userId={user!.id}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            await refreshProfile();
            setDialog(null);
          }}
        />
      )}
      {dialog === "password" && (
        <ChangePasswordDialog onClose={() => setDialog(null)} />
      )}
    </PageContainer>
  );
}

function KV({
  label,
  value,
  last,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2.5 ${
        last ? "" : "border-b border-border/40"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function RowButton({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-white/5 last:border-b-0"
    >
      <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function RowLink({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-border/60 px-4 py-3 transition hover:bg-white/5 last:border-b-0"
    >
      <div className="grid h-8 w-8 place-items-center rounded-md bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="glass-strong w-full max-w-md rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-black">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function EditProfileDialog({
  initialName,
  initialPhone,
  userId,
  onClose,
  onSaved,
}: {
  initialName: string;
  initialPhone: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, phone: phone || null })
      .eq("id", userId);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
  };

  return (
    <DialogShell title="Edit profile" onClose={onClose}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Full name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
      />
      <label className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Phone
      </label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="mt-1 w-full rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
        placeholder="+27 …"
      />
      <button
        onClick={save}
        disabled={loading || !name.trim()}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Save changes
      </button>
    </DialogShell>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    onClose();
  };

  return (
    <DialogShell title="Change password" onClose={onClose}>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        New password
      </label>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className="mt-1 w-full rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
      />
      <label className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Confirm password
      </label>
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="mt-1 w-full rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
      />
      <button
        onClick={save}
        disabled={loading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Update password
      </button>
    </DialogShell>
  );
}
