import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Loader2, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

type FollowState = "none" | "pending" | "accepted";

export function FollowButton({ targetId, compact }: { targetId: string; compact?: boolean }) {
  const { user } = useAuth();
  const [state, setState] = useState<FollowState>("none");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetId) {
      setReady(true);
      return;
    }
    db.from("follows")
      .select("status")
      .eq("follower_id", user.id)
      .eq("following_id", targetId)
      .maybeSingle()
      .then(({ data }: { data: { status?: string } | null }) => {
        setState(data ? (data.status === "accepted" ? "accepted" : "pending") : "none");
        setReady(true);
      });
  }, [user, targetId]);

  if (!user || user.id === targetId || !ready) return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (state === "none") {
        // Insert; trigger sets accepted/pending based on target privacy
        const { data, error } = await db
          .from("follows")
          .insert({ follower_id: user.id, following_id: targetId })
          .select("status")
          .single();
        if (error) throw error;
        const next: FollowState = data?.status === "accepted" ? "accepted" : "pending";
        setState(next);
        await logAudit("CREATE", "follow", `${user.id}->${targetId}`, null, { status: next });
        if (next === "pending") toast.success("Follow request sent");
      } else {
        const { error } = await db
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetId);
        if (error) throw error;
        await logAudit("DELETE", "follow", `${user.id}->${targetId}`, { status: state }, null);
        setState("none");
      }
    } catch (err) {
      toast.error((err as Error).message || "Could not update");
    } finally {
      setLoading(false);
    }
  };

  const base = compact ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-xs";
  const styles =
    state === "accepted"
      ? "bg-surface-2 text-muted-foreground"
      : state === "pending"
      ? "bg-surface-2 text-[var(--safc-yellow)] ring-1 ring-[var(--safc-yellow)]/40"
      : "bg-primary text-primary-foreground";
  const Icon = loading ? Loader2 : state === "accepted" ? UserCheck : state === "pending" ? Clock : UserPlus;
  const label = state === "accepted" ? "Following" : state === "pending" ? "Requested" : "Follow";

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider transition ${base} ${styles}`}
    >
      <Icon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
