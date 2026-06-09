import { MembershipComingSoonModal } from "@/components/MembershipComingSoon";
import type { Tier, TierFeature } from "@/lib/tiers";

/**
 * Renders the "Premium Memberships Coming Soon" modal in place of the old
 * upgrade gate. Props kept for backwards compatibility with call sites.
 */
export function UpgradeModal({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  currentTier?: Tier;
  feature?: TierFeature;
  targetTier?: Tier;
  title?: string;
  reason?: string;
}) {
  return <MembershipComingSoonModal open={open} onClose={onClose} title={title ?? "Unlock SAFC"} />;
}
