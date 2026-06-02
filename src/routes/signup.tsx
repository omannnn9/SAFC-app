import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, User, Shield, Loader2, Trophy, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import heroPlayer from "@/assets/hero-player.jpg";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Join — Bafana Supporters Club" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);


  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return toast.error("Please complete all required fields.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, favorite_team: favoriteTeam, country: "South Africa" },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Check your email to confirm.");
    navigate({ to: "/login" });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Stadium backdrop */}
      <div className="absolute inset-0">
        <img src={heroPlayer} alt="" className="h-full w-full object-cover opacity-25 slow-zoom" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/85 to-background" />
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: "var(--gradient-stadium)" }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "var(--gradient-spotlight)" }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10 animate-[reveal-up_0.7s_var(--ease-out-expo)]">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition">
            ← Back
          </Link>
          <Link to="/login" className="text-xs font-semibold text-[color:var(--sa-gold)]">
            Sign in →
          </Link>
        </div>

        {/* Brand */}
        <div className="mt-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--sa-gold)] shadow-[var(--shadow-glow-gold)]">
            <Trophy className="h-4.5 w-4.5 text-black" strokeWidth={2.5} />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Bafana <span className="text-foreground">Supporters Club</span>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--sa-gold)] live-dot" />
            Free Membership
          </div>
          <h1 className="font-display text-[2.6rem] font-bold leading-[0.95] tracking-tight">
            Join the <span className="text-gradient-gold">movement.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Become an official supporter — match notifications, exclusive content, and member perks.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="glass-strong mt-8 space-y-4 rounded-2xl p-6 shadow-[var(--shadow-card-lift)]"
        >
          <FloatField
            icon={<User className="h-4 w-4" />}
            label="Full name"
            type="text"
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
          />
          <FloatField
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <FloatField
            icon={<Lock className="h-4 w-4" />}
            label="Password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            trailing={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <FloatField
            icon={<Shield className="h-4 w-4" />}
            label="Confirm password"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            trailing={
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="p-1 -m-1 text-muted-foreground hover:text-foreground transition"
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <FloatField
            icon={<Trophy className="h-4 w-4" />}
            label="Favorite team (optional)"
            type="text"
            value={favoriteTeam}
            onChange={setFavoriteTeam}
            required={false}
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--sa-gold)] py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-black shadow-[var(--shadow-glow-gold)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              "Join Bafana Supporters Club"
            )}
          </button>

          <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <Perk label="Live updates" />
            <Perk label="Exclusive news" />
            <Perk label="Member perks" />
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <Link to="/login" className="font-semibold text-[color:var(--sa-gold)]">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function Perk({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/40 px-2 py-1.5">
      <CheckCircle2 className="h-3 w-3 text-[color:var(--sa-green)]" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function FloatField({
  icon,
  label,
  type,
  value,
  onChange,
  autoComplete,
  trailing,
  required = true,
}: {
  icon?: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  trailing?: React.ReactNode;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const float = focused || value.length > 0;
  return (
    <label className="relative block">
      <div
        className={`relative flex items-center gap-3 rounded-xl border bg-surface/60 px-3.5 pt-5 pb-2 transition-all ${
          focused
            ? "border-[color:var(--sa-gold)]/60 ring-2 ring-[color:var(--sa-gold)]/20"
            : "border-border"
        }`}
      >
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <div className="relative flex-1">
          <span
            className={`pointer-events-none absolute left-0 transition-all ${
              float
                ? "-top-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                : "top-0.5 text-sm text-muted-foreground/70"
            }`}
          >
            {label}
          </span>
          <input
            type={type}
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete={autoComplete}
            className="w-full bg-transparent text-sm text-foreground outline-none"
          />
        </div>
        {trailing}
      </div>
    </label>
  );
}
