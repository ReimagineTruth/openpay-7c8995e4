import { useEffect, useState } from "react";
import { Clock, Trophy, Crown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "hsl(217 91% 60%)";

export const Countdown = ({ to, className = "" }: { to: string; className?: string }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(to).getTime();
  const diff = Math.max(0, end - now);
  const ended = diff === 0;
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const urgent = !ended && diff < 60 * 60 * 1000;
  if (ended) return <span className={`font-mono font-bold text-red-400 ${className}`}>ENDED</span>;
  return (
    <span className={`font-mono font-bold tabular-nums ${urgent ? "text-red-400 animate-pulse" : ""} ${className}`}
      style={!urgent ? { color: ACCENT } : {}}>
      {d > 0 && `${d}d `}{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(sec).padStart(2,"0")}
    </span>
  );
};

type Auction = {
  id: string;
  current_bid: number | null;
  current_bidder: string | null;
  start_price: number;
  min_increment: number;
  ends_at: string;
  status: string;
  winner_id: string | null;
  seller_id: string;
};

export const LiveAuctionPanel = ({
  auction,
  format,
  me,
  onBid,
  onFinalize,
  onCancel,
  onRefresh,
}: {
  auction: Auction;
  format: (n: number) => string;
  me: string | null;
  onBid: () => void;
  onFinalize: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}) => {
  const [a, setA] = useState(auction);
  const [bids, setBids] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [flash, setFlash] = useState(false);

  const loadProfiles = async (ids: string[]) => {
    const unique = Array.from(new Set(ids)).filter(Boolean);
    if (!unique.length) return;
    const { data } = await (supabase as any).from("profiles").select("id, username, full_name, avatar_url").in("id", unique);
    setProfiles((p) => {
      const next = { ...p };
      (data || []).forEach((x: any) => (next[x.id] = x));
      return next;
    });
  };

  const loadBids = async () => {
    const { data } = await (supabase as any).from("nft_auction_bids")
      .select("*").eq("auction_id", a.id).order("created_at", { ascending: false }).limit(10);
    setBids(data || []);
    await loadProfiles([...(data || []).map((b: any) => b.bidder_id), a.current_bidder || "", a.winner_id || "", a.seller_id]);
  };

  useEffect(() => { setA(auction); }, [auction.id, auction.status, auction.current_bid]);

  useEffect(() => {
    loadBids();
    const ch = supabase
      .channel(`auction-${a.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "nft_auctions", filter: `id=eq.${a.id}` },
        (payload) => {
          const next = payload.new as Auction;
          if (next) {
            setA(next);
            setFlash(true);
            setTimeout(() => setFlash(false), 800);
            onRefresh();
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "nft_auction_bids", filter: `auction_id=eq.${a.id}` },
        () => { loadBids(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id]);

  const ended = new Date(a.ends_at).getTime() < Date.now();
  const mine = a.seller_id === me;
  const leader = a.current_bidder ? profiles[a.current_bidder] : null;
  const winner = a.winner_id ? profiles[a.winner_id] : null;
  const settled = a.status === "settled";

  return (
    <div className={`rounded-xl bg-black/40 border p-3 transition-all ${flash ? "border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.4)]" : "border-white/5"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-white/50 uppercase tracking-wide">Current bid</p>
          <p className={`text-2xl font-extrabold ${flash ? "scale-105" : ""} transition-transform`} style={{ color: ACCENT }}>
            {format(Number(a.current_bid ?? a.start_price))}
          </p>
          {leader && !settled && (
            <p className="text-[11px] text-white/70 mt-0.5">Leader: <span className="font-bold text-white">@{leader.username || leader.full_name?.slice(0,10) || "bidder"}</span></p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/50 flex items-center justify-end gap-1 uppercase tracking-wide">
            <Clock className="h-3 w-3" /> {ended || settled ? "Ended" : "Ends in"}
          </p>
          {settled ? (
            <p className="text-xs font-bold text-emerald-400">SETTLED</p>
          ) : (
            <Countdown to={a.ends_at} className="text-lg" />
          )}
        </div>
      </div>

      {(settled || (ended && a.current_bidder)) && (
        <div className="mt-3 rounded-xl p-3 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border border-amber-400/30 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-amber-300/90 font-bold">Winner</p>
            <p className="font-extrabold truncate">
              @{(winner || leader)?.username || (winner || leader)?.full_name || (a.winner_id || a.current_bidder || "").slice(0, 8)}
            </p>
            <p className="text-xs text-white/70">won at {format(Number(a.current_bid ?? a.start_price))}</p>
          </div>
        </div>
      )}

      {bids.length > 0 && !settled && (
        <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wide text-white/40 font-bold">Recent bids</p>
          {bids.slice(0, 5).map((b) => {
            const p = profiles[b.bidder_id];
            return (
              <div key={b.id} className="flex items-center justify-between text-xs py-1">
                <span className="text-white/70 truncate">@{p?.username || b.bidder_id.slice(0,6)}</span>
                <span className="font-bold" style={{ color: ACCENT }}>{format(Number(b.amount))}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        {a.status === "active" && !ended && !mine && (
          <button onClick={onBid} className="flex-1 rounded-full py-2 text-sm font-bold animate-in fade-in" style={{ backgroundColor: ACCENT }}>
            🔥 Place bid
          </button>
        )}
        {ended && a.status === "active" && (
          <button onClick={onFinalize} className="flex-1 rounded-full py-2 text-sm font-bold bg-white/10">Finalize auction</button>
        )}
        {mine && a.status === "active" && !a.current_bid && (
          <button onClick={onCancel} className="rounded-full px-3 py-2 text-sm bg-white/10">Cancel</button>
        )}
      </div>
    </div>
  );
};
