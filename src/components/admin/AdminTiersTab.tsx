import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, Crown, UserPlus, UserMinus, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  listTierConfig,
  adminUpdateTier,
  getFoundersList,
  adminAssignFounder,
  adminRevokeFounder,
  adminSetUserTier,
  getFoundersCount,
} from "@/lib/membership.functions";
import { FOUNDER_CAP, formatMemberNo, type Tier } from "@/lib/tiers";

type TierRow = {
  id: Tier;
  name: string;
  tagline: string | null;
  price_cents: number;
  perks: string[];
  visible: boolean;
};

export function AdminTiersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTierConfig);
  const updateFn = useServerFn(adminUpdateTier);
  const tiersQ = useQuery({ queryKey: ["admin-tiers"], queryFn: () => listFn() });
  const tiers = (tiersQ.data as TierRow[] | undefined) ?? [];

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Edit pricing, perks and visibility for each SAFC membership tier. Changes apply instantly.</div>
      {tiersQ.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {tiers.map((t) => (
        <TierEditor
          key={t.id}
          row={t}
          onSave={async (next) => {
            await updateFn({ data: next });
            toast.success(`${next.name} saved`);
            qc.invalidateQueries({ queryKey: ["admin-tiers"] });
            qc.invalidateQueries({ queryKey: ["tier-config"] });
          }}
        />
      ))}
    </div>
  );
}

function TierEditor({ row, onSave }: { row: TierRow; onSave: (next: TierRow) => Promise<void> }) {
  const [name, setName] = useState(row.name);
  const [tagline, setTagline] = useState(row.tagline ?? "");
  const [price, setPrice] = useState(String(row.price_cents / 100));
  const [perks, setPerks] = useState(row.perks.join("\n"));
  const [visible, setVisible] = useState(row.visible);
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display text-base font-black tracking-tight">{row.id.toUpperCase()}</div>
        <button
          onClick={() => setVisible((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider"
        >
          {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {visible ? "Visible" : "Hidden"}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <div className="mb-1 font-bold uppercase tracking-wider text-muted-foreground">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs">
          <div className="mb-1 font-bold uppercase tracking-wider text-muted-foreground">Price (R/month, 0 = free)</div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="sm:col-span-2 text-xs">
          <div className="mb-1 font-bold uppercase tracking-wider text-muted-foreground">Tagline</div>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm" />
        </label>
        <label className="sm:col-span-2 text-xs">
          <div className="mb-1 font-bold uppercase tracking-wider text-muted-foreground">Perks (one per line)</div>
          <textarea value={perks} onChange={(e) => setPerks(e.target.value)} rows={5} className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                id: row.id,
                name: name.trim(),
                tagline: tagline.trim() || null,
                price_cents: Math.max(0, Math.round(parseFloat(price || "0") * 100)),
                perks: perks.split("\n").map((p) => p.trim()).filter(Boolean),
                visible,
              });
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
      </div>
    </div>
  );
}

export function AdminFoundersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(getFoundersList);
  const countFn = useServerFn(getFoundersCount);
  const assignFn = useServerFn(adminAssignFounder);
  const revokeFn = useServerFn(adminRevokeFounder);
  const setTierFn = useServerFn(adminSetUserTier);

  const foundersQ = useQuery({ queryKey: ["admin-founders"], queryFn: () => listFn() });
  const countQ = useQuery({ queryKey: ["admin-founders-count"], queryFn: () => countFn() });
  const founders =
    (foundersQ.data as Array<{ id: string; full_name: string | null; username: string | null; member_no: number | null; founder_at: string | null }> | undefined) ??
    [];
  const count = (countQ.data as { count: number } | undefined)?.count ?? 0;

  const [q, setQ] = useState("");
  const searchQ = useQuery({
    queryKey: ["admin-search-user", q],
    queryFn: async () => {
      if (!q || q.length < 2) return [];
      const { data } = await db
        .from("profiles")
        .select("id, full_name, username, member_no, tier, is_founder")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(8);
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-founders"] });
    qc.invalidateQueries({ queryKey: ["admin-founders-count"] });
    qc.invalidateQueries({ queryKey: ["admin-search-user"] });
    qc.invalidateQueries({ queryKey: ["founders-count"] });
    qc.invalidateQueries({ queryKey: ["founders-list"] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--safc-yellow)]/30 bg-[var(--safc-yellow)]/10 p-4">
        <div className="flex items-center gap-2 font-display text-lg font-black tracking-tight text-[var(--safc-yellow)]">
          <Crown className="h-5 w-5" /> Starting XI · {count} / {FOUNDER_CAP}
        </div>
        <div className="text-xs text-white/70">{FOUNDER_CAP - count} founding spots remaining.</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Assign a founder or change a user's tier</div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username or name…"
          className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm"
        />
        {searchQ.data && searchQ.data.length > 0 && (
          <ul className="mt-2 divide-y divide-white/5">
            {searchQ.data.map((u) => {
              const user = u as { id: string; full_name: string | null; username: string | null; member_no: number | null; tier: Tier; is_founder: boolean };
              return (
                <li key={user.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{user.full_name || user.username || "—"}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatMemberNo(user.member_no)} · {user.tier}{user.is_founder ? " · founder" : ""}
                    </div>
                  </div>
                  <select
                    defaultValue={user.tier}
                    onChange={async (e) => {
                      const tier = e.target.value as Tier;
                      try {
                        await setTierFn({ data: { userId: user.id, tier } });
                        toast.success("Tier updated");
                        refresh();
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                    className="rounded-lg bg-surface-2 px-2 py-1 text-xs"
                  >
                    <option value="free">free</option>
                    <option value="basic">basic</option>
                    <option value="premium">premium</option>
                    <option value="founder">founder</option>
                  </select>
                  {!user.is_founder ? (
                    <button
                      onClick={async () => {
                        try {
                          await assignFn({ data: { userId: user.id } });
                          toast.success("Founder assigned");
                          refresh();
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--safc-yellow)] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-black"
                    >
                      <UserPlus className="h-3 w-3" /> Make Founder
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          await revokeFn({ data: { userId: user.id } });
                          toast.success("Founder revoked");
                          refresh();
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider"
                    >
                      <UserMinus className="h-3 w-3" /> Revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Current founders</div>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {founders.length === 0 && <li className="text-sm text-muted-foreground">No founders yet.</li>}
          {founders.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 ring-1 ring-[var(--safc-yellow)]/30">
              <div>
                <div className="text-sm font-bold">{f.full_name || f.username || "—"}</div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--safc-yellow)]">{formatMemberNo(f.member_no)}</div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await revokeFn({ data: { userId: f.id } });
                    toast.success("Founder revoked");
                    refresh();
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
                className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
