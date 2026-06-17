import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { setUiMode } from "@/lib/uiMode";
import {
  Home,
  Clock,
  Search,
  Plus,
  Wallet,
  ArrowDown,
  ArrowUp,
  Repeat,
  PiggyBank,
  TrendingUp,
  Bitcoin,
  LineChart,
  Shield,
  X,
  HelpCircle,
  ChevronRight,
  Building2,
  CreditCard,
  Send,
  QrCode,
  Sparkles,
} from "lucide-react";

type Tab = "home" | "activity" | "search";

const ACCENT = "#D4FF3F";

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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (prof) setProfile(prof as any);
      const { data: w } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (w?.balance != null) setBalance(Number(w.balance));
    })();
  }, []);

  const displayName = profile.username ? `@${profile.username}` : profile.full_name || "OpenPay";
  const avatar = profile.avatar_url;

  return (
    <div className="min-h-screen bg-black text-white pb-32 relative overflow-x-hidden" style={{ fontFamily: "'SF Pro Display', system-ui, -apple-system, sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5">
        <button
          onClick={() => navigate("/menu")}
          className="flex items-center gap-2"
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-sm">
              🦊
            </div>
          )}
          <span className="font-semibold text-[15px]">{displayName}</span>
        </button>
        <button
          onClick={() => setUiMode("original")}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/5"
          title="Switch to classic UI"
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          Web3
        </button>
      </div>

      {tab === "home" && (
        <>
          {/* Balance */}
          <div className="flex flex-col items-center pt-12">
            <div className="flex items-baseline">
              <span className="text-6xl font-extrabold tracking-tight">{format(balance).replace(/\.\d+$/, "")}</span>
              <span className="text-4xl font-extrabold tracking-tight text-white/40">
                .{(balance.toFixed(2).split(".")[1]) || "00"}
              </span>
            </div>
            <p className="mt-3 text-center text-[15px] text-white/60">
              {balance > 0 ? "Your OpenPay balance" : "Add cash or crypto to start\nusing OpenPay"}
            </p>
            <button
              onClick={() => navigate("/top-up")}
              className="mt-6 flex items-center gap-2 rounded-full px-7 py-3 font-bold text-black shadow-lg active:scale-95 transition"
              style={{ backgroundColor: ACCENT }}
            >
              <ArrowDown className="h-5 w-5" />
              Deposit
            </button>
          </div>

          {/* Convert banner */}
          {showConvert && (
            <div className="mt-10 mx-4 rounded-2xl bg-[#1a1a1a] p-4 flex items-center gap-3 relative">
              <div className="h-12 w-12 rounded-2xl bg-yellow-400 flex items-center justify-center">
                <Bitcoin className="h-6 w-6 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px]">Convert to OUSD</p>
                <p className="text-xs text-white/60">Turn your cash into stablecoin at the best rates</p>
              </div>
              <button onClick={() => setShowConvert(false)} className="text-white/40 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Cash & Savings tiles */}
          <div className="mt-4 mx-4 grid grid-cols-2 gap-3">
            <Tile icon={<Building2 className="h-5 w-5 text-white/70" />} title="Cash" subtitle="Manage cash" onClick={() => navigate("/wallet")} />
            <Tile icon={<LineChart className="h-5 w-5 text-white/70" />} title="Savings" subtitle="Earn 11.0% APY" onClick={() => navigate("/savings")} />
          </div>

          {/* Markets */}
          <h3 className="mt-8 mx-5 text-white/60 text-[15px] font-semibold">Markets</h3>
          <div className="mt-3 mx-4 space-y-3">
            <RowTile title="Crypto" subtitle="Explore crypto" onClick={() => navigate("/wallet")} />
            <RowTile title="Stocks" subtitle="Explore stocks" onClick={() => navigate("/savings")} />
          </div>

          {/* Learn more */}
          <h3 className="mt-8 mx-5 text-white/60 text-[15px] font-semibold">Learn more</h3>
          <div className="mt-3 ml-4 flex gap-3 overflow-x-auto pb-2 pr-4 [&::-webkit-scrollbar]:hidden">
            <LearnCard
              color="from-violet-600 to-violet-500"
              icon={<ArrowDown className="h-6 w-6 text-white" />}
              title="Moving your funds"
              desc="Learn how to add or move funds seamlessly into OpenPay"
              onClick={() => navigate("/help")}
            />
            <LearnCard
              color="from-teal-500 to-emerald-500"
              icon={<Shield className="h-6 w-6 text-white" />}
              title="Security"
              desc="Learn how we keep your money safe and secure"
              onClick={() => navigate("/help")}
            />
            <LearnCard
              color="from-orange-500 to-pink-500"
              icon={<QrCode className="h-6 w-6 text-white" />}
              title="QR Pay"
              desc="Pay or get paid by scanning a code"
              onClick={() => navigate("/qr-pay")}
            />
          </div>
        </>
      )}

      {tab === "activity" && (
        <div className="px-5 pt-6">
          <h1 className="text-4xl font-extrabold">Activity</h1>
          <div className="mt-5 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {["All", "Converts", "Deposits", "Withdrawals", "Sent"].map((c, i) => (
              <button
                key={c}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
                  i === 0 ? "bg-white text-black" : "border border-white/20 text-white/80"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center justify-center mt-32 text-center">
            <div className="text-white/30 text-5xl mb-4">↻</div>
            <p className="text-xl font-bold">Your activity starts now</p>
            <p className="mt-2 text-white/60 text-sm max-w-xs">
              We couldn't find any activity yet. New activity will show up here
            </p>
            <button
              onClick={() => navigate("/top-up")}
              className="mt-6 flex items-center gap-2 rounded-full px-7 py-3 font-bold text-black"
              style={{ backgroundColor: ACCENT }}
            >
              <ArrowDown className="h-5 w-5" />
              Add funds
            </button>
          </div>
        </div>
      )}

      {tab === "search" && (
        <div className="px-5 pt-6">
          <h1 className="text-4xl font-extrabold">Search</h1>
          <input
            placeholder="Search assets, contacts..."
            className="mt-5 w-full rounded-2xl bg-[#1a1a1a] px-4 py-3 text-white placeholder:text-white/40 outline-none"
          />
          <p className="mt-10 text-center text-white/50">Search across crypto, contacts and transactions.</p>
        </div>
      )}

      {/* Bottom action sheet */}
      {actionsOpen && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setActionsOpen(false)} />
          <div className="fixed bottom-28 left-4 right-4 z-50 rounded-3xl bg-[#1a1a1a] p-3 space-y-1 animate-in slide-in-from-bottom-4">
            <ActionRow color="bg-emerald-500" icon={<Send className="h-5 w-5 text-white" />} title="Send money" desc="Pay anyone instantly" onClick={() => { setActionsOpen(false); navigate("/send"); }} />
            <ActionRow color="bg-blue-500" icon={<ArrowUp className="h-5 w-5 text-white" />} title="Send crypto" desc="To any wallet address" onClick={() => { setActionsOpen(false); navigate("/send"); }} />
            <ActionRow color="bg-violet-500" icon={<Bitcoin className="h-5 w-5 text-white" />} title="Invest" desc="Grow your money in crypto or stocks" onClick={() => { setActionsOpen(false); navigate("/wallet"); }} />
            <ActionRow color="bg-orange-500" icon={<PiggyBank className="h-5 w-5 text-white" />} title="Save" desc="Move money into savings" onClick={() => { setActionsOpen(false); navigate("/savings"); }} />
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
          <Plus className="h-7 w-7 text-black" />
        </button>
      </div>
    </div>
  );
};

const NavBtn = ({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center h-10 rounded-full transition ${
      active ? "text-black" : "text-white/70"
    }`}
    style={active ? { backgroundColor: ACCENT } : undefined}
  >
    {icon}
  </button>
);

const Tile = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="text-left rounded-2xl border border-dashed border-white/15 bg-[#0f0f0f] p-4 hover:bg-[#161616] transition"
  >
    <div className="mb-6">{icon}</div>
    <p className="font-bold text-[17px]">{title}</p>
    <p className="text-sm text-white/55">{subtitle}</p>
  </button>
);

const RowTile = ({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full text-left rounded-2xl border border-dashed border-white/15 bg-[#0f0f0f] p-4 flex items-center hover:bg-[#161616] transition"
  >
    <div className="flex-1">
      <p className="font-bold text-[17px]">{title}</p>
      <p className="text-sm text-white/55">{subtitle}</p>
    </div>
    <ChevronRight className="h-5 w-5 text-white/40" />
  </button>
);

const LearnCard = ({
  color,
  icon,
  title,
  desc,
  onClick,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`shrink-0 w-[260px] text-left rounded-3xl bg-gradient-to-br ${color} p-5 relative`}
  >
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

const ActionRow = ({
  color,
  icon,
  title,
  desc,
  onClick,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition"
  >
    <div className={`h-12 w-12 rounded-2xl ${color} flex items-center justify-center`}>{icon}</div>
    <div className="text-left">
      <p className="font-bold text-[16px]">{title}</p>
      <p className="text-sm text-white/55">{desc}</p>
    </div>
  </button>
);

export default Web3Dashboard;
