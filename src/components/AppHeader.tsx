import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { User as UserIcon, Crown } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { SafcLogo } from "@/components/SafcLogo";

export function AppHeader({ title }: { title?: string }) {
  const { user, profile } = useAuth();
  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3">
      <Link to="/" className="flex items-center gap-2.5">
        <SafcLogo size={38} />
        <div className="leading-tight">
          <div className="font-display text-sm font-extrabold tracking-tight">SAFC</div>
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
          {profile?.plan === "gold" && <Crown className="h-3.5 w-3.5 text-[var(--safc-yellow)]" />}
          <span className="max-w-[80px] truncate font-semibold">
            {user ? profile?.full_name?.split(" ")[0] || "Profile" : "Sign in"}
          </span>
          <div className={`grid h-6 w-6 place-items-center rounded-full ${profile?.plan === "gold" ? "shimmer-gold text-black" : "bg-surface-2"}`}>
            <UserIcon className="h-3.5 w-3.5" />
          </div>
        </Link>
      </div>
    </header>
  );
}
