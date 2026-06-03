import { PLANS, planTone, type Plan } from "@/lib/plans";

export function PlanBadge({ plan, size = "sm" }: { plan: Plan; size?: "sm" | "md" }) {
  const def = PLANS.find((p) => p.id === plan);
  if (!def) return null;
  const Icon = def.icon;
  const tone = planTone(plan);
  const isLg = size === "md";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${tone.bg} ${tone.text} ${isLg ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"} font-black uppercase tracking-wider`}
    >
      <Icon className={isLg ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {plan}
    </span>
  );
}
