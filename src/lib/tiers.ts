// SAFC Membership Tiers — the new user-facing system.
// Runs alongside legacy bronze/silver/gold "plan" for backwards compatibility.
import type { LucideIcon } from "lucide-react";
import { Users, Shield, Star, Crown } from "lucide-react";

export type Tier = "free" | "basic" | "premium" | "founder";

export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  founder: 3,
};

export const FOUNDER_CAP = 111;

export type TierDef = {
  id: Tier;
  name: string;
  tagline: string;
  priceCents: number; // 0 = free
  perks: string[];
  icon: LucideIcon;
  accent: string; // css var or color token
  badge: string;
};

// Static fallback (matches the tier_config table seed). Admin can override
// the DB-stored copy at runtime; UI always prefers tier_config when loaded.
export const TIERS: ReadonlyArray<TierDef> = [
  {
    id: "free",
    name: "General Member",
    tagline: "Join the movement — free for everyone",
    priceCents: 0,
    icon: Users,
    accent: "var(--safc-cream)",
    badge: "FREE",
    perks: [
      "Community feed access",
      "RSVP to events",
      "Join public discussions",
      "View match events",
      "Polls & giveaways",
    ],
  },
  {
    id: "basic",
    name: "SAFC Basic",
    tagline: "For everyday supporters",
    priceCents: 4900,
    icon: Shield,
    accent: "var(--safc-green)",
    badge: "BASIC",
    perks: [
      "Priority event access",
      "Exclusive content posts",
      "Selected supporter chats",
      "Chapter participation (city groups)",
      "Basic digital member card",
    ],
  },
  {
    id: "premium",
    name: "SAFC Premium",
    tagline: "For die-hard supporters",
    priceCents: 9900,
    icon: Star,
    accent: "var(--safc-pink)",
    badge: "PREMIUM",
    perks: [
      "Everything in Basic",
      "VIP event access",
      "Premium-only group chats",
      "Early access to events & merch drops",
      "Priority RSVP",
      "Animated premium digital card",
      "Premium profile badge",
    ],
  },
  {
    id: "founder",
    name: "Founding Member — Starting XI",
    tagline: `Limited edition · max ${FOUNDER_CAP} supporters`,
    priceCents: 29900,
    icon: Crown,
    accent: "var(--safc-yellow)",
    badge: "FOUNDER",
    perks: [
      "Permanent Founding Member status",
      "Unique SAFC member number",
      "Voting rights on club decisions",
      "Founders-only content & chats",
      "Annual Founders recognition",
      "Priority access to all events & travel",
      "Elite animated card with founder stamp",
    ],
  },
];

export function tierMeets(t: Tier | null | undefined, min: Tier): boolean {
  return TIER_RANK[t ?? "free"] >= TIER_RANK[min];
}

export type TierFeature =
  | "community_feed"
  | "rsvp"
  | "priority_rsvp"
  | "exclusive_posts"
  | "premium_chats"
  | "founders_chat"
  | "vote"
  | "chapter_create"
  | "vip_events";

export const TIER_FEATURE_MIN: Record<TierFeature, Tier> = {
  community_feed: "free",
  rsvp: "free",
  exclusive_posts: "basic",
  chapter_create: "basic",
  priority_rsvp: "premium",
  premium_chats: "premium",
  vip_events: "premium",
  founders_chat: "founder",
  vote: "founder",
};

export function canUse(t: Tier | null | undefined, f: TierFeature): boolean {
  return tierMeets(t, TIER_FEATURE_MIN[f]);
}

/** Map a legacy plan string ("bronze"|"silver"|"gold") onto the new tier. */
export function planToTier(plan?: string | null): Tier {
  switch (plan) {
    case "founder":
      return "founder";
    case "premium":
    case "gold": // legacy gold → premium (founder is admin-assigned only)
      return "premium";
    case "basic":
    case "silver":
    case "bronze":
      return "basic";
    default:
      return "free";
  }
}

/** Read the tier from a profile-shaped record, preferring `tier` and falling back to legacy `plan`. */
export function effectiveTier(
  p: { tier?: string | null; plan?: string | null } | null | undefined,
): Tier {
  if (!p) return "free";
  if (p.tier && (["free", "basic", "premium", "founder"] as const).includes(p.tier as Tier)) {
    return p.tier as Tier;
  }
  return planToTier(p.plan);
}

export function tierLabel(t: Tier): string {
  return TIERS.find((x) => x.id === t)?.name ?? "Supporter";
}

export function formatMemberNo(n: number | null | undefined): string {
  if (!n || n < 1) return "SAFC-—";
  return `SAFC-${String(n).padStart(3, "0")}`;
}

export function tierTone(t: Tier): { bg: string; text: string; ring: string; grad: string } {
  switch (t) {
    case "founder":
      return {
        bg: "bg-[var(--safc-yellow)]/15",
        text: "text-[var(--safc-yellow)]",
        ring: "ring-[var(--safc-yellow)]",
        grad: "linear-gradient(135deg, var(--safc-yellow), var(--safc-red), var(--safc-yellow))",
      };
    case "premium":
      return {
        bg: "bg-[var(--safc-pink)]/15",
        text: "text-[var(--safc-pink)]",
        ring: "ring-[var(--safc-pink)]",
        grad: "linear-gradient(135deg, var(--safc-pink), var(--safc-cobalt))",
      };
    case "basic":
      return {
        bg: "bg-[var(--safc-green)]/15",
        text: "text-[var(--safc-green)]",
        ring: "ring-[var(--safc-green)]",
        grad: "linear-gradient(135deg, var(--safc-green), #0b3b22)",
      };
    default:
      return {
        bg: "bg-white/10",
        text: "text-foreground",
        ring: "ring-white/30",
        grad: "linear-gradient(135deg, #1a1a1a, #2a2a2a)",
      };
  }
}
