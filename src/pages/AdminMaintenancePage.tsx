import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, ShieldAlert, Wrench, Search, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  clearFeatureMaintenanceCache,
  fetchFeatureMaintenance,
  type FeatureMaintenanceRow,
} from "@/lib/featureMaintenance";

export default function AdminMaintenancePage() {
  const nav = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FeatureMaintenanceRow[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data: isAdmin, error } = await (supabase as any).rpc("is_openpay_core_admin");
      if (error || !isAdmin) {
        toast.error("Admin access required");
        nav("/dashboard", { replace: true });
        return;
      }
      setAllowed(true);
      const list = await fetchFeatureMaintenance(true);
      setRows(list);
      setLoading(false);
    })();
  }, [nav]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.feature_key.toLowerCase().includes(q) ||
            r.feature_group.toLowerCase().includes(q),
        )
      : rows;
    const map = new Map<string, FeatureMaintenanceRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.feature_group) ?? [];
      arr.push(r);
      map.set(r.feature_group, arr);
    }
    return Array.from(map.entries());
  }, [rows, query]);

  const downCount = rows.filter((r) => r.maintenance).length;

  const patchLocal = (key: string, patch: Partial<FeatureMaintenanceRow>) =>
    setRows((prev) => prev.map((r) => (r.feature_key === key ? { ...r, ...patch } : r)));

  const persist = async (
    row: FeatureMaintenanceRow,
    maintenance: boolean,
    previousMaintenance?: boolean,
  ) => {
    setSavingKey(row.feature_key);
    const { data, error } = await (supabase as any).rpc("set_feature_maintenance", {
      p_feature_key: row.feature_key,
      p_maintenance: maintenance,
      p_message: row.message,
    });
    setSavingKey(null);
    if (error) {
      if (typeof previousMaintenance === "boolean") {
        patchLocal(row.feature_key, { maintenance: previousMaintenance });
      }
      toast.error(error.message || "Failed to update");
      return false;
    }
    clearFeatureMaintenanceCache();
    if (data) patchLocal(row.feature_key, data as FeatureMaintenanceRow);
    toast.success(`${row.label} ${maintenance ? "set to maintenance" : "is live"}`);
    return true;
  };

  const setAll = async (maintenance: boolean) => {
    setBulk(true);
    const { error } = await (supabase as any).rpc("set_all_feature_maintenance", {
      p_maintenance: maintenance,
    });

    // Supabase pg-safeupdate blocks bulk UPDATE without WHERE; fall back per-row.
    if (error) {
      let failed = 0;
      for (const row of rows) {
        const { error: rowError } = await (supabase as any).rpc("set_feature_maintenance", {
          p_feature_key: row.feature_key,
          p_maintenance: maintenance,
          p_message: row.message,
        });
        if (rowError) failed += 1;
      }
      if (failed > 0) {
        setBulk(false);
        clearFeatureMaintenanceCache();
        setRows(await fetchFeatureMaintenance(true));
        toast.error(`Failed to update ${failed} feature(s)`);
        return;
      }
    }

    clearFeatureMaintenanceCache();
    setRows(await fetchFeatureMaintenance(true));
    setBulk(false);
    toast.success(maintenance ? "All features set to maintenance" : "All features are live");
  };

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-20 pt-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => nav(-1)} aria-label="Back">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">Maintenance Control</h1>
            <p className="text-xs text-muted-foreground">
              Turn any OpenPay feature on or off platform-wide
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {downCount} of {rows.length} features under maintenance
                </p>
                <p className="text-xs text-muted-foreground">
                  Users see your custom message when a feature is off.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={bulk || loading}
                onClick={() => void setAll(false)}
              >
                <Power className="mr-1 h-4 w-4" /> All live
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={bulk || loading}
                onClick={() => void setAll(true)}
              >
                <ShieldAlert className="mr-1 h-4 w-4" /> All maintenance
              </Button>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search features…"
              className="h-11 rounded-xl pl-9"
            />
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-5 space-y-4">
            {groups.map(([group, items]) => (
              <section key={group} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">{group}</h2>
                  <Badge variant="secondary" className="rounded-full text-[11px]">
                    {items.filter((i) => i.maintenance).length}/{items.length} off
                  </Badge>
                </div>
                <div className="space-y-5">
                  {items.map((row) => (
                    <div key={row.feature_key} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{row.label}</span>
                            {row.maintenance ? (
                              <Badge className="rounded-full bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/15">
                                Maintenance
                              </Badge>
                            ) : (
                              <Badge className="rounded-full bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/15">
                                Live
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{row.feature_key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {savingKey === row.feature_key && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={row.maintenance}
                            onCheckedChange={(v) => {
                              const previousMaintenance = row.maintenance;
                              patchLocal(row.feature_key, { maintenance: v });
                              void persist({ ...row, maintenance: v }, v, previousMaintenance);
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Customer message</Label>
                        <div className="flex gap-2">
                          <Input
                            value={row.message}
                            onChange={(e) => patchLocal(row.feature_key, { message: e.target.value })}
                            className="h-10 rounded-xl"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-xl"
                            aria-label={`Save ${row.label} message`}
                            disabled={savingKey === row.feature_key}
                            onClick={() => void persist(row, row.maintenance)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">No features match “{query}”.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
