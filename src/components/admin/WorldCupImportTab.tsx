import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { adminImportWorldCupRows } from "@/lib/wc-import.functions";
import { supabase } from "@/integrations/supabase/client";

type ParsedRow = {
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  kickoff_utc: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final" | "other";
  group_note: string | null;
  external_id: string;
  // for preview
  date_str: string;
  time_str: string;
};

const STAGE_MAP: Record<string, ParsedRow["stage"]> = {
  "group stage": "group",
  group: "group",
  "round of 32": "r32",
  r32: "r32",
  "round of 16": "r16",
  r16: "r16",
  "quarter-final": "qf",
  quarterfinal: "qf",
  quarterfinals: "qf",
  "quarter finals": "qf",
  qf: "qf",
  "semi-final": "sf",
  semifinal: "sf",
  semifinals: "sf",
  "semi finals": "sf",
  sf: "sf",
  "third-place": "third",
  "third place": "third",
  third: "third",
  final: "final",
};

function normStage(s: string): ParsedRow["stage"] {
  const key = s.trim().toLowerCase();
  return STAGE_MAP[key] ?? "other";
}

// MUT = UTC+4 (no DST). Convert "YYYY-MM-DD" + "HH:MM" MUT → ISO UTC.
function mutToUtcIso(dateStr: string, timeStr: string): string | null {
  const dm = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return null;
  const [, y, mo, d] = dm;
  const [, h, mi] = tm;
  // Construct as UTC then subtract 4 hours (MUT offset).
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h - 4, +mi, 0);
  if (!Number.isFinite(utcMs)) return null;
  return new Date(utcMs).toISOString();
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

function parseWorkbook(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
        const rows: ParsedRow[] = [];
        for (const r of json) {
          const home = asString(r["Home Team"]);
          const away = asString(r["Away Team"]);
          const date = asString(r["Date"]);
          const time = asString(r["Time (MUT)"]);
          if (!home || !away || !date || !time) continue;
          const iso = mutToUtcIso(date, time);
          if (!iso) continue;
          rows.push({
            home_team: home,
            away_team: away,
            home_flag: asString(r["Home Flag"]) || null,
            away_flag: asString(r["Away Flag"]) || null,
            kickoff_utc: iso,
            venue: asString(r["Stadium"]) || null,
            city: asString(r["City"]) || null,
            country: asString(r["Country"]) || null,
            stage: normStage(asString(r["Stage"])),
            group_note: asString(r["Group/Note"]) || null,
            external_id: `wc:${home}-${away}-${date}-${time}`.replace(/\s+/g, "_"),
            date_str: date,
            time_str: time,
          });
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function WorldCupImportTab() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFn = useServerFn(adminImportWorldCupRows);

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const parsed = await parseWorkbook(file);
      setRows(parsed);
      setFileName(file.name);
      if (parsed.length === 0) toast.error("No valid match rows found");
      else toast.success(`Parsed ${parsed.length} matches`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      // Ensure we have a fresh access token before calling protected serverFn
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.error("You're signed out — please sign in again.");
        setImporting(false);
        return;
      }
      await supabase.auth.refreshSession();
      // batch in chunks of 100
      let total = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100).map((r) => ({
          home_team: r.home_team,
          away_team: r.away_team,
          home_flag: r.home_flag,
          away_flag: r.away_flag,
          kickoff_utc: r.kickoff_utc,
          venue: r.venue,
          city: r.city,
          country: r.country,
          stage: r.stage,
          group_note: r.group_note,
          external_id: r.external_id,
        }));
        const res = await importFn({ data: { rows: chunk } });
        total += res.count;
      }
      toast.success(`Imported / updated ${total} matches`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          <FileSpreadsheet className="mr-1 inline h-3 w-3" /> World Cup import
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload the official .xlsx schedule. Rows are deduplicated by Home/Away/Date/Time and stored in UTC
          (source is Mauritius time, UTC+4). Local timezone for preview: <span className="font-bold">{tz}</span>.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary-foreground">
            <Upload className="h-3 w-3" />
            {busy ? "Parsing…" : "Choose .xlsx"}
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {fileName && <span className="text-[10px] text-muted-foreground">{fileName}</span>}
          {rows.length > 0 && (
            <button
              onClick={runImport}
              disabled={importing}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Import {rows.length}
            </button>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="glass rounded-2xl p-2">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-surface-2 text-left text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Match</th>
                  <th className="p-2">Stage</th>
                  <th className="p-2">Kickoff (local)</th>
                  <th className="p-2">Venue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const local = new Date(r.kickoff_utc).toLocaleString();
                  const placeholder = /^[WL] (SF|QF|R)\d/i.test(r.home_team) || /^[WL] (SF|QF|R)\d/i.test(r.away_team);
                  return (
                    <tr key={r.external_id} className="border-t border-border/30">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">
                        <span className="mr-1">{r.home_flag}</span>{r.home_team}
                        <span className="mx-1 text-muted-foreground">vs</span>
                        <span className="mr-1">{r.away_flag}</span>{r.away_team}
                        {placeholder && <AlertTriangle className="ml-1 inline h-3 w-3 text-yellow-500" />}
                      </td>
                      <td className="p-2 uppercase">{r.stage}{r.group_note ? ` · ${r.group_note}` : ""}</td>
                      <td className="p-2">{local}</td>
                      <td className="p-2 text-muted-foreground">{[r.venue, r.city, r.country].filter(Boolean).join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
