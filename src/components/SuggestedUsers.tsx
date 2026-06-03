import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchSuggestedUsers } from "@/lib/social";
import { UserAvatar } from "@/components/UserAvatar";
import { FollowButton } from "@/components/FollowButton";

export function SuggestedUsers() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["suggested-users", user?.id ?? "anon"],
    queryFn: () => fetchSuggestedUsers(user?.id ?? null, 8),
  });
  if (!q.data || q.data.length === 0) return null;
  return (
    <section className="mt-5 px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" /> Suggested supporters
        </h2>
        <Link to="/community" className="text-[11px] font-semibold text-primary">See all →</Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 scrollbar-none">
        {q.data.map((p) => (
          <div key={p.id} className="glass min-w-[170px] max-w-[170px] shrink-0 rounded-2xl p-3 text-center">
            <Link to="/u/$id" params={{ id: p.id }} className="block">
              <UserAvatar name={p.full_name} src={p.avatar_url} size={64} ring={p.plan === "gold" ? "gold" : null} className="mx-auto" />
              <div className="mt-2 truncate font-display text-sm font-black">{p.full_name}</div>
              <div className="truncate text-[10px] text-muted-foreground">{p.reason}</div>
            </Link>
            <div className="mt-2 flex justify-center">
              <FollowButton targetId={p.id} compact />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
