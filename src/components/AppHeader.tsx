import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { User as UserIcon, Crown, Star } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { SafcLogo } from "@/components/SafcLogo";
import { effectiveTier } from "@/lib/tiers";

export function AppHeader({ title }: { title?: string }) {
  const { user, profile } = useAuth();
  const tier = effectiveTier(profile);
  const isFounder = tier === "founder";
  const isPremium = tier === "premium";
  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3">
      <Link to="/" className="flex items-center gap-2.5">
        <SafcLogo size={38} />
        <div className="leading-tight">
          <div className="font-display text-sm font-extrabold tracking-tight">SA FC</div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {title ?? "Football Community"}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link
          to={user ? "/account" : "/login"}
          className="glass flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs transition hover:ring-glow-pink"
        >
          {isFounder && <Crown className="h-3.5 w-3.5 text-[var(--safc-yellow)]" />}
          {isPremium && <Star className="h-3.5 w-3.5 text-[var(--safc-pink)]" />}
          <span className="max-w-[80px] truncate font-semibold">
            {user ? profile?.full_name?.split(" ")[0] || "Profile" : "Sign in"}
          </span>
          <div
            className={`grid h-6 w-6 place-items-center rounded-full ${
              isFounder
                ? "shimmer-gold text-black"
                : isPremium
                ? "bg-[var(--safc-pink)]/30 text-[var(--safc-pink)]"
                : "bg-surface-2"
            }`}
          >
            <UserIcon className="h-3.5 w-3.5" />
          </div>
        </Link>
      </div>
    </header>
  );
}
