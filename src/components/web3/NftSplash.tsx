import { useEffect, useState } from "react";

const NftSplash = ({ title = "NFT Marketplace" }: { title?: string }) => {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden"
      style={{ animation: "nft-splash-out 0.6s ease 1.2s forwards" }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/openpay-nft-logo.png')" }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40"
        style={{ animation: "nft-splash-in 0.7s cubic-bezier(.34,1.56,.64,1) forwards" }}
      />
      <div className="relative z-10 text-center px-6" style={{ animation: "nft-splash-in 0.8s cubic-bezier(.34,1.56,.64,1) 0.2s forwards" }}>
        <div className="relative inline-block">
          <img
            src="/openpay-nft-logo.png"
            alt="OpenPay NFT"
            className="h-40 w-40 md:h-52 md:w-52 object-contain rounded-3xl shadow-[0_0_80px_rgba(59,130,246,0.55)]"
          />
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-yellow-400 animate-ping" />
        </div>
        <p className="mt-5 text-2xl font-extrabold text-white tracking-wide drop-shadow-lg">{title}</p>
        <p className="text-xs text-blue-200/90 mt-1 drop-shadow-md">Web3 · Mint · Trade · Auction</p>
      </div>
      <style>{`
        @keyframes nft-splash-in {
          0% { opacity: 0; transform: scale(0.75); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes nft-splash-out {
          to { opacity: 0; transform: scale(1.08); pointer-events: none; }
        }
      `}</style>
    </div>
  );
};

export default NftSplash;
