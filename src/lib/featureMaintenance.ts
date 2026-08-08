import { supabase } from "@/integrations/supabase/client";

export type FeatureMaintenanceRow = {
  feature_key: string;
  label: string;
  feature_group: string;
  maintenance: boolean;
  message: string;
  sort_order: number;
  updated_at?: string;
};

let cached: { at: number; rows: FeatureMaintenanceRow[] } | null = null;
const CACHE_MS = 20_000;

export async function fetchFeatureMaintenance(force = false): Promise<FeatureMaintenanceRow[]> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.rows;
  try {
    const { data, error } = await (supabase as any).rpc("get_feature_maintenance");
    if (error || !Array.isArray(data)) return cached?.rows ?? [];
    const rows = data as FeatureMaintenanceRow[];
    cached = { at: Date.now(), rows };
    return rows;
  } catch {
    return cached?.rows ?? [];
  }
}

export async function isFeatureUnderMaintenance(
  featureKey: string,
): Promise<{ maintenance: boolean; message: string }> {
  const rows = await fetchFeatureMaintenance();
  const row = rows.find((r) => r.feature_key === featureKey);
  return {
    maintenance: !!row?.maintenance,
    message: row?.message || "This feature is temporarily under maintenance. Please try again later.",
  };
}

export function clearFeatureMaintenanceCache() {
  cached = null;
}
