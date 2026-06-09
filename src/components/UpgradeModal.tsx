import { Link } from "@tanstack/react-router";
import { Crown, X, Sparkles, Check } from "lucide-react";
import {
  TIERS,
  TIER_FEATURE_MIN,
  tierMeets,
  type Tier,
  type TierFeature,
} from "@/lib/tiers";

type Props = {
  open: boolean;
  onClose: () => void;
  currentTier: Tier;
  feature?: TierFeature;
  /** Optional explicit target tier (overrides feature lookup). */
  targetTier?: Tier;
  title?: string;
  reason?: string;
};

export function UpgradeModal({ open, onClose, currentTier, feature, targetTier, title, reason }: Props) {
  if (!open) return null;
  const need: Tier = targetTier ?? (feature ? TIER_FEATURE_MIN[feature] : "premium");
  const target = TIERS.find((t) => t.id === need) ?? TIERS[2];
  const Icon = target.icon;
  const priceLabel = target.priceCents === 0 ? "FREE" : `R${(target.priceCents / 100).toFixed(0)} / mo`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass relative w-full max-w-sm overflow-hidden rounded-3xl p-6 ring-1 ring-[var(--safc-yellow)]/40">
        <button onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" /> Upgrade required
        </div>
        <h2 className="font-display text-2xl font-black tracking-tight">{title ?? `Unlock with ${target.name}`}</h2>
        {reason && <p className="mt-1 text-sm text-muted-foreground">{reason}</p>}

        <div className="mt-4 rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[var(--safc-yellow)]" />
            <div className="font-display text-lg font-black">{target.name}</div>
            <div className="ml-auto text-sm font-bold text-muted-foreground">{priceLabel}</div>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {target.perks.slice(0, 5).map((p) => (
              <li key={p} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {p}</li>
            ))}
          </ul>
        </div>

        {tierMeets(currentTier, need) ? (
          <div className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-center text-xs text-muted-foreground">
            You're already on {currentTier}.
          </div>
        ) : (
          <Link
            to="/account"
            search={{ tab: "subscription" } as never}
            onClick={onClose}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-primary-foreground"
          >
            <Crown className="h-4 w-4" /> Upgrade to {target.badge}
          </Link>
        )}
        <button onClick={onClose} className="mt-2 w-full text-center text-[11px] font-semibold text-muted-foreground hover:text-foreground">
          Maybe later
        </button>
      </div>
    </div>
  );
}
