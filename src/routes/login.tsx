import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import safcHero from "@/assets/safc-hero.jpg.asset.json";
import { SafcLogo } from "@/components/SafcLogo";


export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SAFC" }] }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect || "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: search.redirect || "/" });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* SAFC deck backdrop */}
      <div className="absolute inset-0">
        <img src={safcHero.url} alt="" className="h-full w-full object-cover opacity-70 slow-zoom" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[color:var(--safc-green)]/55 to-[color:var(--safc-ink)]/90" />
        <div className="absolute inset-0 mix-blend-overlay opacity-50"
             style={{ background: "var(--gradient-stadium)" }} />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10 animate-[reveal-up_0.7s_var(--ease-out-expo)]">
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition">
          ← Back
        </Link>

        {/* Brand */}
        <div className="mt-10 flex items-center gap-3">
          <SafcLogo size={44} />
          <div>
            <div className="font-display text-sm font-extrabold tracking-tight">SAFC</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              South African Football Community
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--safc-green)] live-dot" />
            Members area
          </div>
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.95] tracking-tight">
            Welcome <span className="text-gradient-safc">back.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to the community — match-day energy, events, and supporters near you.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="glass-strong relative mt-8 space-y-4 rounded-2xl p-6 shadow-[var(--shadow-card-lift)]"
        >
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
            autoComplete="current-password"
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


          <button
            type="submit"
            disabled={loading}
            className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[color:var(--sa-gold)] py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-black shadow-[var(--shadow-glow-gold)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <Link
            to="/signup"
            className="block w-full rounded-xl border border-border bg-surface/40 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-surface"
          >
            Create account
          </Link>
        </form>

        {/* Social proof */}
        <div className="mt-8 space-y-2 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Join thousands of supporters
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Live match updates · Exclusive news · Membership perks
          </p>
        </div>
      </div>
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
}: {
  icon?: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  trailing?: React.ReactNode;
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
            id={autoComplete || label.toLowerCase().replace(/\s+/g, "-")}
            name={autoComplete || label.toLowerCase().replace(/\s+/g, "-")}
            type={type}
            required
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
