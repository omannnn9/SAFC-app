import { useState } from "react";
import { CreditCard, Loader2, Check, X, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import type { PlanDef } from "@/lib/plans";

/**
 * Mock checkout modal — DEMO ONLY.
 * Simulates a card payment: validates fake inputs, "processes" for ~1.5s,
 * then activates the plan instantly on success.
 * NO real payment provider is involved.
 */
export function MockCheckoutModal({
  open,
  onClose,
  plan,
  userId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  plan: PlanDef | null;
  userId: string;
  onSuccess: () => void;
}) {
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"form" | "processing" | "success" | "failure">("form");
  const [error, setError] = useState<string | null>(null);

  if (!open || !plan) return null;

  const reset = () => {
    setStage("form");
    setError(null);
  };

  const close = () => {
    if (stage === "processing") return;
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const digits = card.replace(/\s+/g, "");
    if (digits.length < 12) return setError("Enter a valid card number");
    if (!/^\d{2}\/\d{2}$/.test(exp)) return setError("Expiry must be MM/YY");
    if (cvc.length < 3) return setError("CVC must be 3+ digits");
    if (!name.trim()) return setError("Cardholder name is required");

    setStage("processing");

    // Simulate processing latency
    await new Promise((r) => setTimeout(r, 1400));

    // Magic "decline" card for testing the failure path
    if (digits === "400000000000000" || digits.startsWith("4000 0000")) {
      setStage("failure");
      return;
    }

    // Activate plan: update profile, then record payment + subscription
    const { error: pErr } = await db.from("profiles").update({ plan: plan.id }).eq("id", userId);
    if (pErr) {
      setStage("failure");
      setError(pErr.message);
      return;
    }

    const priceCents = Math.round(parseFloat(plan.price.match(/[\d.]+/)?.[0] ?? "0") * 100);
    const ref = `mock_${Date.now()}`;

    await db.from("payments").insert({
      user_id: userId,
      amount_cents: priceCents,
      currency: "ZAR",
      status: "succeeded",
      provider: "mock",
      provider_ref: ref,
    }).then(() => {}, () => {});

    await db.from("subscriptions").insert({
      user_id: userId,
      plan: plan.id,
      status: "active",
      provider: "mock",
      provider_ref: ref,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).then(() => {}, () => {});

    await db
      .rpc("grant_supporter_achievement", { _plan: plan.id })
      .then(() => {}, () => {});
    setStage("success");
    toast.success(`Welcome to ${plan.name} ${plan.badge}`);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass relative w-full max-w-md overflow-hidden rounded-3xl p-6 ring-1 ring-[var(--sa-gold)]/40">
        {stage !== "processing" && (
          <button
            onClick={close}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
          <ShieldCheck className="h-3 w-3" /> Demo checkout
        </div>
        <h2 className="font-display text-2xl font-black tracking-tight">
          {plan.badge} {plan.name}
        </h2>
        <div className="mt-1 text-sm text-muted-foreground">
          {plan.price} · {plan.tagline}
        </div>

        {stage === "form" && (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field label="Cardholder name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mosa Khumalo"
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary"
              />
            </Field>
            <Field label="Card number">
              <input
                value={card}
                onChange={(e) => setCard(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry (MM/YY)">
                <input
                  value={exp}
                  onChange={(e) => setExp(e.target.value)}
                  className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary"
                />
              </Field>
              <Field label="CVC">
                <input
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary"
                />
              </Field>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-primary-foreground hover:opacity-90"
            >
              <CreditCard className="h-4 w-4" /> Pay {plan.price.split(" / ")[0]}
            </button>

            <p className="pt-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              Demo only · No real charge · Use 4000 0000 0000 0000 to simulate decline
            </p>
          </form>
        )}

        {stage === "processing" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="font-semibold">Processing payment…</div>
            <div className="text-xs text-muted-foreground">Securing your supporter status</div>
          </div>
        )}

        {stage === "success" && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/20">
              <Check className="h-7 w-7 text-primary" />
            </div>
            <div className="font-display text-lg font-black">You're in!</div>
            <div className="text-sm text-muted-foreground">
              Your {plan.name} perks are active immediately.
            </div>
            <button
              onClick={close}
              className="mt-2 w-full rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-primary-foreground"
            >
              Start exploring
            </button>
          </div>
        )}

        {stage === "failure" && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/15">
              <X className="h-7 w-7 text-destructive" />
            </div>
            <div className="font-display text-lg font-black">Payment declined</div>
            <div className="text-sm text-muted-foreground">
              {error ?? "Your card was declined. Try a different number."}
            </div>
            <button
              onClick={() => setStage("form")}
              className="mt-2 w-full rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
