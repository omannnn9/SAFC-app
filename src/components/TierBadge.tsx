import { TIERS, tierTone, type Tier } from "@/lib/tiers";

export function TierBadge({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "md" }) {
  const def = TIERS.find((t) => t.id === tier) ?? TIERS[0];
  const Icon = def.icon;
  const tone = tierTone(tier);
  const isLg = size === "md";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${tone.bg} ${tone.text} ${isLg ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"} font-black uppercase tracking-wider ring-1 ${tone.ring}/40`}
    >
      <Icon className={isLg ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {def.badge}
    </span>
  );
}
