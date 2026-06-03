import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { PageContainer } from "@/components/PageContainer";
import { getMyPushPrefs, updatePushPrefs, sendTestPush } from "@/lib/push.functions";
import { Bell, Zap, Goal, Flag, Users, Newspaper } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications · SAFC" }] }),
});

type Prefs = { kickoff: boolean; goal: boolean; fulltime: boolean; squad: boolean; article: boolean };
const DEFAULT: Prefs = { kickoff: true, goal: true, fulltime: true, squad: true, article: true };

const ITEMS: { key: keyof Prefs; label: string; desc: string; Icon: typeof Bell }[] = [
  { key: "kickoff", label: "Kick-off starting", desc: "15 minutes before Bafana kick off", Icon: Zap },
  { key: "goal", label: "Goal scored", desc: "Every goal in a live Bafana match", Icon: Goal },
  { key: "fulltime", label: "Full-time result", desc: "Final score when the match ends", Icon: Flag },
  { key: "squad", label: "Squad announced", desc: "When a new Bafana squad is named", Icon: Users },
  { key: "article", label: "New article published", desc: "Breaking news from official sources", Icon: Newspaper },
];

function NotificationsPage() {
  const fetchPrefs = useServerFn(getMyPushPrefs);
  const updateFn = useServerFn(updatePushPrefs);
  const testFn = useServerFn(sendTestPush);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["push-prefs"], queryFn: () => fetchPrefs() });
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);

  useEffect(() => {
    const first = data?.subscriptions?.[0]?.prefs as Prefs | undefined;
    if (first) setPrefs({ ...DEFAULT, ...first });
  }, [data]);

  const mutate = useMutation({
    mutationFn: (p: Prefs) => updateFn({ data: { prefs: p } }),
    onSuccess: () => {
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["push-prefs"] });
    },
    onError: () => toast.error("Couldn't save"),
  });

  const hasSubs = (data?.subscriptions?.length ?? 0) > 0;

  const toggle = (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    mutate.mutate(next);
  };

  const sendTest = async () => {
    const r = await testFn({});
    if (r.sent > 0) toast.success(`Test sent to ${r.sent} device(s)`);
    else toast.error("No devices subscribed yet — tap the bell in the header first");
  };

  return (
    <>
      <AppHeader title="Notifications" />
      <PageContainer>
        <div className="space-y-6 py-6">
          <div>
            <h1 className="font-display text-2xl font-black">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose what we ping you about. Tap the bell in the header to enable on this device.
            </p>
          </div>

          {!hasSubs && (
            <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
              You haven't enabled push on any device yet. Tap the <strong className="text-foreground">bell icon</strong> at the top of the screen to start.
            </div>
          )}

          <div className="glass divide-y divide-white/5 overflow-hidden rounded-2xl">
            {ITEMS.map(({ key, label, desc, Icon }) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                disabled={!hasSubs}
                className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/5 disabled:opacity-50"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <div
                  className={`relative h-6 w-11 rounded-full transition ${prefs[key] ? "bg-primary" : "bg-surface-2"}`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${prefs[key] ? "left-[22px]" : "left-0.5"}`}
                  />
                </div>
              </button>
            ))}
          </div>

          {hasSubs && (
            <button
              onClick={sendTest}
              className="glass w-full rounded-xl py-3 text-sm font-semibold transition hover:ring-glow-gold"
            >
              Send a test notification
            </button>
          )}

          {hasSubs && (
            <div className="text-xs text-muted-foreground">
              Subscribed on {data?.subscriptions?.length} device(s).
              {typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                <p className="mt-2">
                  iOS tip: add this app to your Home Screen for notifications to work in the
                  background.
                </p>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
