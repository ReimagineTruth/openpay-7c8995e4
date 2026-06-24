import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const NftSplash = ({ title = "NFT Marketplace" }: { title?: string }) => {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-gradient-to-br from-black via-blue-950 to-black"
      style={{ animation: "nft-splash-out 0.5s ease 0.9s forwards" }}
    >
      <div className="text-center" style={{ animation: "nft-splash-in 0.6s cubic-bezier(.34,1.56,.64,1) forwards" }}>
        <div className="relative inline-block">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-[0_0_60px_rgba(59,130,246,0.6)]">
            <Sparkles className="h-12 w-12 text-white" />
          </div>
          <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-yellow-400 animate-ping" />
        </div>
        <p className="mt-4 text-2xl font-extrabold text-white tracking-wide">{title}</p>
        <p className="text-xs text-blue-200/80 mt-1">Web3 · Mint · Trade · Auction</p>
      </div>
      <style>{`
        @keyframes nft-splash-in {
          0% { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes nft-splash-out {
          to { opacity: 0; transform: scale(1.05); pointer-events: none; }
        }
      `}</style>
    </div>
  );
};

export default NftSplash;
