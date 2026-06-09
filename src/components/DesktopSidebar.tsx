import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Users,
  Trophy,
  MessageCircle,
  User,
  Crown,
  CalendarDays,
  Bell,
  Shield,
  ListChecks,
  Globe2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SafcLogo } from "@/components/SafcLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { effectiveTier } from "@/lib/tiers";

const PRIMARY = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/worldcup", label: "World Cup", icon: Globe2 },
  { to: "/community", label: "Community", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/membership", label: "Membership", icon: Crown },
] as const;

export function DesktopSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile } = useAuth();
  const tier = effectiveTier(profile);

  const isAdminQ = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/") || path.startsWith(to + ".");

  return (
    <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-60 lg:w-64 md:flex-col md:border-r md:border-white/10 md:bg-[oklch(0.13_0.02_160)]/85 md:backdrop-blur-xl">
      <Link to="/" className="flex items-center gap-2.5 px-5 py-4">
        <SafcLogo size={36} />
        <div className="leading-tight">
          <div className="font-display text-base font-extrabold tracking-tight">SAFC</div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            We are SAFC
          </div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <NavSection label="Browse">
          {PRIMARY.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={isActive(item.to, (item as any).exact)}
            />
          ))}
        </NavSection>

        {user && (
          <NavSection label="You">
            <NavItem to="/account" label="Profile" icon={User} active={isActive("/account")} />
            <NavItem
              to="/messages"
              label="Notifications"
              icon={Bell}
              active={path.startsWith("/notifications")}
            />
          </NavSection>
        )}

        {isAdminQ.data && (
          <NavSection label="Admin">
            <NavItem to="/admin" label="Admin dashboard" icon={Shield} active={path === "/admin"} />
            <NavItem
              to="/admin"
              label="Audit log"
              icon={ListChecks}
              active={path.startsWith("/admin") && path.includes("audit")}
            />
            <NavItem
              to="/admin/worldcup"
              label="World Cup admin"
              icon={Trophy}
              active={path.startsWith("/admin/worldcup")}
            />
          </NavSection>
        )}
      </nav>

      <Link
        to={user ? "/account" : "/login"}
        className="m-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 transition hover:bg-white/10"
      >
        <UserAvatar
          name={profile?.full_name}
          src={profile?.avatar_url ?? null}
          size={36}
          ring={tier === "founder" ? "gold" : null}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">
            {user ? profile?.full_name?.split(" ")[0] ?? "Profile" : "Sign in"}
          </div>
          <div className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {user ? `${tier} tier` : "Join SAFC"}
          </div>
        </div>
        {tier === "founder" && <Crown className="h-4 w-4 text-[var(--safc-yellow)]" />}
      </Link>
    </aside>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="px-3 pb-1 pt-3 text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
          active
            ? "bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        }`}
      >
        <Icon className={`h-[18px] w-[18px] ${active ? "text-primary" : ""}`} />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}
