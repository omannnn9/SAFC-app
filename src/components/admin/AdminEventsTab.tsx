import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Loader2, Plus, Save, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import type { EventRow } from "@/lib/social";
import { adminDeleteEvent, adminClearAllEvents, adminSaveEvent } from "@/lib/admin.functions";

const EVENT_TYPES = ["wc_match", "match", "tournament", "fan_zone", "meetup", "festival", "travel"] as const;
const STAGES = ["group", "r32", "r16", "qf", "sf", "third", "final", "friendly", "other"] as const;
const STATUSES = ["scheduled", "live", "finished"] as const;

type EventDraft = EventRow & { external_id?: string | null; created_at?: string; updated_at?: string };

const inputClass = "w-full rounded-lg bg-surface-2 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary";

function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function blankEvent(userId?: string): EventDraft {
  const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "new",
    title: "New SA FC event",
    description: null,
    event_type: "match",
    stage: "other",
    competition: "SA FC",
    home_team: null,
    away_team: null,
    home_team_flag: null,
    away_team_flag: null,
    kickoff,
    venue: null,
    city: null,
    country: "South Africa",
    cover_url: null,
    status: "scheduled",
    home_score: null,
    away_score: null,
    minute: null,
    is_featured: false,
    created_by: userId ?? null,
    external_id: null,
  };
}

export function AdminEventsTab() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const clearAll = useServerFn(adminClearAllEvents);
  const eventsQ = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await db.from("events").select("*").order("kickoff", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as EventDraft[];
    },
  });

  const handleClearAll = async () => {
    if (!confirm(`Permanently delete ALL ${eventsQ.data?.length ?? 0} events and World Cup matches? This cannot be undone.`)) return;
    if (!confirm("Are you absolutely sure? Type OK in the next prompt to confirm.")) return;
    const answer = prompt('Type "DELETE ALL" to confirm');
    if (answer !== "DELETE ALL") return toast.info("Cancelled");
    setClearing(true);
    try {
      await clearAll();
      toast.success("All events cleared");
      eventsQ.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="glass flex items-center justify-between gap-3 rounded-2xl p-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            <CalendarDays className="mr-1 inline h-3 w-3" /> Events control
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Create events and modify every matchday detail.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-destructive disabled:opacity-50"
          >
            {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />} Clear all
          </button>
          <button
            onClick={() => setCreating((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
      </div>

      {creating && (
        <EventEditor
          event={blankEvent(user?.id)}
          onSaved={() => {
            setCreating(false);
            eventsQ.refetch();
          }}
        />
      )}

      {eventsQ.isLoading && <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-primary" />}
      {eventsQ.data?.map((event) => <EventEditor key={event.id} event={event} onSaved={() => eventsQ.refetch()} />)}
    </div>
  );
}

function EventEditor({ event, onSaved }: { event: EventDraft; onSaved: () => void }) {
  const [draft, setDraft] = useState<EventDraft>(event);
  const [busy, setBusy] = useState(false);
  const isNew = draft.id === "new";
  const deleteEvent = useServerFn(adminDeleteEvent);
  const saveEvent = useServerFn(adminSaveEvent);
  const update = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const payload = () => ({
    title: draft.title.trim(),
    description: draft.description || null,
    event_type: draft.event_type,
    stage: draft.stage,
    competition: draft.competition || null,
    home_team: draft.home_team || null,
    away_team: draft.away_team || null,
    home_team_flag: draft.home_team_flag || null,
    away_team_flag: draft.away_team_flag || null,
    kickoff: new Date(draft.kickoff).toISOString(),
    venue: draft.venue || null,
    city: draft.city || null,
    country: draft.country || null,
    cover_url: draft.cover_url || null,
    status: draft.status,
    home_score: draft.home_score,
    away_score: draft.away_score,
    minute: draft.minute,
    is_featured: draft.is_featured,
    created_by: draft.created_by,
  });

  const save = async () => {
    if (!draft.title.trim()) return toast.error("Event title is required");
    if (!Number.isFinite(new Date(draft.kickoff).getTime())) return toast.error("Kickoff date is invalid");
    setBusy(true);
    try {
      await saveEvent({ data: { eventId: isNew ? null : draft.id, event: payload() } });
      toast.success(isNew ? "Event created" : "Event saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (isNew) return;
    if (!confirm(`Delete ${draft.title}? This also removes RSVPs, the group chat, and any linked World Cup match.`)) return;
    setBusy(true);
    try {
      await deleteEvent({ data: { eventId: draft.id } });
      toast.success("Event deleted");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass space-y-3 rounded-2xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black uppercase tracking-wider">{isNew ? "Create event" : draft.title}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(draft.kickoff).toLocaleString()}</div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <input type="checkbox" checked={draft.is_featured} onChange={(e) => update("is_featured", e.target.checked)} /> Featured
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Title"><input value={draft.title} onChange={(e) => update("title", e.target.value)} className={inputClass} /></Field>
        <Field label="Type"><select value={draft.event_type} onChange={(e) => update("event_type", e.target.value as EventDraft["event_type"])} className={inputClass}>{EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
        <Field label="Status"><select value={draft.status} onChange={(e) => update("status", e.target.value as EventDraft["status"])} className={inputClass}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
      </div>

      <Field label="Description"><textarea value={draft.description ?? ""} onChange={(e) => update("description", e.target.value || null)} rows={2} className={inputClass} /></Field>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Competition"><input value={draft.competition ?? ""} onChange={(e) => update("competition", e.target.value || null)} className={inputClass} /></Field>
        <Field label="Stage"><select value={draft.stage ?? "other"} onChange={(e) => update("stage", e.target.value as EventDraft["stage"])} className={inputClass}>{STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></Field>
        <Field label="Kickoff"><input type="datetime-local" value={toLocalInput(draft.kickoff)} onChange={(e) => update("kickoff", new Date(e.target.value).toISOString())} className={inputClass} /></Field>
        <Field label="Venue"><input value={draft.venue ?? ""} onChange={(e) => update("venue", e.target.value || null)} className={inputClass} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Home team"><input value={draft.home_team ?? ""} onChange={(e) => update("home_team", e.target.value || null)} className={inputClass} /></Field>
        <Field label="Home flag"><input value={draft.home_team_flag ?? ""} onChange={(e) => update("home_team_flag", e.target.value || null)} className={inputClass} /></Field>
        <Field label="Away team"><input value={draft.away_team ?? ""} onChange={(e) => update("away_team", e.target.value || null)} className={inputClass} /></Field>
        <Field label="Away flag"><input value={draft.away_team_flag ?? ""} onChange={(e) => update("away_team_flag", e.target.value || null)} className={inputClass} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Home score"><input type="number" value={draft.home_score ?? ""} onChange={(e) => update("home_score", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Away score"><input type="number" value={draft.away_score ?? ""} onChange={(e) => update("away_score", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} /></Field>
        <Field label="Minute"><input type="number" value={draft.minute ?? ""} onChange={(e) => update("minute", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} /></Field>
        <Field label="City"><input value={draft.city ?? ""} onChange={(e) => update("city", e.target.value || null)} className={inputClass} /></Field>
        <Field label="Country"><input value={draft.country ?? ""} onChange={(e) => update("country", e.target.value || null)} className={inputClass} /></Field>
      </div>

      <Field label="Cover image URL"><input value={draft.cover_url ?? ""} onChange={(e) => update("cover_url", e.target.value || null)} className={inputClass} /></Field>

      <div className="flex justify-end gap-2">
        {!isNew && (
          <button onClick={remove} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-[10px] font-black uppercase tracking-wider text-destructive-foreground">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        )}
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}