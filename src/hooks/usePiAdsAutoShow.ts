import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LAST_AD_KEY = "openpay:pi-ads:last-shown";
const HOURLY_LOG_KEY = "openpay:pi-ads:hourly-log";
const DAILY_LOG_KEY = "openpay:pi-ads:daily-log";
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30s

type PiAdsSettings = {
  enabled: boolean;
  interstitial_enabled: boolean;
  rewarded_enabled: boolean;
  interstitial_interval_minutes: number;
  max_ads_per_hour: number;
  max_ads_per_day: number;
};

const DEFAULT_SETTINGS: PiAdsSettings = {
  enabled: true,
  interstitial_enabled: true,
  rewarded_enabled: true,
  interstitial_interval_minutes: 5,
  max_ads_per_hour: 12,
  max_ads_per_day: 60,
};

const getSandbox = () =>
  String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";

const initPi = (): boolean => {
  if (typeof window === "undefined" || !window.Pi) return false;
  try {
    window.Pi.init({ version: "2.0", sandbox: getSandbox() });
    return true;
  } catch {
    return false;
  }
};

const readLog = (key: string): number[] => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
};

const writeLog = (key: string, arr: number[]) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
};

const pruneAndCount = (key: string, windowMs: number): number => {
  const now = Date.now();
  const arr = readLog(key).filter((t) => now - t < windowMs);
  writeLog(key, arr);
  return arr.length;
};

const recordShown = () => {
  const now = Date.now();
  try {
    window.localStorage.setItem(LAST_AD_KEY, String(now));
  } catch {
    /* ignore */
  }
  const hourly = readLog(HOURLY_LOG_KEY).filter((t) => now - t < 60 * 60 * 1000);
  hourly.push(now);
  writeLog(HOURLY_LOG_KEY, hourly);
  const daily = readLog(DAILY_LOG_KEY).filter((t) => now - t < 24 * 60 * 60 * 1000);
  daily.push(now);
  writeLog(DAILY_LOG_KEY, daily);
};

const showInterstitialOnce = async () => {
  if (!initPi() || !window.Pi?.Ads?.showAd) return;
  try {
    const ready = await window.Pi.Ads.isAdReady("interstitial");
    if (!ready?.ready) {
      await window.Pi.Ads.requestAd("interstitial");
    }
    await window.Pi.Ads.showAd("interstitial");
    recordShown();
  } catch (err) {
    console.debug("[PiAdsAuto] show ad failed", err);
  }
};

const getLastShown = (): number => {
  try {
    const raw = window.localStorage.getItem(LAST_AD_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
};

/**
 * Automatically shows a Pi Ad Network interstitial while the app is open,
 * respecting admin-configured settings (enabled, interval, hourly/daily caps).
 */
export const usePiAdsAutoShow = (enabled: boolean = true) => {
  const timerRef = useRef<number | null>(null);
  const [settings, setSettings] = useState<PiAdsSettings>(DEFAULT_SETTINGS);

  // Load admin settings and refresh every 5 min
  useEffect(() => {
    let cancelled = false;
    const fetchSettings = async () => {
      try {
        const { data, error } = await (supabase as any).rpc("pi_ads_get_settings");
        if (!cancelled && !error && data) {
          setSettings({
            enabled: !!data.enabled,
            interstitial_enabled: !!data.interstitial_enabled,
            rewarded_enabled: !!data.rewarded_enabled,
            interstitial_interval_minutes: Number(data.interstitial_interval_minutes ?? 5),
            max_ads_per_hour: Number(data.max_ads_per_hour ?? 12),
            max_ads_per_day: Number(data.max_ads_per_day ?? 60),
          });
        }
      } catch {
        /* ignore */
      }
    };
    fetchSettings();
    const id = window.setInterval(fetchSettings, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!settings.enabled || !settings.interstitial_enabled) return;

    let cancelled = false;
    const intervalMs = Math.max(1, settings.interstitial_interval_minutes) * 60 * 1000;

    const tick = () => {
      if (cancelled) return;
      if (document.hidden) return;
      if (!window.Pi?.Ads?.showAd) return; // not in Pi Browser

      // Enforce hourly / daily caps
      if (settings.max_ads_per_hour > 0) {
        const hourly = pruneAndCount(HOURLY_LOG_KEY, 60 * 60 * 1000);
        if (hourly >= settings.max_ads_per_hour) return;
      } else {
        return; // 0 => disabled by cap
      }
      if (settings.max_ads_per_day > 0) {
        const daily = pruneAndCount(DAILY_LOG_KEY, 24 * 60 * 60 * 1000);
        if (daily >= settings.max_ads_per_day) return;
      }

      const last = getLastShown();
      if (Date.now() - last >= intervalMs) {
        void showInterstitialOnce();
      }
    };

    // Initial delay so we don't show immediately on app open
    const startTimeout = window.setTimeout(() => {
      tick();
      timerRef.current = window.setInterval(tick, CHECK_INTERVAL_MS);
    }, 60 * 1000);

    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimeout);
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, settings]);
};
