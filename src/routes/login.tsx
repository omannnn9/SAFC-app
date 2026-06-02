import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import heroPlayer from "@/assets/hero-player.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Bafana Supporters Club" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
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
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <img src={heroPlayer} alt="" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          ← Back
        </Link>
        <div className="mt-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Supporters Club
          </div>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your membership.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs">
          <Link to="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          <Link to="/signup" className="font-medium text-primary">
            Create account →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm text-foreground outline-none ring-primary/40 transition placeholder:text-muted-foreground/60 focus:ring-2"
      />
    </label>
  );
}
