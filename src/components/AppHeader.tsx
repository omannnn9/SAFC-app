import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { User as UserIcon, Crown } from "lucide-react";

export function AppHeader({ title }: { title?: string }) {
  const { user, profile } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl">
      <Link to="/" className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--sa-green)] text-xs font-bold text-white">
          SA
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-bold tracking-tight">BAFANA</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {title ?? "Supporters Club"}
          </div>
        </div>
      </Link>
      <Link
        to={user ? "/profile" : "/login"}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-2 py-1.5 text-xs"
      >
        {profile?.is_premium && <Crown className="h-3.5 w-3.5 text-primary" />}
        <span className="max-w-[80px] truncate font-medium">
          {user ? profile?.full_name?.split(" ")[0] || "Profile" : "Sign in"}
        </span>
        <div className="grid h-6 w-6 place-items-center rounded-full bg-surface-2">
          <UserIcon className="h-3.5 w-3.5" />
        </div>
      </Link>
    </header>
  );
}
