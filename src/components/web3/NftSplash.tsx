import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Sleek, fast NFT splash — ~500ms total (in + hold + out).
 * Renders a glowing orb with the OpenPay NFT wordmark.
 * Only renders when `show` is true; the parent controls session-guarding.
 */
const NftSplash = ({
  title = "OpenPay NFT",
  subtitle = "Mint · Trade · Auction",
  onDone,
}: {
  title?: string;
  subtitle?: string;
  onDone?: () => void;
}) => {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    const outTimer = setTimeout(() => setPhase("out"), 320);
    const doneTimer = setTimeout(() => {
      setPhase("gone");
      onDone?.();
    }, 520);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);


  if (phase === "gone") return null;

  return (
    <div
      className={`nft-on-media theme-fixed fixed inset-0 z-[110] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a] transition-opacity duration-200 ${
        phase === "out" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-hidden
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-white/10 blur-[80px] animate-pulse" />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-white/10 blur-[70px]" />
      </div>

      <div className="relative text-center" style={{ animation: "nft-splash-in 0.32s cubic-bezier(.22,1.36,.5,1) forwards" }}>
        <div className="relative inline-block">
          <span
            className="absolute inset-0 rounded-3xl"
            style={{ boxShadow: "0 0 80px 6px rgba(255,255,255,0.35)" }}
          />
          <div className="relative h-24 w-24 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Sparkles className="h-11 w-11 text-white drop-shadow" />
          </div>
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.9)] animate-ping" />
        </div>
        <p className="mt-5 text-2xl font-black text-white tracking-tight">{title}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-white/80">{subtitle}</p>

        <div className="mt-5 mx-auto h-[3px] w-32 overflow-hidden rounded-full bg-white/20">
          <span
            className="block h-full bg-white"
            style={{ animation: "nft-splash-bar 0.42s ease-out forwards" }}
          />
        </div>
      </div>

      <style>{`
        @keyframes nft-splash-in {
          0% { opacity: 0; transform: scale(0.85) translateY(6px); filter: blur(4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        @keyframes nft-splash-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default NftSplash;
