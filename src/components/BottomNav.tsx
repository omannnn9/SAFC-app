import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Newspaper, Users, CalendarDays, Crown } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { to: "/premium", label: "Premium", icon: Crown },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl">
      <ul className="flex items-stretch justify-between">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors"
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[10px] font-medium tracking-wide ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
