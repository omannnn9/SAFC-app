// Bafana Connect membership plans — single source of truth
import type { LucideIcon } from "lucide-react";
import { Medal, Award, Crown } from "lucide-react";

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

export const PLANS: ReadonlyArray<PlanDef> = [
  {
    id: "bronze",
    name: "Bronze Supporter",
    price: "R19 / month",
    priceCents: 1900,
    tagline: "For students & new supporters",
    badge: "🥉",
    icon: Medal,
    perks: [
      "Create profile + upload photo",
      "Follow other supporters",
      "Create posts & upload photos",
      "Like and comment on posts",
      "Join public event communities",
      "Join up to 5 events / month",
      "Basic notifications",
      "Bronze profile badge",
    ],
  },
  {
    id: "silver",
    name: "Silver Supporter",
    price: "R59 / month",
    priceCents: 5900,
    tagline: "Most popular — the supporter standard",
    badge: "🥈",
    icon: Award,
    highlight: true,
    perks: [
      "Everything in Bronze",
      "Unlimited event participation",
      "Unlimited community access",
      "Create supporter meetup groups",
      "Create travel groups",
      "Advanced supporter search (city / country / events)",
      "Priority placement in attendee lists",
      "Enhanced profile customisation",
      "Larger photo uploads",
      "Silver profile badge",
    ],
  },
  {
    id: "gold",
    name: "Gold Supporter",
    price: "R129 / month",
    priceCents: 12900,
    tagline: "Premium VIP supporter experience",
    badge: "🥇",
    icon: Crown,
    perks: [
      "Everything in Silver",
      "Gold profile badge & featured placement",
      "Access Gold-only communities",
      "Create unlimited private groups",
      "Create premium event communities",
      "Advanced networking tools",
      "Profile visitor analytics",
      "Exclusive Gold supporter feed",
      "Priority support",
      "Early access to new features",
    ],
  },
];

export const BRONZE_MONTHLY_EVENT_LIMIT = 5;

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
  join_event: "bronze", // bronze limited to BRONZE_MONTHLY_EVENT_LIMIT
  create_meetup_group: "silver",
  create_travel_group: "silver",
  advanced_search: "silver",
  create_private_group: "gold",
  profile_analytics: "gold",
  gold_communities: "gold",
  featured_profile: "gold",
  priority_support: "gold",
};

export function planMeets(plan: Plan | null | undefined, min: Plan): boolean {
  return PLAN_RANK[plan ?? "bronze"] >= PLAN_RANK[min];
}

export function canUseFeature(plan: Plan | null | undefined, f: Feature): boolean {
  return planMeets(plan, FEATURE_MIN_PLAN[f]);
}

export function planLabel(plan: Plan): string {
  return PLANS.find((p) => p.id === plan)?.name ?? "Supporter";
}

export function planTone(plan: Plan): { bg: string; text: string; ring: string } {
  if (plan === "gold") return { bg: "bg-[var(--sa-gold)]/15", text: "text-[var(--sa-gold)]", ring: "ring-[var(--sa-gold)]" };
  if (plan === "silver") return { bg: "bg-zinc-300/15", text: "text-zinc-200", ring: "ring-zinc-300" };
  return { bg: "bg-amber-700/15", text: "text-amber-500", ring: "ring-amber-700" };
}
