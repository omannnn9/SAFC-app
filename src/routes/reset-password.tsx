import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — Bafana" }] }),
  component: ResetPage,
});

function ResetPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background px-6 py-10">
      <Link to="/login" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        ← Cancel
      </Link>
      <div className="mt-12">
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight">
          New password.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose something secure (8+ chars).</p>
      </div>
      <form onSubmit={onSubmit} className="mt-10 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            New password
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none ring-primary/40 focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
