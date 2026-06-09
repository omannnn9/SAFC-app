// LEGACY compat shim — the source of truth is `@/lib/tiers`.
// Any caller still using bronze/silver/gold is transparently mapped onto
// the new free/basic/premium/founder tier system.
import type { LucideIcon } from "lucide-react";
import { Users, Shield, Star, Crown } from "lucide-react";
import {
  TIERS,
  TIER_RANK,
  planToTier,
  tierMeets,
  canUse as tierCanUse,
  type Tier,
  type TierFeature,
} from "@/lib/tiers";

export type Plan = "bronze" | "silver" | "gold";
export const PLAN_RANK: Record<Plan, number> = { bronze: 0, silver: 1, gold: 2 };

export type PlanDef = {
  id: Plan;
  name: string;
  price: string;
  priceCents: number;
  tagline: string;
  badge: string;
  icon: LucideIcon;
  highlight?: boolean;
  perks: string[];
};

/** Synthesised PLANS list — preserves legacy ids but mirrors the new tier copy. */
export const PLANS: ReadonlyArray<PlanDef> = (["bronze", "silver", "gold"] as const).map((id) => {
  const t = TIERS.find((x) => x.id === planToTier(id))!;
  return {
    id,
    name: t.name,
    priceCents: t.priceCents,
    price: t.priceCents === 0 ? "FREE" : `R${(t.priceCents / 100).toFixed(0)} / month`,
    tagline: t.tagline,
    badge: t.badge,
    icon: t.icon,
    highlight: id === "silver",
    perks: t.perks,
  };
});

// Map legacy feature names onto the new TierFeature names where they overlap.
export type Feature =
  | "join_event"
  | "create_meetup_group"
  | "create_travel_group"
  | "create_private_group"
  | "advanced_search"
  | "profile_analytics"
  | "gold_communities"
  | "featured_profile"
  | "priority_support";

export const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  join_event: "bronze",
  create_meetup_group: "silver",
  create_travel_group: "silver",
  advanced_search: "silver",
  create_private_group: "gold",
  profile_analytics: "gold",
  gold_communities: "gold",
  featured_profile: "gold",
  priority_support: "gold",
};

/** Free supporters can RSVP to up to 5 events per month (matches the old Bronze limit). */
export const FREE_MONTHLY_EVENT_LIMIT = 5;
/** @deprecated use FREE_MONTHLY_EVENT_LIMIT */
export const BRONZE_MONTHLY_EVENT_LIMIT = FREE_MONTHLY_EVENT_LIMIT;

export function planMeets(plan: Plan | null | undefined, min: Plan): boolean {
  return PLAN_RANK[plan ?? "bronze"] >= PLAN_RANK[min];
}

export function canUseFeature(plan: Plan | null | undefined, f: Feature): boolean {
  const tier = planToTier(plan);
  const minTier = planToTier(FEATURE_MIN_PLAN[f]);
  return tierMeets(tier, minTier);
}

export function planLabel(plan: Plan): string {
  return PLANS.find((p) => p.id === plan)?.name ?? "Supporter";
}

export function planTone(plan: Plan): { bg: string; text: string; ring: string } {
  const tier = planToTier(plan);
  if (tier === "founder")
    return { bg: "bg-[var(--safc-yellow)]/15", text: "text-[var(--safc-yellow)]", ring: "ring-[var(--safc-yellow)]" };
  if (tier === "premium")
    return { bg: "bg-[var(--safc-pink)]/15", text: "text-[var(--safc-pink)]", ring: "ring-[var(--safc-pink)]" };
  if (tier === "basic")
    return { bg: "bg-[var(--safc-green)]/15", text: "text-[var(--safc-green)]", ring: "ring-[var(--safc-green)]" };
  return { bg: "bg-white/10", text: "text-foreground", ring: "ring-white/30" };
}

// Re-export so callers can opt into the new API directly.
export type { Tier, TierFeature };
export { planToTier, tierMeets, tierCanUse };
// Silence "unused" warnings for re-exports that exist purely for compat.
void Users;
void Shield;
void Star;
void Crown;
