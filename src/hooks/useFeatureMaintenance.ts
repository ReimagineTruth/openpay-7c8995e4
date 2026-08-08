import { useEffect, useState } from "react";
import { fetchFeatureMaintenance } from "@/lib/featureMaintenance";

/**
 * Returns whether a given OpenPay feature is under maintenance,
 * as configured by admins in /admin-maintenance.
 */
export const useFeatureMaintenance = (featureKey: string) => {
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchFeatureMaintenance(true);
      if (cancelled) return;
      const row = rows.find((r) => r.feature_key === featureKey);
      setMaintenance(!!row?.maintenance);
      setMessage(
        row?.message || "This feature is temporarily under maintenance. Please try again later.",
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [featureKey]);

  return { loading, maintenance, message };
};
