import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toggleFollow } from "@/lib/social";
import { toast } from "sonner";

export function FollowButton({ targetId, compact }: { targetId: string; compact?: boolean }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetId) {
      setReady(true);
      return;
    }
    db.from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", targetId)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => {
        setFollowing(!!data);
        setReady(true);
      });
  }, [user, targetId]);

  if (!user || user.id === targetId || !ready) return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      await toggleFollow(targetId, user.id, !next);
    } catch {
      setFollowing(!next);
      toast.error("Could not update");
    }
    setLoading(false);
  };

  const base = compact ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-xs";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider transition ${base} ${
        following ? "bg-surface-2 text-muted-foreground" : "bg-primary text-primary-foreground"
      }`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
