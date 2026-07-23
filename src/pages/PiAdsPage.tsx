import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";

type AdVerifyResult = {
  identifier: string;
  mediator_ack_status: "granted" | "revoked" | "failed" | null;
  mediator_granted_at: string | null;
  mediator_revoked_at: string | null;
};

const PiAdsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");
  const [sdkReady, setSdkReady] = useState(() => typeof window !== "undefined" && !!window.Pi);
  const [timeUntilNextAd, setTimeUntilNextAd] = useState<string>("Ready to watch");
  const pendingAutoRef = useRef(false);

  const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";
  const AD_INTERVAL_KEY = "openpay:pi-ads:last-rewarded";
  const AD_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const initPi = () => {
    if (!window.Pi) {
      toast.error("Pi SDK not loaded. Open this app in Pi Browser.");
      return false;
    }
    window.Pi.init({ version: "2.0", sandbox });
    return true;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Pi) {
      setSdkReady(true);
      return;
    }
    const handleSdkReady = () => setSdkReady(!!window.Pi);
    const handleSdkError = () => setSdkReady(false);
    window.addEventListener("pi-sdk-ready", handleSdkReady);
    window.addEventListener("pi-sdk-error", handleSdkError);
    return () => {
      window.removeEventListener("pi-sdk-ready", handleSdkReady);
      window.removeEventListener("pi-sdk-error", handleSdkError);
    };
  }, []);

  useEffect(() => {
    setTimeUntilNextAd(getTimeUntilNextAd());
    const interval = setInterval(() => {
      setTimeUntilNextAd(getTimeUntilNextAd());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const verifyRewardedAd = async (adId: string) => {
    const { data, error } = await supabase.functions.invoke("pi-platform", {
      body: { action: "ad_verify", adId },
    });
    if (error) throw new Error(await getFunctionErrorMessage(error, "Pi ad verification failed"));

    const payload = data as
      | { success?: boolean; data?: AdVerifyResult; rewarded?: boolean; error?: string }
      | null;
    if (!payload?.success || !payload.data) {
      throw new Error(payload?.error || "Pi ad verification failed");
    }

    const rewarded = payload.rewarded ?? payload.data.mediator_ack_status === "granted";

    return { ...payload, rewarded };
  };

  const canWatchAd = (): boolean => {
    try {
      const lastAd = window.localStorage.getItem(AD_INTERVAL_KEY);
      if (!lastAd) return true;
      const lastAdTime = Number(lastAd);
      const now = Date.now();
      return now - lastAdTime >= AD_INTERVAL_MS;
    } catch {
      return true;
    }
  };

  const getTimeUntilNextAd = (): string => {
    try {
      const lastAd = window.localStorage.getItem(AD_INTERVAL_KEY);
      if (!lastAd) return "Ready to watch";
      const lastAdTime = Number(lastAd);
      const now = Date.now();
      const elapsed = now - lastAdTime;
      const remaining = AD_INTERVAL_MS - elapsed;
      if (remaining <= 0) return "Ready to watch";
      const minutes = Math.ceil(remaining / (60 * 1000));
      return `Wait ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } catch {
      return "Ready to watch";
    }
  };

  const handleWatchRewardedAd = async () => {
    toast.info("Pi Ad Network is temporarily disabled.");
    return;
    if (!initPi() || !window.Pi?.Ads?.showAd) return;
    
    if (!canWatchAd()) {
      toast.error(`Please wait before watching another ad. ${getTimeUntilNextAd()}`);
      return;
    }
    
    setLoading(true);
    setLastResult("");

    try {
      await window.Pi.authenticate(["username"]);

      if (typeof window.Pi?.nativeFeaturesList === "function") {
        const features = await window.Pi.nativeFeaturesList();
        if (!Array.isArray(features) || !features.includes("ad_network")) {
          throw new Error("Ads not supported. Update Pi Browser to latest and try again.");
        }
      }

      if (typeof window.Pi?.Ads?.isAdReady === "function") {
        const readiness = await window.Pi.Ads.isAdReady("rewarded");
        if (!readiness.ready && typeof window.Pi?.Ads?.requestAd === "function") {
          const request = await window.Pi.Ads.requestAd("rewarded");
          if (request.result === "ADS_NOT_SUPPORTED") {
            throw new Error("Ads not supported. Update Pi Browser to latest and try again.");
          }
          if (request.result !== "AD_LOADED") {
            throw new Error("Rewarded ad is not available right now. Please try again.");
          }
        }
      }

      let adResult = await window.Pi.Ads.showAd("rewarded");
      if (adResult.result === "USER_UNAUTHENTICATED") {
        await window.Pi.authenticate(["username"]);
        adResult = await window.Pi.Ads.showAd("rewarded");
      }
      setLastResult(adResult.result);

      if (adResult.result !== "AD_REWARDED") {
        throw new Error(`Ad result: ${adResult.result}`);
      }

      if (!adResult.adId) {
        throw new Error("Rewarded ad returned no adId. Verification is required before granting rewards.");
      }

      const verification = await verifyRewardedAd(adResult.adId);
      if (!verification.rewarded) {
        throw new Error(`Ad verification status: ${verification.data.mediator_ack_status ?? "null"}`);
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("pi_ad_rewarded_at", String(Date.now()));
        window.localStorage.setItem("pi_ad_rewarded_id", String(adResult.adId));
        window.localStorage.setItem(AD_INTERVAL_KEY, String(Date.now()));
        console.log('Ad reward stored in localStorage:', {
          rewardedAt: Date.now(),
          adId: adResult.adId
        });
      }
      toast.success("Rewarded ad verified successfully");
      const returnTo = searchParams.get("returnTo");
      if (returnTo) {
        const decoded = decodeURIComponent(returnTo);
        const url = decoded.startsWith("http") ? decoded : `${window.location.origin}${decoded}`;
        const parsed = new URL(url);
        parsed.searchParams.set("ad", "rewarded");
        const nextPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        console.log('Navigating to return path:', nextPath);
        navigate(nextPath, { replace: true });
      } else {
        console.log('Navigating to mining page with ad reward');
        navigate("/mining?ad=rewarded", { replace: true });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof (error as { message?: unknown })?.message === "string"
            ? String((error as { message: string }).message)
            : "Rewarded ad flow failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const auto = searchParams.get("auto") === "1";
    const from = searchParams.get("from");
    if (!auto && from !== "mining") return;
    if (!sdkReady) {
      pendingAutoRef.current = true;
      return;
    }
    void handleWatchRewardedAd();
  }, [searchParams, sdkReady]);

  useEffect(() => {
    if (!sdkReady || !pendingAutoRef.current) return;
    pendingAutoRef.current = false;
    void handleWatchRewardedAd();
  }, [sdkReady]);

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/menu")} aria-label="Back to menu">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-paypal-dark">Pi Ad Network</h1>
      </div>

      <div className="paypal-surface mt-8 rounded-3xl p-6">
        <h2 className="text-xl font-semibold text-foreground">Watch Rewarded Ad</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Watch a rewarded ad. When it finishes and verifies, you'll be returned to Mining automatically.
        </p>

        <div className="mt-4 rounded-lg bg-muted p-3">
          <p className="text-sm font-medium text-foreground">
            Status: <span className={canWatchAd() ? "text-green-600" : "text-orange-600"}>{timeUntilNextAd}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You can watch one rewarded ad every 5 minutes to prevent spam.
          </p>
        </div>

        <Button
          onClick={handleWatchRewardedAd}
          disabled={loading || !canWatchAd()}
          className="mt-6 h-12 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
        >
          {loading ? "Running rewarded ad flow..." : "Watch rewarded ad"}
        </Button>

        {lastResult && (
          <p className="mt-4 text-sm text-foreground">
            Last SDK result: <span className="font-semibold">{lastResult}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default PiAdsPage;
