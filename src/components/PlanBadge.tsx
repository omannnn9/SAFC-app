import { planToTier, type Plan } from "@/lib/plans";
import { TierBadge } from "@/components/TierBadge";

/**
 * Legacy plan badge — now renders the new tier badge after mapping
 * bronze/silver/gold onto free/basic/premium/founder.
 */
export function PlanBadge({ plan, size = "sm" }: { plan: Plan; size?: "sm" | "md" }) {
  return <TierBadge tier={planToTier(plan)} size={size} />;
}
