import { ReactNode, useEffect, useState } from "react";
import { getStoredAppTheme } from "@/lib/appTheme";
import NftSplash from "@/components/web3/NftSplash";

const SPLASH_KEY = "openpay_nft_splash_seen_v2";

/**
 * Unified wrapper for every NFT page.
 * - Consistent background + page content.
 * - Shows the NftSplash (paintbrush) once per browser session,
 *   or every time when `alwaysSplash` is true.
 */
interface Props {
  children: ReactNode;
  loading?: boolean;
  alwaysSplash?: boolean;
  splashTitle?: string;
  splashSubtitle?: string;
  skeleton?: ReactNode;
  className?: string;
}

const NftPageShell = ({
  children,
  loading = false,
  alwaysSplash = false,
  splashTitle = "OpenPay NFT",
  splashSubtitle = "Mint · Trade · Auction",
  skeleton,
  className = "",
}: Props) => {
  const [showSplash, setShowSplash] = useState(() => {
    if (alwaysSplash) return true;
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const [isDark, setIsDark] = useState(() => getStoredAppTheme() === "dark");
  useEffect(() => {
    const el = document.documentElement;
    const check = () => setIsDark(el.classList.contains("dark") || getStoredAppTheme() === "dark");
    check();
    const mo = new MutationObserver(check);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  return (
    <div
      className={`nft-scope ${isDark ? "dark" : ""} min-h-screen bg-background text-foreground ${className}`}
    >
      {showSplash && (
        <NftSplash
          title={splashTitle}
          subtitle={splashSubtitle}
          onDone={() => {
            try {
              if (!alwaysSplash) sessionStorage.setItem(SPLASH_KEY, "1");
            } catch {
              /* ignore */
            }
            setShowSplash(false);
          }}
        />
      )}
      {loading ? (skeleton ?? <DefaultNftSkeleton />) : children}
    </div>
  );
};

export const DefaultNftSkeleton = () => (
  <div className="space-y-5 p-4">
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full nft-shimmer" />
      <div className="h-4 w-40 rounded nft-shimmer" />
      <div className="ml-auto h-9 w-16 rounded-full nft-shimmer" />
    </div>
    <div className="h-10 w-full rounded-full nft-shimmer" />
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-7 w-16 rounded-full nft-shimmer" />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border/30 bg-card/50"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="aspect-square nft-shimmer" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded nft-shimmer" />
            <div className="h-3 w-1/2 rounded nft-shimmer" />
            <div className="h-4 w-1/3 rounded nft-shimmer" />
          </div>
        </div>
      ))}
    </div>
    <style>{`
      .nft-shimmer {
        background: linear-gradient(90deg,
          hsl(var(--muted)) 0%,
          hsl(var(--muted-foreground) / 0.3) 50%,
          hsl(var(--muted)) 100%);
        background-size: 200% 100%;
        animation: nft-shimmer-slide 1.4s ease-in-out infinite;
      }
      @keyframes nft-shimmer-slide {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  </div>
);

export default NftPageShell;
