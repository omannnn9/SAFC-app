import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — Bafana" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset email sent");
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background px-6 py-10">
      <Link to="/login" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        ← Back to sign in
      </Link>
      <div className="mt-12">
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight">
          Reset password.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll email you a secure link to set a new password.
        </p>
      </div>
      {sent ? (
        <div className="mt-10 rounded-2xl border border-border bg-surface/60 p-6 text-sm">
          ✓ Check <span className="font-semibold text-foreground">{email}</span> for a reset link.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none ring-primary/40 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </div>
  );
}
