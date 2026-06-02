import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [loading, setLoading] = useState(false);

  const onNext = (e: FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || password.length < 8)
      return toast.error("Please complete all fields. Password ≥ 8 characters.");
    setStep(2);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone, country },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Check your email to confirm.");
    navigate({ to: "/login" });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <img src={heroPlayer} alt="" className="h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            ← Back
          </Link>
          <div className="text-xs text-muted-foreground">Step {step}/2</div>
        </div>

        <div className="mt-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            Join the Nation
          </div>
          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight">
            {step === 1 ? "Create your account." : "A few details."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 1
              ? "Become an official supporter."
              : "Help us personalise your experience."}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={onNext} className="mt-10 space-y-4">
            <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Themba Khumalo" />
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
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continue →
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-4">
            <Field
              label="Phone (optional)"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="+27 71 234 5678"
              required={false}
            />
            <Field label="Country" value={country} onChange={setCountry} />
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Go back
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Already a member?{" "}
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm text-foreground outline-none ring-primary/40 transition placeholder:text-muted-foreground/60 focus:ring-2"
      />
    </label>
  );
}
