import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowLeft, Share2, Gift, ShoppingCart, Wallet, CreditCard, X, Users, Tag, Gavel, HelpCircle, Edit3, Trash2, Clock } from "lucide-react";

const ACCENT = "hsl(217 91% 60%)";

const NftDetailPage = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { format } = useCurrency();
  const [item, setItem] = useState<any>(null);
  const [owners, setOwners] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [creator, setCreator] = useState<any>(null);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [bidOpen, setBidOpen] = useState<any>(null);
  const [editListing, setEditListing] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<"openpay_balance" | "pi" | "virtual_card">("openpay_balance");
  const [card, setCard] = useState({ number: "", cvc: "", exp_month: "", exp_year: "" });
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);
  const [giftUsername, setGiftUsername] = useState("");
  const [giftMsg, setGiftMsg] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [listPrice, setListPrice] = useState("");
  const [aStart, setAStart] = useState("");
  const [aInc, setAInc] = useState("1");
  const [aHours, setAHours] = useState("24");

  const [bidAmt, setBidAmt] = useState("");

  const load = async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id || null);
    const { data: it } = await (supabase as any).from("nft_items").select("*").eq("id", id).maybeSingle();
    setItem(it);
    if (it) {
      const [{ data: own }, { data: tx }, { data: prof }] = await Promise.all([
        (supabase as any).from("nft_ownership").select("owner_id, quantity").eq("item_id", id).gt("quantity", 0),
        (supabase as any).from("nft_transactions").select("*").eq("item_id", id).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("profiles").select("username, full_name, avatar_url").eq("id", it.creator_id).maybeSingle(),
      ]);
      const ownerIds = (own || []).map((o: any) => o.owner_id);
      const { data: ownerProfs } = ownerIds.length
        ? await (supabase as any).from("profiles").select("id, username, full_name, avatar_url").in("id", ownerIds)
        : { data: [] };
      const profMap: Record<string, any> = {};
      (ownerProfs || []).forEach((p: any) => (profMap[p.id] = p));
      setOwners((own || []).map((o: any) => ({ ...o, profile: profMap[o.owner_id] })));
      setTxs(tx || []);
      setCreator(prof);
      const [{ data: ls }, { data: au }] = await Promise.all([
        (supabase as any).from("nft_listings").select("*").eq("item_id", id).eq("status", "active").order("price"),
        (supabase as any).from("nft_auctions").select("*").eq("item_id", id).in("status", ["active","ended"]).order("created_at", { ascending: false }),
      ]);
      setListings(ls || []);
      setAuctions(au || []);
    }
  };

  useEffect(() => { load(); }, [id]);

  const myOwn = useMemo(() => owners.find((o) => o.owner_id === me)?.quantity || 0, [owners, me]);
  const isCreator = me && item && me === item.creator_id;

  const handleBuy = async () => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("nft_buy_item", {
        p_item_id: id,
        p_quantity: qty,
        p_payment_method: method,
        p_listing_id: null,
      });
      if (error) throw error;
      toast({ title: "Purchase complete!" });
      setBuyOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Buy failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const handleGift = async () => {
    setBusy(true);
    try {
      const uname = giftUsername.replace(/^@/, "").trim();
      const { data: target } = await (supabase as any).from("profiles").select("id").eq("username", uname).maybeSingle();
      if (!target) throw new Error("User not found");
      const { error } = await (supabase as any).rpc("nft_gift_item", {
        p_item_id: id,
        p_recipient_id: target.id,
        p_quantity: qty,
        p_message: giftMsg,
      });
      if (error) throw error;
      toast({ title: "Gift sent!" });
      setGiftOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: "Gift failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const share = async () => {
    const url = `${window.location.origin}/web3/nft/${id}`;
    const text = `Check out "${item?.name}" NFT on OpenPay`;
    if (navigator.share) {
      try { await navigator.share({ title: item?.name, text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied!" });
  };

  const callRpc = async (fn: string, args: any, ok: string) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc(fn, args);
      if (error) throw error;
      toast({ title: ok });
      await load();
      return true;
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
      return false;
    } finally { setBusy(false); }
  };

  const handleList = async () => {
    if (!listPrice || Number(listPrice) < 0) return;
    const ok = await callRpc("nft_create_listing", { p_item_id: id, p_price: Number(listPrice), p_quantity: qty }, "Listed for resale");
    if (ok) { setListOpen(false); setListPrice(""); }
  };
  const handleEditPrice = async () => {
    if (!editListing || !listPrice) return;
    const ok = await callRpc("nft_update_listing_price", { p_listing_id: editListing.id, p_new_price: Number(listPrice) }, "Price updated");
    if (ok) { setEditListing(null); setListPrice(""); }
  };
  const handleCancelListing = async (l: any) => {
    await callRpc("nft_cancel_listing", { p_listing_id: l.id }, "Listing cancelled");
  };
  const handleBuyListing = async (l: any) => {
    await callRpc("nft_buy_item", { p_item_id: id, p_quantity: 1, p_payment_method: "openpay_balance", p_listing_id: l.id }, "Purchased");
  };
  const handleCreateAuction = async () => {
    const ok = await callRpc("nft_create_auction", {
      p_item_id: id, p_quantity: qty,
      p_start_price: Number(aStart || 0), p_min_increment: Number(aInc || 1), p_duration_hours: Number(aHours || 24),
    }, "Auction started");
    if (ok) { setAuctionOpen(false); setAStart(""); }
  };
  const handlePlaceBid = async () => {
    if (!bidOpen) return;
    const ok = await callRpc("nft_place_bid", { p_auction_id: bidOpen.id, p_amount: Number(bidAmt) }, "Bid placed");
    if (ok) { setBidOpen(null); setBidAmt(""); }
  };
  const handleFinalize = async (a: any) => {
    await callRpc("nft_finalize_auction", { p_auction_id: a.id }, "Auction finalized");
  };
  const handleCancelAuction = async (a: any) => {
    await callRpc("nft_cancel_auction", { p_auction_id: a.id }, "Auction cancelled");
  };

  if (!item) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;

  const img = item.media_url || item.image_url;

  return (
    <div className="min-h-screen bg-black text-white pb-36">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold flex-1 truncate">{item.name}</h1>
        <button onClick={() => nav("/web3/nft/how-to")} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="How it works">
          <HelpCircle className="h-5 w-5" />
        </button>
        <button onClick={share} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <Share2 className="h-5 w-5" />
        </button>
      </header>

      <div className="aspect-square bg-[#0f0f0f] flex items-center justify-center overflow-hidden">
        {img ? <img src={img} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-white/30">No media</span>}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs text-white/40">#{item.code}</p>
          <h2 className="text-2xl font-extrabold">{item.name}</h2>
          {creator && (
            <p className="text-sm text-white/60 mt-1">by @{creator.username || creator.full_name || "creator"}</p>
          )}
        </div>

        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">Price</p>
              <p className="text-2xl font-extrabold" style={{ color: ACCENT }}>{format(Number(item.price || 0))}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/50">Supply</p>
              <p className="font-bold">{item.quantity_total}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <Stat label="Owners" value={owners.length} />
            <Stat label="Sold" value={txs.filter((t) => ["sale","resale"].includes(t.tx_kind)).reduce((s,t)=>s+Number(t.quantity||0),0)} />
            <Stat label="You own" value={myOwn} />
          </div>
        </div>

        {item.description && (
          <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
            <p className="text-xs font-semibold text-white/50 mb-1">DESCRIPTION</p>
            <p className="text-sm text-white/85 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}

        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <p className="text-xs font-semibold text-white/50 mb-2 flex items-center gap-1"><Users className="h-3 w-3" /> OWNERS</p>
          {owners.length === 0 ? <p className="text-sm text-white/50">No owners yet</p> : (
            <div className="space-y-2">
              {owners.map((o) => (
                <div key={o.owner_id} className="flex items-center gap-3">
                  {o.profile?.avatar_url
                    ? <img src={o.profile.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                    : <div className="h-8 w-8 rounded-full bg-white/10" />}
                  <span className="flex-1 text-sm">@{o.profile?.username || o.owner_id.slice(0,8)}</span>
                  <span className="text-sm text-white/70 font-bold">×{o.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RESALE LISTINGS */}
        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white/50 flex items-center gap-1"><Tag className="h-3 w-3" /> RESALE LISTINGS</p>
            {myOwn > 0 && (
              <button onClick={() => { setListPrice(String(item.price)); setListOpen(true); }} className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: ACCENT }}>+ List</button>
            )}
          </div>
          {listings.length === 0 ? <p className="text-sm text-white/50">No active listings</p> : (
            <div className="space-y-2">
              {listings.map((l) => {
                const mine = l.seller_id === me;
                return (
                  <div key={l.id} className="flex items-center gap-2 border-b border-white/5 pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="font-bold" style={{ color: ACCENT }}>{format(Number(l.price))}</p>
                      <p className="text-xs text-white/40">×{l.quantity} available {mine && "· You"}</p>
                    </div>
                    {mine ? (
                      <>
                        <button onClick={() => { setEditListing(l); setListPrice(String(l.price)); }} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"><Edit3 className="h-4 w-4" /></button>
                        <button onClick={() => handleCancelListing(l)} disabled={busy} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <button onClick={() => handleBuyListing(l)} disabled={busy} className="text-xs font-bold px-3 py-2 rounded-full" style={{ backgroundColor: ACCENT }}>Buy</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AUCTIONS */}
        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white/50 flex items-center gap-1"><Gavel className="h-3 w-3" /> AUCTIONS</p>
            {myOwn > 0 && (
              <button onClick={() => { setAStart(String(item.price)); setAuctionOpen(true); }} className="text-xs font-bold px-3 py-1 rounded-full bg-white/10">+ Auction</button>
            )}
          </div>
          {auctions.length === 0 ? <p className="text-sm text-white/50">No auctions running</p> : (
            <div className="space-y-3">
              {auctions.map((a) => {
                const ended = new Date(a.ends_at).getTime() < Date.now();
                const mine = a.seller_id === me;
                return (
                  <div key={a.id} className="rounded-xl bg-black/40 border border-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-white/50">Current bid</p>
                        <p className="text-xl font-extrabold" style={{ color: ACCENT }}>{format(Number(a.current_bid ?? a.start_price))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/50 flex items-center gap-1"><Clock className="h-3 w-3" />{ended ? "Ended" : "Ends"}</p>
                        <p className="text-xs text-white/80">{new Date(a.ends_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {a.status === "active" && !ended && !mine && (
                        <button onClick={() => { setBidOpen(a); setBidAmt(String((Number(a.current_bid ?? a.start_price)) + Number(a.min_increment))); }} className="flex-1 rounded-full py-2 text-sm font-bold" style={{ backgroundColor: ACCENT }}>Place bid</button>
                      )}
                      {ended && a.status === "active" && (
                        <button onClick={() => handleFinalize(a)} disabled={busy} className="flex-1 rounded-full py-2 text-sm font-bold bg-white/10">Finalize</button>
                      )}
                      {mine && a.status === "active" && !a.current_bid && (
                        <button onClick={() => handleCancelAuction(a)} disabled={busy} className="rounded-full px-3 py-2 text-sm bg-white/10">Cancel</button>
                      )}
                      {a.status === "settled" && <span className="text-xs text-emerald-400 font-bold">SETTLED</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <p className="text-xs font-semibold text-white/50 mb-2">TRANSPARENT HISTORY</p>
          {txs.length === 0 ? <p className="text-sm text-white/50">No activity yet</p> : (
            <div className="space-y-2 text-sm">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <div>
                    <p className="font-semibold capitalize">{t.tx_kind}</p>
                    <p className="text-xs text-white/40">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-white/80">×{t.quantity} {t.total > 0 ? `· ${format(Number(t.total))}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur p-4 flex gap-2 border-t border-white/10">
        {!isCreator && item.is_active && (
          <button onClick={() => setBuyOpen(true)} className="flex-1 rounded-full py-3 font-bold flex items-center justify-center gap-2"
            style={{ backgroundColor: ACCENT }}>
            <ShoppingCart className="h-4 w-4" /> Buy
          </button>
        )}
        {myOwn > 0 && (
          <button onClick={() => setGiftOpen(true)} className="flex-1 rounded-full py-3 font-bold bg-white/10 flex items-center justify-center gap-2">
            <Gift className="h-4 w-4" /> Gift
          </button>
        )}
      </div>

      {buyOpen && (
        <Modal onClose={() => setBuyOpen(false)} title="Buy NFT">
          <Field label="Quantity" value={qty} onChange={(v) => setQty(Math.max(1, Number(v)||1))} type="number" />
          <div className="space-y-2">
            <p className="text-xs text-white/60 font-semibold">Payment</p>
            <PayOpt active={method==="openpay_balance"} onClick={() => setMethod("openpay_balance")} icon={<Wallet className="h-4 w-4" />} label="OpenPay Balance" />
            <PayOpt active={method==="pi"} onClick={() => setMethod("pi")} icon={<img src="/openpay-o.svg" className="h-4 w-4" alt="" />} label="Pi Network" />
            <PayOpt active={method==="virtual_card"} onClick={() => setMethod("virtual_card")} icon={<CreditCard className="h-4 w-4" />} label="Virtual Card" />
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-white/10">
            <span className="text-white/60">Total</span>
            <span className="font-bold">{format(Number(item.price)*qty)}</span>
          </div>
          <button onClick={handleBuy} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Processing…" : "Confirm Purchase"}
          </button>
        </Modal>
      )}

      {giftOpen && (
        <Modal onClose={() => setGiftOpen(false)} title="Send as Gift">
          <Field label="Recipient @username" value={giftUsername} onChange={setGiftUsername} />
          <Field label={`Quantity (you own ×${myOwn})`} value={qty} onChange={(v: any) => setQty(Math.min(myOwn, Math.max(1, Number(v)||1)))} type="number" />
          <Field label="Message (optional)" value={giftMsg} onChange={setGiftMsg} multiline />
          <button onClick={handleGift} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Sending…" : "Send Gift"}
          </button>
        </Modal>
      )}

      {listOpen && (
        <Modal onClose={() => setListOpen(false)} title="List for resale">
          <Field label={`Price per item (you own ×${myOwn})`} value={listPrice} onChange={setListPrice} type="number" />
          <Field label="Quantity" value={qty} onChange={(v: any) => setQty(Math.min(myOwn, Math.max(1, Number(v)||1)))} type="number" />
          <p className="text-xs text-white/50">You can change the price or cancel any time.</p>
          <button onClick={handleList} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Listing…" : "List Now"}
          </button>
        </Modal>
      )}

      {editListing && (
        <Modal onClose={() => setEditListing(null)} title="Update price">
          <Field label="New price" value={listPrice} onChange={setListPrice} type="number" />
          <p className="text-xs text-white/50">Increase or decrease the price freely.</p>
          <button onClick={handleEditPrice} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Saving…" : "Save Price"}
          </button>
        </Modal>
      )}

      {auctionOpen && (
        <Modal onClose={() => setAuctionOpen(false)} title="Start an auction">
          <Field label={`Quantity (you own ×${myOwn})`} value={qty} onChange={(v: any) => setQty(Math.min(myOwn, Math.max(1, Number(v)||1)))} type="number" />
          <Field label="Start price" value={aStart} onChange={setAStart} type="number" />
          <Field label="Minimum bid increment" value={aInc} onChange={setAInc} type="number" />
          <Field label="Duration (hours)" value={aHours} onChange={setAHours} type="number" />
          <p className="text-xs text-white/50">Bids escrow from OpenPay balance. Highest bid wins when the timer ends.</p>
          <button onClick={handleCreateAuction} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Starting…" : "Start Auction"}
          </button>
        </Modal>
      )}

      {bidOpen && (
        <Modal onClose={() => setBidOpen(null)} title="Place a bid">
          <p className="text-sm text-white/70">Current bid: <span className="font-bold text-white">{format(Number(bidOpen.current_bid ?? bidOpen.start_price))}</span></p>
          <p className="text-xs text-white/50">Minimum next bid: {format(Number(bidOpen.current_bid ?? bidOpen.start_price) + (bidOpen.current_bid ? Number(bidOpen.min_increment) : 0))}</p>
          <Field label="Your bid" value={bidAmt} onChange={setBidAmt} type="number" />
          <p className="text-xs text-white/50">Funds are escrowed. If outbid, you'll be refunded automatically.</p>
          <button onClick={handlePlaceBid} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Bidding…" : "Place Bid"}
          </button>
        </Modal>
      )}
    </div>
  );
};

const Stat = ({ label, value }: any) => (
  <div className="rounded-xl bg-white/5 py-2">
    <p className="text-xs text-white/50">{label}</p>
    <p className="font-bold">{value}</p>
  </div>
);

const Modal = ({ children, onClose, title }: any) => (
  <>
    <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
    <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#111] p-5 space-y-3 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold">{title}</h3>
        <button onClick={onClose} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"><X className="h-4 w-4" /></button>
      </div>
      {children}
    </div>
  </>
);

const Field = ({ label, value, onChange, multiline, type = "text" }: any) => (
  <div>
    <label className="text-xs text-white/60 font-semibold">{label}</label>
    {multiline ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        className="mt-1 w-full rounded-xl bg-[#0f0f0f] border border-white/10 p-3 text-sm outline-none" />
    ) : (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-[#0f0f0f] border border-white/10 p-3 text-sm outline-none" />
    )}
  </div>
);

const PayOpt = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl border ${active ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-[#0f0f0f]"}`}>
    {icon}
    <span className="text-sm font-semibold">{label}</span>
  </button>
);

export default NftDetailPage;
