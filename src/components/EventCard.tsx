import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { EventRow } from "@/lib/social";

export function EventCard({ event, attendees }: { event: EventRow; attendees?: number }) {
  const date = new Date(event.kickoff);
  const day = date.toLocaleDateString(undefined, { day: "2-digit" });
  const mon = date.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="glass group relative block overflow-hidden rounded-2xl p-4 transition hover:ring-glow-gold"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--sa-green)] to-[oklch(0.4_0.13_155)] text-center">
          <div>
            <div className="font-display text-xl font-black leading-none text-white">{day}</div>
            <div className="text-[10px] font-bold tracking-wider text-white/80">{mon}</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {event.competition ?? event.event_type.replace("_", " ")}
          </div>
          <div className="mt-0.5 truncate font-display text-base font-black">{event.title}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> {time}
            {event.venue && (
              <>
                <span className="opacity-50">·</span>
                <MapPin className="h-3 w-3" /> <span className="truncate">{event.venue}</span>
              </>
            )}
          </div>
          {typeof attendees === "number" && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-foreground">
              <Users className="h-3 w-3 text-primary" /> {attendees} going
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
