import { useQuery } from "@tanstack/react-query";
import { Trophy, Sparkles, CalendarDays, UserPlus, Flame, Plane, Crown } from "lucide-react";
import { db } from "@/lib/db";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy, sparkles: Sparkles, "calendar-days": CalendarDays,
  "user-plus": UserPlus, flame: Flame, plane: Plane, crown: Crown,
};
const TIER_COLOR: Record<string, string> = {
  bronze: "from-amber-700/50 to-amber-900/30 ring-amber-600/30",
  silver: "from-zinc-400/50 to-zinc-700/30 ring-zinc-300/30",
  gold:   "from-yellow-400/50 to-amber-700/40 ring-yellow-300/40",
};

type Row = { id: string; name: string; description: string; icon: string; tier: string; earned: boolean };

export function AchievementsList({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["achievements", userId],
    queryFn: async () => {
      const [{ data: all }, { data: mine }] = await Promise.all([
        db.from("achievements").select("*"),
        db.from("user_achievements").select("achievement_id").eq("user_id", userId),
      ]);
      const earned = new Set(((mine ?? []) as { achievement_id: string }[]).map((m) => m.achievement_id));
      return ((all ?? []) as Omit<Row, "earned">[]).map((a) => ({ ...a, earned: earned.has(a.id) }));
    },
  });
  if (!q.data) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {q.data.map((a) => {
        const Icon = ICONS[a.icon] ?? Trophy;
        return (
          <div
            key={a.id}
            title={`${a.name} — ${a.description}`}
            className={`relative aspect-square rounded-xl bg-gradient-to-br p-3 text-center ring-1 ${TIER_COLOR[a.tier] ?? TIER_COLOR.bronze} ${a.earned ? "" : "opacity-30 grayscale"}`}
          >
            <Icon className="mx-auto h-6 w-6 text-foreground" />
            <div className="mt-1 text-[10px] font-bold leading-tight">{a.name}</div>
          </div>
        );
      })}
    </div>
  );
}
