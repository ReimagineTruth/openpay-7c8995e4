import { useEffect, useState } from "react";
import { Paintbrush } from "lucide-react";

/**
 * Fast NFT splash — motion only (no glow overlays).
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
      <div
        className="relative text-center"
        style={{ animation: "nft-splash-in 0.32s cubic-bezier(.22,1,.36,1) forwards" }}
      >
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15">
          <Paintbrush className="h-11 w-11 text-white" />
        </div>
        <p className="mt-5 text-2xl font-black tracking-tight text-white">{title}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-white/80">{subtitle}</p>

        <div className="mx-auto mt-5 h-[3px] w-32 overflow-hidden rounded-full bg-white/20">
          <span
            className="block h-full bg-white"
            style={{ animation: "nft-splash-bar 0.42s ease-out forwards" }}
          />
        </div>
      </div>

      <style>{`
        @keyframes nft-splash-in {
          0% { opacity: 0; transform: scale(0.92) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
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
