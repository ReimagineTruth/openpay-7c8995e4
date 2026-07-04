import { ReactNode, useEffect, useState } from "react";
import NftSplash from "./NftSplash";

const SPLASH_SESSION_KEY = "openpay:nft-splash-shown";

/**
 * Unified wrapper for every NFT page.
 * - Consistent dark background + smooth page-enter fade.
 * - Shows the NftSplash exactly once per browser session (first NFT page open),
 *   or every time when `alwaysSplash` is true.
 * - Optional `loading` state renders a soft shimmer skeleton before children.
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
  splashTitle,
  splashSubtitle,
  skeleton,
  className = "",
}: Props) => {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (alwaysSplash) return true;
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(SPLASH_SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (showSplash) {
      try {
        window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, [showSplash]);

  return (
    <>
      {showSplash && (
        <NftSplash
          title={splashTitle}
          subtitle={splashSubtitle}
          onDone={() => setShowSplash(false)}
        />
      )}
      <div
        className={`min-h-screen bg-black text-white animate-in fade-in duration-500 ${className}`}
      >
        {loading ? (skeleton ?? <DefaultNftSkeleton />) : children}
      </div>
    </>
  );
};

export const DefaultNftSkeleton = () => (
  <div className="p-4 space-y-5">
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
          className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="aspect-square nft-shimmer" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-3/4 rounded nft-shimmer" />
            <div className="h-3 w-1/2 rounded nft-shimmer" />
            <div className="h-4 w-1/3 rounded nft-shimmer" />
          </div>
        </div>
      ))}
    </div>
    <style>{`
      .nft-shimmer {
        background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 100%);
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
