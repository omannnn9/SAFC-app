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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <nav className="glass-strong pointer-events-auto w-full max-w-md rounded-2xl px-2 py-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <ul className="flex items-stretch justify-between">
          {items.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className="group relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition"
                >
                  {active && (
                    <span className="absolute inset-x-3 -top-2 h-[3px] rounded-full bg-primary shadow-[0_0_12px_2px_var(--sa-gold)]" />
                  )}
                  <Icon
                    className={`h-5 w-5 transition ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                  />
                  <span
                    className={`text-[10px] font-semibold tracking-wide transition ${active ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
