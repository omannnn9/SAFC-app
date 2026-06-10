import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown, X } from "lucide-react";
import { TIERS, type Tier, type TierFeature } from "@/lib/tiers";

/**
 * Upgrade gate shown when a user hits a feature above their tier.
 * Links to /membership where Stripe checkout handles payment.
 */
export function UpgradeModal({
  open,
  onClose,
  title,
  targetTier,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  currentTier?: Tier;
  feature?: TierFeature;
  targetTier?: Tier;
  title?: string;
  reason?: string;
}) {
  if (!open) return null;
  const target = TIERS.find((t) => t.id === (targetTier ?? "premium"));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--safc-yellow)]/30 bg-gradient-to-br from-[var(--safc-green)]/25 via-[#0b0b0b] to-[var(--safc-cobalt)]/30 p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--safc-yellow)]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--safc-yellow)]">
          <Crown className="h-3 w-3" /> SAFC Memberships
        </div>
        <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-white">
          {title ?? "Unlock SAFC"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/85">
          {reason ?? `This feature is part of ${target?.name ?? "a paid SAFC membership"}. Upgrade to unlock it — monthly or annual, cancel anytime.`}
        </p>

        <Link
          to="/membership"
          onClick={onClose}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-black uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow-pink)] transition hover:opacity-90"
        >
          View memberships <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
