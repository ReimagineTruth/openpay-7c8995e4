import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { setUiMode } from "@/lib/uiMode";
import CurrencySelector from "@/components/CurrencySelector";
import OpenPayTutorial from "@/components/OpenPayTutorial";
import {
  Home,
  Clock,
  Search,
  Plus,
  ArrowDown,
  ArrowUp,
  Repeat,
  PiggyBank,
  TrendingUp,
  Bitcoin,
  LineChart,
  Shield,
  X,
  ChevronRight,
  Building2,
  Send,
  QrCode,
  Sparkles,
  Download,
  FileText,
  Pickaxe,
  Store,
  HelpCircle,
  GraduationCap,
  User,
  Bell,
} from "lucide-react";


type Tab = "home" | "activity" | "search";

// OpenPay brand blue
const ACCENT = "hsl(217 91% 60%)";
const ACCENT_HOVER = "hsl(217 91% 55%)";

interface TxRow {
  id: string;
  type: string | null;
  amount: number | null;
  created_at: string;
  description?: string | null;
  status?: string | null;
}

const Web3Dashboard = () => {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [tab, setTab] = useState<Tab>("home");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showConvert, setShowConvert] = useState(true);
  const [profile, setProfile] = useState<{ username: string | null; full_name: string | null; avatar_url: string | null }>({
    username: null,
    full_name: null,
    avatar_url: null,
  });
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState<string>("All");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [unread, setUnread] = useState(0);


  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const [{ data: prof }, { data: w }] = await Promise.all([
        supabase.from("profiles").select("username, full_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!mounted) return;
      if (prof) setProfile(prof as any);
      if (w?.balance != null) setBalance(Number(w.balance));
      // Unread notifications count
      const { count } = await (supabase as any)
        .from("app_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (mounted && typeof count === "number") setUnread(count);
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch activity when needed
  useEffect(() => {
    if (tab !== "activity" && tab !== "search") return;
    let mounted = true;
    (async () => {
      setLoadingTx(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingTx(false); return; }
      const [{ data: txData }, { data: nftTx }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, amount, created_at, description, status")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("nft_transactions")
          .select("id, total, created_at, status, tx_kind, buyer_id, seller_id, quantity, payment_method, item_id, nft_items(name, code)")
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (!mounted) return;
      const nftRows: TxRow[] = (nftTx || []).map((n: any) => {
        const isBuyer = n.buyer_id === user.id;
        const kind = String(n.tx_kind || "sale");
        const itemName = n.nft_items?.name || "NFT";
        let label = "";
        if (kind === "gift") label = isBuyer ? `Received NFT gift: ${itemName}` : `Sent NFT gift: ${itemName}`;
        else if (kind === "mint") label = `Minted ${itemName}`;
        else label = isBuyer ? `Bought NFT: ${itemName}` : `Sold NFT: ${itemName}`;
        return {
          id: `nft_${n.id}`,
          type: isBuyer ? (kind === "gift" ? "nft_gift_in" : "nft_buy") : (kind === "gift" ? "nft_gift_out" : "nft_sell"),
          amount: isBuyer ? -Number(n.total || 0) : Number(n.total || 0),
          created_at: n.created_at,
          description: label,
          status: n.status,
        };
      });
      const merged = [...((txData as any) || []), ...nftRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setTxs(merged);
      setLoadingTx(false);
    })();
    return () => { mounted = false; };
  }, [tab]);

  const displayName = profile.username ? `@${profile.username}` : profile.full_name || "OpenPay";
  const avatar = profile.avatar_url;

  const filteredTxs = useMemo(() => {
    const f = activityFilter.toLowerCase();
    return txs.filter((t) => {
      if (f === "all") return true;
      const type = (t.type || "").toLowerCase();
      if (f === "nft") return type.startsWith("nft");
      if (f === "deposits") return ["topup", "top_up", "deposit", "receive"].some((k) => type.includes(k));
      if (f === "withdrawals") return type.includes("withdraw");
      if (f === "sent") return type.includes("send") || type.includes("transfer") || type === "nft_buy" || type === "nft_gift_out";
      if (f === "converts") return type.includes("convert") || type.includes("swap");
      return true;
    });
  }, [txs, activityFilter]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [] as TxRow[];
    const q = search.toLowerCase();
    return txs.filter((t) =>
      (t.description || "").toLowerCase().includes(q) ||
      (t.type || "").toLowerCase().includes(q) ||
      String(t.amount || "").includes(q),
    );
  }, [txs, search]);

  return (
    <div
      className="min-h-screen bg-black text-white pb-32 relative overflow-x-hidden animate-in fade-in duration-300"
      style={{ fontFamily: "'SF Pro Display', system-ui, -apple-system, sans-serif" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 gap-3">
        <button onClick={() => navigate("/menu")} className="flex items-center gap-2 min-w-0">
          {avatar ? (
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-bold">
              {(displayName[0] || "O").toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-[15px] truncate">{displayName}</span>
        </button>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
            className="relative h-9 w-9 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center hover:bg-[#222] transition"
          >
            <Bell className="h-4 w-4 text-white" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold leading-4 text-center text-white">
                {Math.min(unread, 99)}
              </span>
            )}
          </button>
          <CurrencySelector />
        </div>
      </div>


      {tab === "home" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Balance */}
          <div className="flex flex-col items-center pt-12">
            <div className="flex items-baseline">
              <span className="text-6xl font-extrabold tracking-tight">{format(balance).replace(/\.\d+$/, "")}</span>
              <span className="text-4xl font-extrabold tracking-tight text-white/40">
                .{(balance.toFixed(2).split(".")[1]) || "00"}
              </span>
            </div>
            <p className="mt-3 text-center text-[15px] text-white/60 whitespace-pre-line">
              {balance > 0 ? "Your OpenPay balance" : "Add cash or crypto to start\nusing OpenPay"}
            </p>
            <button
              onClick={() => navigate("/topup")}
              className="mt-6 flex items-center gap-2 rounded-full px-7 py-3 font-bold text-white shadow-lg active:scale-95 transition"
              style={{ backgroundColor: ACCENT }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = ACCENT_HOVER)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
            >
              <ArrowDown className="h-5 w-5" />
              Deposit
            </button>
          </div>

          {/* Quick actions row */}
          <div className="mt-8 mx-4 grid grid-cols-4 gap-2">
            <QuickAction icon={<Send className="h-5 w-5" />} label="Send" onClick={() => navigate("/send")} />
            <QuickAction icon={<Download className="h-5 w-5" />} label="Receive" onClick={() => navigate("/receive")} />
            <QuickAction icon={<QrCode className="h-5 w-5" />} label="Scan" onClick={() => navigate("/scan-qr")} />
            <QuickAction icon={<FileText className="h-5 w-5" />} label="Request" onClick={() => navigate("/request-payment")} />
          </div>

          {/* Convert banner */}
          {showConvert && (
            <div className="mt-8 mx-4 rounded-2xl bg-[#1a1a1a] p-4 flex items-center gap-3 relative">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
                <Repeat className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px]">Convert currencies</p>
                <p className="text-xs text-white/60">Best rates across 30+ currencies</p>
              </div>
              <button onClick={() => navigate("/currency-converter")} className="text-white/80 px-3 py-1 text-xs rounded-full border border-white/10">
                Open
              </button>
              <button onClick={() => setShowConvert(false)} className="text-white/40 p-1 absolute top-2 right-2">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Cash & Savings tiles */}
          <div className="mt-4 mx-4 grid grid-cols-2 gap-3">
            <Tile icon={<Building2 className="h-5 w-5 text-white/70" />} title="Cash" subtitle="Manage funds" onClick={() => navigate("/activity")} />
            <Tile icon={<LineChart className="h-5 w-5 text-white/70" />} title="Earn" subtitle="Stake & rewards" onClick={() => navigate("/staking")} />
          </div>

          {/* Markets / Tools */}
          <h3 className="mt-8 mx-5 text-white/60 text-[15px] font-semibold">Tools</h3>
          <div className="mt-3 mx-4 space-y-3">
            <RowTile icon={<Sparkles className="h-5 w-5" style={{ color: ACCENT }} />} title="NFT Marketplace" subtitle="Mint, buy, sell & gift collectibles" onClick={() => navigate("/web3/nft")} />
            <RowTile icon={<Pickaxe className="h-5 w-5 text-white/70" />} title="Mining" subtitle="Earn daily rewards" onClick={() => navigate("/mining")} />
            <RowTile icon={<Store className="h-5 w-5 text-white/70" />} title="Merchant POS" subtitle="Accept payments" onClick={() => navigate("/merchant-pos")} />
            <RowTile icon={<TrendingUp className="h-5 w-5 text-white/70" />} title="Affiliate" subtitle="Invite & earn" onClick={() => navigate("/affiliate")} />
            <RowTile icon={<GraduationCap className="h-5 w-5 text-white/70" />} title="Tutorial" subtitle="Learn how OpenPay works" onClick={() => setTutorialOpen(true)} />
            <RowTile icon={<User className="h-5 w-5 text-white/70" />} title="Profile & Settings" subtitle="Account, security, preferences" onClick={() => navigate("/menu")} />
            <RowTile icon={<Bell className="h-5 w-5 text-white/70" />} title={`Notifications${unread > 0 ? ` (${unread})` : ""}`} subtitle="Alerts & updates" onClick={() => navigate("/notifications")} />
            <RowTile icon={<Clock className="h-5 w-5 text-white/70" />} title="Transaction History" subtitle="View every transaction" onClick={() => navigate("/activity")} />
            <RowTile icon={<Sparkles className="h-5 w-5 text-white/70" />} title="Classic UI" subtitle="Switch to original mode" onClick={() => setUiMode("original")} />
          </div>


          {/* Learn more */}
          <h3 className="mt-8 mx-5 text-white/60 text-[15px] font-semibold">Learn more</h3>
          <div className="mt-3 ml-4 flex gap-3 overflow-x-auto pb-2 pr-4 [&::-webkit-scrollbar]:hidden">
            <LearnCard color="from-blue-600 to-blue-500" icon={<ArrowDown className="h-6 w-6 text-white" />} title="Moving your funds" desc="Learn how to add or move funds seamlessly into OpenPay" onClick={() => navigate("/help")} />
            <LearnCard color="from-sky-600 to-blue-500" icon={<Shield className="h-6 w-6 text-white" />} title="Security" desc="Learn how we keep your money safe and secure" onClick={() => navigate("/help")} />
            <LearnCard color="from-indigo-600 to-blue-500" icon={<QrCode className="h-6 w-6 text-white" />} title="QR Pay" desc="Pay or get paid by scanning a code" onClick={() => navigate("/qr-pay")} />
            <LearnCard color="from-slate-700 to-slate-600" icon={<HelpCircle className="h-6 w-6 text-white" />} title="Help Center" desc="Guides, tutorials and FAQs" onClick={() => navigate("/help")} />
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="px-5 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Connected account profile card */}
          <button
            onClick={() => navigate("/menu")}
            className="w-full flex items-center gap-3 rounded-2xl bg-[#0f0f0f] border border-white/5 p-3 mb-4 hover:bg-[#161616] transition text-left"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/10" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-base font-bold">
                {(displayName[0] || "O").toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[15px] truncate">{profile.full_name || displayName}</p>
              <p className="text-xs text-white/55 truncate">
                {profile.username ? `@${profile.username}` : "Tap to complete your profile"}
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-white/70">Balance {format(balance)}</span>
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-extrabold">Activity</h1>
            <button onClick={() => navigate("/activity")} className="text-xs font-semibold text-white/70 hover:text-white px-3 py-1.5 rounded-full border border-white/15">
              View all
            </button>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {["All", "NFT", "Converts", "Deposits", "Withdrawals", "Sent"].map((c) => (
              <button
                key={c}
                onClick={() => setActivityFilter(c)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                  activityFilter === c ? "text-white" : "border border-white/20 text-white/80"
                }`}
                style={activityFilter === c ? { backgroundColor: ACCENT } : undefined}
              >
                {c}
              </button>
            ))}
          </div>
          {loadingTx ? (
            <div className="mt-10 text-center text-white/50">Loading…</div>
          ) : filteredTxs.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-24 text-center">
              <div className="text-white/30 text-5xl mb-4">↻</div>
              <p className="text-xl font-bold">Your activity starts now</p>
              <p className="mt-2 text-white/60 text-sm max-w-xs">New activity will show up here</p>
              <button
                onClick={() => navigate("/topup")}
                className="mt-6 flex items-center gap-2 rounded-full px-7 py-3 font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                <ArrowDown className="h-5 w-5" />
                Add funds
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {filteredTxs.map((t) => (
                <TxRowItem key={t.id} tx={t} format={format} onClick={() => navigate("/activity")} />
              ))}
              <button
                onClick={() => navigate("/activity")}
                className="w-full mt-4 rounded-2xl border border-white/15 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 transition"
              >
                View full transaction history
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "search" && (
        <div className="px-5 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h1 className="text-4xl font-extrabold">Search</h1>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions…"
            className="mt-5 w-full rounded-2xl bg-[#1a1a1a] px-4 py-3 text-white placeholder:text-white/40 outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as any]: ACCENT }}
          />
          {search.trim() === "" ? (
            <div className="mt-10">
              <p className="text-white/60 text-sm mb-3">Quick links</p>
              <div className="grid grid-cols-2 gap-3">
                <Tile icon={<Send className="h-5 w-5 text-white/70" />} title="Send money" subtitle="Pay anyone" onClick={() => navigate("/send")} />
                <Tile icon={<Download className="h-5 w-5 text-white/70" />} title="Receive" subtitle="Get paid" onClick={() => navigate("/receive")} />
                <Tile icon={<QrCode className="h-5 w-5 text-white/70" />} title="Scan QR" subtitle="Pay by code" onClick={() => navigate("/scan-qr")} />
                <Tile icon={<Repeat className="h-5 w-5 text-white/70" />} title="Convert" subtitle="FX rates" onClick={() => navigate("/currency-converter")} />
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <p className="mt-10 text-center text-white/50">No matches.</p>
          ) : (
            <div className="mt-5 space-y-2">
              {searchResults.map((t) => (
                <TxRowItem key={t.id} tx={t} format={format} onClick={() => navigate("/activity")} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom action sheet */}
      {actionsOpen && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40 animate-in fade-in duration-200" onClick={() => setActionsOpen(false)} />
          <div className="fixed bottom-28 left-4 right-4 z-50 rounded-3xl bg-[#1a1a1a] p-3 space-y-1 animate-in slide-in-from-bottom-4 duration-300">
            <ActionRow color={ACCENT} icon={<Send className="h-5 w-5 text-white" />} title="Send money" desc="Pay anyone instantly" onClick={() => { setActionsOpen(false); navigate("/send"); }} />
            <ActionRow color={ACCENT} icon={<Download className="h-5 w-5 text-white" />} title="Receive" desc="Share your payment info" onClick={() => { setActionsOpen(false); navigate("/receive"); }} />
            <ActionRow color={ACCENT} icon={<QrCode className="h-5 w-5 text-white" />} title="Scan QR" desc="Scan to pay" onClick={() => { setActionsOpen(false); navigate("/scan-qr"); }} />
            <ActionRow color={ACCENT} icon={<ArrowDown className="h-5 w-5 text-white" />} title="Top up" desc="Add funds to wallet" onClick={() => { setActionsOpen(false); navigate("/topup"); }} />
            <ActionRow color={ACCENT} icon={<PiggyBank className="h-5 w-5 text-white" />} title="Stake" desc="Earn rewards" onClick={() => { setActionsOpen(false); navigate("/staking"); }} />
          </div>
        </>
      )}

      {/* Bottom nav */}
      <div className="fixed bottom-5 left-0 right-0 z-30 px-4 flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-1 rounded-full bg-[#1a1a1a]/95 backdrop-blur-md px-2 py-2 border border-white/5">
          <NavBtn active={tab === "home"} onClick={() => setTab("home")} icon={<Home className="h-5 w-5" />} />
          <NavBtn active={tab === "activity"} onClick={() => setTab("activity")} icon={<Clock className="h-5 w-5" />} />
          <NavBtn active={tab === "search"} onClick={() => setTab("search")} icon={<Search className="h-5 w-5" />} />
        </div>
        <button
          onClick={() => setActionsOpen((o) => !o)}
          className="h-14 w-14 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition"
          style={{ backgroundColor: ACCENT }}
          aria-label="Quick actions"
        >
          <Plus className="h-7 w-7 text-white" />
        </button>
      </div>

      {/* Tutorial modal */}
      <OpenPayTutorial isOpen={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>

  );
};

const NavBtn = ({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center h-10 rounded-full transition ${active ? "text-white" : "text-white/70"}`}
    style={active ? { backgroundColor: ACCENT } : undefined}
  >
    {icon}
  </button>
);

const QuickAction = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 py-2 rounded-2xl hover:bg-white/5 transition">
    <div className="h-12 w-12 rounded-full flex items-center justify-center bg-[#1a1a1a] border border-white/5" style={{ color: ACCENT }}>
      {icon}
    </div>
    <span className="text-[11px] font-semibold text-white/80">{label}</span>
  </button>
);

const Tile = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) => (
  <button onClick={onClick} className="text-left rounded-2xl border border-dashed border-white/15 bg-[#0f0f0f] p-4 hover:bg-[#161616] transition">
    <div className="mb-6">{icon}</div>
    <p className="font-bold text-[17px]">{title}</p>
    <p className="text-sm text-white/55">{subtitle}</p>
  </button>
);

const RowTile = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) => (
  <button onClick={onClick} className="w-full text-left rounded-2xl border border-dashed border-white/15 bg-[#0f0f0f] p-4 flex items-center gap-3 hover:bg-[#161616] transition">
    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">{icon}</div>
    <div className="flex-1">
      <p className="font-bold text-[17px]">{title}</p>
      <p className="text-sm text-white/55">{subtitle}</p>
    </div>
    <ChevronRight className="h-5 w-5 text-white/40" />
  </button>
);

const LearnCard = ({ color, icon, title, desc, onClick }: { color: string; icon: React.ReactNode; title: string; desc: string; onClick: () => void }) => (
  <button onClick={onClick} className={`shrink-0 w-[260px] text-left rounded-3xl bg-gradient-to-br ${color} p-5 relative`}>
    <div className="flex items-start justify-between mb-12">
      {icon}
      <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
        <ChevronRight className="h-4 w-4 text-white" />
      </div>
    </div>
    <p className="font-bold text-[22px] leading-tight text-white">{title}</p>
    <p className="mt-2 text-sm text-white/85">{desc}</p>
  </button>
);

const ActionRow = ({ color, icon, title, desc, onClick }: { color: string; icon: React.ReactNode; title: string; desc: string; onClick: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition">
    <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: color }}>
      {icon}
    </div>
    <div className="text-left">
      <p className="font-bold text-[16px]">{title}</p>
      <p className="text-sm text-white/55">{desc}</p>
    </div>
  </button>
);

const TxRowItem = ({ tx, format, onClick }: { tx: TxRow; format: (n: number) => string; onClick: () => void }) => {
  const t = (tx.type || "").toLowerCase();
  const isNft = t.startsWith("nft");
  const amt = Number(tx.amount || 0);
  const isIn = isNft ? amt >= 0 : ["receive", "topup", "top_up", "deposit"].some((k) => t.includes(k));
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#0f0f0f] hover:bg-[#161616] transition">
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isNft ? "bg-blue-500/15" : "bg-white/5"}`}>
        {isNft ? <Sparkles className="h-5 w-5" style={{ color: ACCENT }} /> : isIn ? <ArrowDown className="h-5 w-5 text-green-400" /> : <ArrowUp className="h-5 w-5 text-white/70" />}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="font-semibold text-[14px] truncate">{tx.description || tx.type || "Transaction"}</p>
        <p className="text-xs text-white/50">{new Date(tx.created_at).toLocaleString()}{isNft ? " · NFT" : ""}</p>
      </div>
      <p className={`font-bold text-[15px] ${isIn ? "text-green-400" : "text-white"}`}>
        {isIn ? "+" : "-"}{format(Math.abs(amt))}
      </p>
    </button>
  );
};

export default Web3Dashboard;
