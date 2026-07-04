import { useEffect, useRef } from "react";

const AD_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LAST_AD_KEY = "openpay:pi-ads:last-shown";
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30s

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

const showInterstitialOnce = async () => {
  if (!initPi() || !window.Pi?.Ads?.showAd) return;
  try {
    const ready = await window.Pi.Ads.isAdReady("interstitial");
    if (!ready?.ready) {
      await window.Pi.Ads.requestAd("interstitial");
    }
    await window.Pi.Ads.showAd("interstitial");
    try {
      window.localStorage.setItem(LAST_AD_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
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
 * Automatically shows a Pi Ad Network interstitial every 5 minutes while
 * the app is open and the user is authenticated. Only fires inside Pi Browser
 * (where window.Pi is defined). Persisted across route changes via localStorage.
 */
export const usePiAdsAutoShow = (enabled: boolean = true) => {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (document.hidden) return;
      if (!window.Pi?.Ads?.showAd) return; // not in Pi Browser
      const last = getLastShown();
      if (Date.now() - last >= AD_INTERVAL_MS) {
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
  }, [enabled]);
};
