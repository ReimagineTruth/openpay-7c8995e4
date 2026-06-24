import { useEffect, useState } from "react";
import { Sparkles, PartyPopper, Gift, Gavel, Tag, ShoppingBag } from "lucide-react";

type Kind = "buy" | "mint" | "gift" | "list" | "bid" | "auction";

const ICONS: Record<Kind, any> = {
  buy: ShoppingBag,
  mint: Sparkles,
  gift: Gift,
  list: Tag,
  bid: PartyPopper,
  auction: Gavel,
};

interface Props {
  show: boolean;
  kind?: Kind;
  message?: string;
  onDone?: () => void;
}

const NftBurst = ({ show, kind = "buy", message, onDone }: Props) => {
  const [visible, setVisible] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; d: number; c: string; r: number }>>([]);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const colors = ["#3B82F6", "#60A5FA", "#FBBF24", "#F472B6", "#34D399", "#A78BFA"];
    setConfetti(
      Array.from({ length: 32 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        d: Math.random() * 0.6,
        c: colors[i % colors.length],
        r: Math.random() * 360,
      }))
    );
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2200);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!visible) return null;
  const Icon = ICONS[kind];

  return (
    <div className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />
      {confetti.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 w-2 h-3 rounded-sm"
          style={{
            left: `${p.x}%`,
            background: p.c,
            transform: `rotate(${p.r}deg)`,
            animation: `nft-confetti 1.8s cubic-bezier(.2,.7,.3,1) ${p.d}s forwards`,
          }}
        />
      ))}
      <div
        className="relative rounded-3xl px-7 py-6 bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl text-white text-center"
        style={{ animation: "nft-pop 0.5s cubic-bezier(.34,1.56,.64,1) forwards" }}
      >
        <div className="h-16 w-16 mx-auto rounded-full bg-white/15 flex items-center justify-center mb-2 animate-bounce">
          <Icon className="h-8 w-8" />
        </div>
        <p className="text-lg font-extrabold">{message || "Success!"}</p>
      </div>
      <style>{`
        @keyframes nft-confetti {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes nft-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NftBurst;
