import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { User as UserIcon, Crown } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";



export function AppHeader({ title }: { title?: string }) {
  const { user, profile } = useAuth();
  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3">
      <Link to="/" className="flex items-center gap-2.5">
        <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[var(--sa-green)] to-[oklch(0.4_0.13_155)] text-[11px] font-black text-white shadow-[var(--shadow-glow-green)]">
          SA
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--sa-gold)]" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-black tracking-tight">BAFANA</div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {title ?? "Supporters Club"}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link
          to={user ? "/account" : "/login"}
          className="glass flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs transition hover:ring-glow-gold"
        >
          {profile?.plan === "vip" && <Crown className="h-3.5 w-3.5 text-primary" />}
          <span className="max-w-[80px] truncate font-semibold">
            {user ? profile?.full_name?.split(" ")[0] || "Profile" : "Sign in"}
          </span>
          <div className={`grid h-6 w-6 place-items-center rounded-full ${profile?.plan === "vip" ? "shimmer-gold text-black" : "bg-surface-2"}`}>
            <UserIcon className="h-3.5 w-3.5" />
          </div>
        </Link>
      </div>
    </header>
  );
}
