import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { NftStatusBadge } from "@/lib/nftStatus";
import { formatNftPrice } from "@/lib/nftPrice";
import { ArrowLeft, Share2, Gift, ShoppingCart, Wallet, CreditCard, X, Users, Tag, Gavel, HelpCircle, Edit3, Trash2, Clock, Eye, EyeOff } from "lucide-react";
import { celebrate, playNftSound } from "@/lib/nftFx";
import NftBurst from "@/components/web3/NftBurst";
import { LiveAuctionPanel } from "@/components/web3/LiveAuctionPanel";


const ACCENT = "hsl(217 91% 60%)";

const NftDetailPage = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { format } = useCurrency();
  const [item, setItem] = useState<any>(null);
  const [owners, setOwners] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [creator, setCreator] = useState<any>(null);
  const [creatorStore, setCreatorStore] = useState<any>(null);
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
  const [cardHidden, setCardHidden] = useState(true);
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
  const [bidMethod, setBidMethod] = useState<"openpay_balance" | "pi" | "virtual_card">("openpay_balance");
  const [burst, setBurst] = useState<{ kind: "buy"|"gift"|"list"|"bid"|"auction"; msg: string } | null>(null);



  const load = async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id || null);
    const { data: it } = await (supabase as any).from("nft_items").select("*").eq("id", id).maybeSingle();
    setItem(it);
    if (it) {
      const [{ data: own }, { data: tx }, { data: prof }, { data: storeProf }] = await Promise.all([
        (supabase as any).from("nft_ownership").select("owner_id, quantity").eq("item_id", id).gt("quantity", 0),
        (supabase as any).from("nft_transactions").select("*").eq("item_id", id).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("profiles").select("username, full_name, avatar_url").eq("id", it.creator_id).maybeSingle(),
        (supabase as any).from("nft_store_profiles")
          .select("handle, display_name, avatar_url, banner_url, bio, category, is_verified")
          .eq("user_id", it.creator_id).maybeSingle(),
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
      setCreatorStore(storeProf);
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

  const openBuy = async () => {
    if (auctions.some((a: any) => a.status === "active" && new Date(a.ends_at).getTime() > Date.now())) {
      toast({ title: "Auction in progress", description: "Only the winning bidder can claim this NFT while an auction is live.", variant: "destructive" });
      return;
    }
    setBuyOpen(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: cards } = await (supabase as any)
        .from("virtual_cards").select("card_number, cvc, expiry_month, expiry_year").eq("user_id", user.id).eq("is_active", true).limit(1);
      setSavedCards(cards || []);
      if (cards && cards[0]) {
        setCard({
          number: cards[0].card_number,
          cvc: cards[0].cvc,
          exp_month: String(cards[0].expiry_month),
          exp_year: String(cards[0].expiry_year),
        });
      }
    }
  };

  const runBuy = async (extra: Record<string, any> = {}) => {
    const { data, error } = await (supabase as any).rpc("nft_buy_item", {
      p_item_id: id,
      p_quantity: qty,
      p_payment_method: method,
      p_listing_id: null,
      ...extra,
    });
    if (error) throw error;
    const total = Number(item.price) * qty;
    setReceipt({
      ref: data,
      item_name: item.name,
      qty,
      total,
      currency: item.currency,
      method,
      pi_txid: extra.p_pi_txid || null,
      card_last4: extra.p_card_number ? String(extra.p_card_number).slice(-4) : null,
      ts: new Date().toISOString(),
    });
    toast({ title: "Purchase complete!" });
    celebrate("buy");
    setBurst({ kind: "buy", msg: `You own ${item.name}!` });
    setBuyOpen(false);
    await load();
  };

  const handleBuy = async () => {
    setBusy(true);
    try {
      if (method === "openpay_balance") {
        await runBuy();
      } else if (method === "virtual_card") {
        if (!card.number || !card.cvc || !card.exp_month || !card.exp_year) {
          throw new Error("Card details required");
        }
        await runBuy({
          p_card_number: card.number.replace(/\s+/g, ""),
          p_card_cvc: card.cvc,
          p_card_exp_month: Number(card.exp_month),
          p_card_exp_year: Number(card.exp_year),
        });
      } else if (method === "pi") {
        const Pi = (window as any).Pi;
        if (!Pi || typeof Pi.createPayment !== "function") {
          throw new Error("Pi SDK not available — open in Pi Browser");
        }
        try {
          await Pi.authenticate(["username", "payments"], async (incomplete: any) => {
            if (incomplete?.identifier && incomplete?.transaction?.txid) {
              await supabase.functions.invoke("pi-platform", {
                body: { action: "complete", paymentId: incomplete.identifier, txid: incomplete.transaction.txid },
              });
            }
          });
        } catch (e: any) { throw new Error(e?.message || "Pi sign-in required"); }
        const amount = Number(item.price) * qty;
        await new Promise<void>((resolve, reject) => {
          Pi.createPayment(
            { amount, memo: `NFT ${item.name} x${qty}`.slice(0, 64),
              metadata: { kind: "nft_buy", item_id: id, qty } },
            {
              onReadyForServerApproval: async (paymentId: string) => {
                await supabase.functions.invoke("pi-platform", { body: { action: "approve", paymentId } });
              },
              onReadyForServerCompletion: async (paymentId: string, txid: string) => {
                try {
                  await supabase.functions.invoke("pi-platform", { body: { action: "complete", paymentId, txid } });
                  await runBuy({ p_pi_payment_id: paymentId, p_pi_txid: txid });
                  resolve();
                } catch (err: any) { reject(err); }
              },
              onCancel: () => reject(new Error("Pi payment cancelled")),
              onError: (e: any) => reject(new Error(e?.message || "Pi payment failed")),
            },
          );
        });
      }
    } catch (e: any) {
      playNftSound("error");
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
      celebrate("gift");
      setBurst({ kind: "gift", msg: `Gift sent to @${uname}!` });
      toast({ title: "Gift sent!" });
      setGiftOpen(false);
      await load();
    } catch (e: any) {
      playNftSound("error");
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

  const callRpc = async (fn: string, args: any, ok: string, sfx?: { kind: "buy"|"gift"|"list"|"bid"|"auction"; sound: "buy"|"gift"|"list"|"bid"|"auction"|"mint" }) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc(fn, args);
      if (error) throw error;
      toast({ title: ok });
      if (sfx) { playNftSound(sfx.sound); setBurst({ kind: sfx.kind, msg: ok }); }
      await load();
      return true;
    } catch (e: any) {
      playNftSound("error");
      toast({ title: "Failed", description: e.message, variant: "destructive" });
      return false;
    } finally { setBusy(false); }
  };

  const handleList = async () => {
    if (!listPrice || Number(listPrice) < 0) return;
    const ok = await callRpc("nft_create_listing", { p_item_id: id, p_price: Number(listPrice), p_quantity: qty }, "Listed for resale", { kind: "list", sound: "list" });
    if (ok) { setListOpen(false); setListPrice(""); }
  };
  const handleEditPrice = async () => {
    if (!editListing || !listPrice) return;
    const ok = await callRpc("nft_update_listing_price", { p_listing_id: editListing.id, p_new_price: Number(listPrice) }, "Price updated", { kind: "list", sound: "list" });
    if (ok) { setEditListing(null); setListPrice(""); }
  };
  const handleCancelListing = async (l: any) => {
    await callRpc("nft_cancel_listing", { p_listing_id: l.id }, "Listing cancelled");
  };
  const handleBuyListing = async (l: any) => {
    await callRpc("nft_buy_item", { p_item_id: id, p_quantity: 1, p_payment_method: "openpay_balance", p_listing_id: l.id }, "Purchased", { kind: "buy", sound: "buy" });
  };
  const handleCreateAuction = async () => {
    const ok = await callRpc("nft_create_auction", {
      p_item_id: id, p_quantity: qty,
      p_start_price: Number(aStart || 0), p_min_increment: Number(aInc || 1), p_duration_hours: Number(aHours || 24),
    }, "Auction started", { kind: "auction", sound: "auction" });
    if (ok) { setAuctionOpen(false); setAStart(""); }
  };
  const runBidRpc = async (extra: Record<string, any> = {}) => {
    const { error } = await (supabase as any).rpc("nft_place_bid_with_payment", {
      p_auction_id: bidOpen.id,
      p_amount: Number(bidAmt),
      p_payment_method: bidMethod,
      ...extra,
    });
    if (error) throw error;
    playNftSound("bid");
    setBurst({ kind: "bid", msg: "Bid placed" });
    toast({ title: "Bid placed" });
    await load();
  };

  const handlePlaceBid = async () => {
    if (!bidOpen) return;
    setBusy(true);
    try {
      const amount = Number(bidAmt);
      if (!amount || amount <= 0) throw new Error("Enter a bid amount");

      if (bidMethod === "openpay_balance") {
        await runBidRpc();
      } else if (bidMethod === "virtual_card") {
        if (!card.number || !card.cvc || !card.exp_month || !card.exp_year) {
          throw new Error("Card details required");
        }
        await runBidRpc({
          p_card_number: card.number.replace(/\s+/g, ""),
          p_card_cvc: card.cvc,
          p_card_exp_month: Number(card.exp_month),
          p_card_exp_year: Number(card.exp_year),
        });
      } else if (bidMethod === "pi") {
        const Pi = (window as any).Pi;
        if (!Pi || typeof Pi.createPayment !== "function") {
          throw new Error("Pi SDK not available — open in Pi Browser");
        }
        try {
          await Pi.authenticate(["username", "payments"], async (incomplete: any) => {
            if (incomplete?.identifier && incomplete?.transaction?.txid) {
              await supabase.functions.invoke("pi-platform", {
                body: { action: "complete", paymentId: incomplete.identifier, txid: incomplete.transaction.txid },
              });
            }
          });
        } catch (e: any) { throw new Error(e?.message || "Pi sign-in required"); }
        await new Promise<void>((resolve, reject) => {
          Pi.createPayment(
            { amount, memo: `Bid on ${item.name}`.slice(0, 64),
              metadata: { kind: "nft_bid", auction_id: bidOpen.id, amount } },
            {
              onReadyForServerApproval: async (paymentId: string) => {
                await supabase.functions.invoke("pi-platform", { body: { action: "approve", paymentId } });
              },
              onReadyForServerCompletion: async (paymentId: string, txid: string) => {
                try {
                  await supabase.functions.invoke("pi-platform", { body: { action: "complete", paymentId, txid } });
                  await runBidRpc({ p_pi_payment_id: paymentId, p_pi_txid: txid });
                  resolve();
                } catch (err: any) { reject(err); }
              },
              onCancel: () => reject(new Error("Pi payment cancelled")),
              onError: (e: any) => reject(new Error(e?.message || "Pi payment failed")),
            },
          );
        });
      }
      setBidOpen(null);
      setBidAmt("");
    } catch (e: any) {
      playNftSound("error");
      toast({ title: "Bid failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };
  const handleFinalize = async (a: any) => {
    await callRpc("nft_finalize_auction", { p_auction_id: a.id }, "Auction finalized", { kind: "auction", sound: "auction" });
  };
  const handleCancelAuction = async (a: any) => {
    await callRpc("nft_cancel_auction", { p_auction_id: a.id }, "Auction cancelled");
  };

  const totalSold = txs.filter((t) => ["sale","resale"].includes(t.tx_kind)).reduce((s,t) => s + Number(t.quantity || 0), 0);
  const activeAuctions = auctions.filter((a: any) => a.status === "active" && new Date(a.ends_at).getTime() > Date.now());
  const hasActiveAuction = activeAuctions.length > 0;
  const topAuction = activeAuctions.reduce((best: any, a: any) => {
    const cur = Number(a.current_bid ?? a.start_price);
    if (!best) return a;
    const bestCur = Number(best.current_bid ?? best.start_price);
    return cur > bestCur ? a : best;
  }, null);
  const livePrice = topAuction ? Number(topAuction.current_bid ?? topAuction.start_price) : Number(item?.price || 0);

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

        {creatorStore && (
          <button
            onClick={() => nav(`/web3/nft/store/${creatorStore.handle}`)}
            className="w-full rounded-2xl overflow-hidden bg-[#0f0f0f] border border-white/10 hover:border-white/30 transition-all text-left group"
          >
            <div
              className="h-20 w-full"
              style={creatorStore.banner_url
                ? { backgroundImage: `url(${creatorStore.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: `linear-gradient(135deg, hsl(280 80% 30%), ${ACCENT})` }}
            />
            <div className="px-3 pb-3 -mt-7 flex items-end gap-3">
              {creatorStore.avatar_url ? (
                <img src={creatorStore.avatar_url} alt="" className="h-14 w-14 rounded-2xl ring-2 ring-black object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-2xl ring-2 ring-black bg-gradient-to-br from-pink-500 to-blue-500" />
              )}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-1">
                  <p className="font-bold truncate">{creatorStore.display_name || creatorStore.handle}</p>
                </div>
                <p className="text-[11px] text-white/50 truncate">@{creatorStore.handle} · Owner store</p>
              </div>
              <span className="text-xs font-bold pb-1 group-hover:translate-x-0.5 transition-transform" style={{ color: ACCENT }}>
                Visit →
              </span>
            </div>
          </button>
        )}


        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">{hasActiveAuction ? "Current bid" : "Price"}</p>
              <p className="text-2xl font-extrabold" style={{ color: ACCENT }}>{formatNftPrice(livePrice, item.currency)}</p>
              {hasActiveAuction && (
                <p className="text-[10px] text-white/40 mt-0.5">Starting price <span className="line-through">{formatNftPrice(item.price, item.currency)}</span> · only the winning bidder can buy</p>
              )}
            </div>
            <div className="text-right">
              <NftStatusBadge sold={totalSold} total={item.quantity_total} hasAuction={hasActiveAuction} className="mb-1" />
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
                      <p className="font-bold" style={{ color: ACCENT }}>{formatNftPrice(l.price, item.currency)}</p>
                      <p className="text-xs text-white/40">×{l.quantity} available {mine && "· You"}</p>
                    </div>
                    {mine ? (
                      <>
                        <button onClick={() => { setEditListing(l); setListPrice(String(l.price)); }} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"><Edit3 className="h-4 w-4" /></button>
                        <button onClick={() => handleCancelListing(l)} disabled={busy} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
                      </>
                    ) : hasActiveAuction ? (
                      <span className="text-[10px] font-bold px-3 py-2 rounded-full bg-white/5 text-white/40">Locked · auction live</span>
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
              {auctions.map((a) => (
                <LiveAuctionPanel
                  key={a.id}
                  auction={a}
                  format={(n: number) => formatNftPrice(n, item.currency)}
                  me={me}
                  onBid={async () => {
                    setBidOpen(a);
                    setBidAmt(String((Number(a.current_bid ?? a.start_price)) + Number(a.min_increment)));
                    setBidMethod("openpay_balance");
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      const { data: cards } = await (supabase as any)
                        .from("virtual_cards").select("card_number, cvc, expiry_month, expiry_year")
                        .eq("user_id", user.id).eq("is_active", true).limit(1);
                      setSavedCards(cards || []);
                      if (cards && cards[0]) {
                        setCard({
                          number: cards[0].card_number,
                          cvc: cards[0].cvc,
                          exp_month: String(cards[0].expiry_month),
                          exp_year: String(cards[0].expiry_year),
                        });
                      }
                    }
                  }}
                  onFinalize={() => handleFinalize(a)}
                  onCancel={() => handleCancelAuction(a)}
                  onRefresh={load}
                />
              ))}
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
                  <p className="text-white/80">×{t.quantity} {t.total > 0 ? `· ${formatNftPrice(t.total, item.currency)}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur p-4 flex gap-2 border-t border-white/10">
        {!isCreator && item.is_active && (
          hasActiveAuction ? (
            <button
              onClick={() => {
                const a = topAuction;
                if (!a) return;
                setBidOpen(a);
                setBidAmt(String((Number(a.current_bid ?? a.start_price)) + Number(a.min_increment)));
                setBidMethod("openpay_balance");
              }}
              className="flex-1 rounded-full py-3 font-bold flex items-center justify-center gap-2"
              style={{ backgroundColor: ACCENT }}
            >
              <Gavel className="h-4 w-4" /> Place bid · {formatNftPrice(livePrice, item.currency)}
            </button>
          ) : (
            <button onClick={openBuy} className="flex-1 rounded-full py-3 font-bold flex items-center justify-center gap-2"
              style={{ backgroundColor: ACCENT }}>
              <ShoppingCart className="h-4 w-4" /> Buy
            </button>
          )
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
            <PayOpt active={method==="pi"} onClick={() => setMethod("pi")} icon={<img src="https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png" className="h-4 w-4 rounded-full" alt="Pi" />} label="Pi Network" />
            <PayOpt active={method==="virtual_card"} onClick={() => setMethod("virtual_card")} icon={<CreditCard className="h-4 w-4" />} label="Virtual Card" />
          </div>

          {method === "virtual_card" && (
            <div
              className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10"
              style={cardHidden ? { WebkitUserSelect: "none", userSelect: "none" } : undefined}
            >
              <div className="flex items-center justify-between">
                {savedCards.length > 0 ? (
                  <p className="text-[11px] text-white/50">
                    Using your saved OpenPay card · ending {cardHidden ? "••••" : String(card.number).slice(-4)}
                  </p>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => setCardHidden((h) => !h)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-white/70 hover:text-white px-2 py-1 rounded-full bg-white/5 border border-white/10"
                  aria-label={cardHidden ? "Show card details" : "Hide card details"}
                >
                  {cardHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {cardHidden ? "Show" : "Hide"}
                </button>
              </div>
              {cardHidden ? (
                <>
                  <MaskedField label="Card number" value={card.number ? "•••• •••• •••• " + String(card.number).slice(-4) : "•••• •••• •••• ••••"} />
                  <div className="grid grid-cols-3 gap-2">
                    <MaskedField label="MM" value="••" />
                    <MaskedField label="YYYY" value="••••" />
                    <MaskedField label="CVC" value="•••" />
                  </div>
                  <p className="text-[10px] text-white/40 flex items-center gap-1">
                    <EyeOff className="h-3 w-3" /> Hidden to protect your card from screenshots & screen recordings.
                  </p>
                </>
              ) : (
                <>
                  <Field label="Card number" value={card.number} onChange={(v: any) => setCard((c) => ({ ...c, number: v }))} />
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="MM" value={card.exp_month} onChange={(v: any) => setCard((c) => ({ ...c, exp_month: v }))} type="number" />
                    <Field label="YYYY" value={card.exp_year} onChange={(v: any) => setCard((c) => ({ ...c, exp_year: v }))} type="number" />
                    <Field label="CVC" value={card.cvc} onChange={(v: any) => setCard((c) => ({ ...c, cvc: v }))} />
                  </div>
                </>
              )}
              {savedCards.length === 0 && (
                <p className="text-[11px] text-amber-400">No saved card. Create one in OpenPay Card first.</p>
              )}
            </div>
          )}
          {method === "pi" && (
            <p className="text-[11px] text-white/60 p-2 rounded-lg bg-white/5 border border-white/10">
              You'll be charged {(Number(item.price)*qty).toFixed(2)} Pi via the Pi Browser payment flow.
            </p>
          )}

          <div className="flex justify-between text-sm pt-2 border-t border-white/10">
            <span className="text-white/60">Total</span>
            <span className="font-bold">{method === "pi" ? `${(Number(item.price)*qty).toFixed(2)} Pi` : formatNftPrice(Number(item.price)*qty, item.currency)}</span>
          </div>
          <button onClick={handleBuy} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Processing…" : "Confirm Purchase"}
          </button>
        </Modal>
      )}

      {receipt && (
        <Modal onClose={() => setReceipt(null)} title="Payment Receipt">
          <div className="text-center py-2">
            <div className="h-12 w-12 mx-auto rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: ACCENT }}>
              <ShoppingCart className="h-6 w-6" />
            </div>
            <p className="font-extrabold text-lg">{receipt.item_name}</p>
            <p className="text-xs text-white/50">x{receipt.qty}</p>
          </div>
          <div className="space-y-1.5 text-sm bg-white/5 rounded-xl p-3 border border-white/10">
            <Row k="Amount" v={receipt.method === "pi" ? `${receipt.total.toFixed(2)} Pi` : formatNftPrice(receipt.total, item.currency)} />
            <Row k="Method" v={receipt.method.replace("_"," ")} />
            {receipt.pi_txid && <Row k="Pi TxID" v={`${String(receipt.pi_txid).slice(0,10)}…`} />}
            {receipt.card_last4 && <Row k="Card" v={`•••• ${receipt.card_last4}`} />}
            <Row k="Reference" v={String(receipt.ref).slice(0,8)} />
            <Row k="Date" v={new Date(receipt.ts).toLocaleString()} />
            <Row k="Status" v="Completed" />
          </div>
          <button onClick={() => setReceipt(null)} className="w-full rounded-full py-3 font-bold" style={{ backgroundColor: ACCENT }}>
            Done
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
          <p className="text-sm text-white/70">Current bid: <span className="font-bold text-white">{formatNftPrice(Number(bidOpen.current_bid ?? bidOpen.start_price), item.currency)}</span></p>
          <p className="text-xs text-white/50">Minimum next bid: {formatNftPrice(Number(bidOpen.current_bid ?? bidOpen.start_price) + (bidOpen.current_bid ? Number(bidOpen.min_increment) : 0), item.currency)}</p>
          <Field label="Your bid" value={bidAmt} onChange={setBidAmt} type="number" />

          <div className="space-y-2">
            <p className="text-xs text-white/60 font-semibold">Payment</p>
            <PayOpt active={bidMethod==="openpay_balance"} onClick={() => setBidMethod("openpay_balance")} icon={<Wallet className="h-4 w-4" />} label="OpenPay Balance" />
            <PayOpt active={bidMethod==="pi"} onClick={() => setBidMethod("pi")} icon={<img src="https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png" className="h-4 w-4 rounded-full" alt="Pi" />} label="Pi Network" />
            <PayOpt active={bidMethod==="virtual_card"} onClick={() => setBidMethod("virtual_card")} icon={<CreditCard className="h-4 w-4" />} label="Virtual Card" />
          </div>

          {bidMethod === "virtual_card" && (
            <div
              className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10"
              style={cardHidden ? { WebkitUserSelect: "none", userSelect: "none" } : undefined}
            >
              <div className="flex items-center justify-between">
                {savedCards.length > 0 ? (
                  <p className="text-[11px] text-white/50">
                    Using your saved OpenPay card · ending {cardHidden ? "••••" : String(card.number).slice(-4)}
                  </p>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => setCardHidden((h) => !h)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-white/70 hover:text-white px-2 py-1 rounded-full bg-white/5 border border-white/10"
                  aria-label={cardHidden ? "Show card details" : "Hide card details"}
                >
                  {cardHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {cardHidden ? "Show" : "Hide"}
                </button>
              </div>
              {cardHidden ? (
                <>
                  <MaskedField label="Card number" value={card.number ? "•••• •••• •••• " + String(card.number).slice(-4) : "•••• •••• •••• ••••"} />
                  <div className="grid grid-cols-3 gap-2">
                    <MaskedField label="MM" value="••" />
                    <MaskedField label="YYYY" value="••••" />
                    <MaskedField label="CVC" value="•••" />
                  </div>
                </>
              ) : (
                <>
                  <Field label="Card number" value={card.number} onChange={(v: any) => setCard((c) => ({ ...c, number: v }))} />
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="MM" value={card.exp_month} onChange={(v: any) => setCard((c) => ({ ...c, exp_month: v }))} type="number" />
                    <Field label="YYYY" value={card.exp_year} onChange={(v: any) => setCard((c) => ({ ...c, exp_year: v }))} type="number" />
                    <Field label="CVC" value={card.cvc} onChange={(v: any) => setCard((c) => ({ ...c, cvc: v }))} />
                  </div>
                </>
              )}
              {savedCards.length === 0 && (
                <p className="text-[11px] text-amber-400">No saved card. Create one in OpenPay Card first.</p>
              )}
            </div>
          )}
          {bidMethod === "pi" && (
            <p className="text-[11px] text-white/60 p-2 rounded-lg bg-white/5 border border-white/10">
              You'll be charged {Number(bidAmt || 0).toFixed(2)} Pi via the Pi Browser. Refunded automatically if outbid.
            </p>
          )}

          <p className="text-xs text-white/50">Funds are escrowed. If outbid, you'll be refunded to your OpenPay balance.</p>
          <button onClick={handlePlaceBid} disabled={busy} className="w-full rounded-full py-3 font-bold disabled:opacity-50" style={{ backgroundColor: ACCENT }}>
            {busy ? "Bidding…" : "Place Bid"}
          </button>
        </Modal>
      )}

      <NftBurst show={!!burst} kind={burst?.kind} message={burst?.msg} onDone={() => setBurst(null)} />
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

const MaskedField = ({ label, value }: { label: string; value: string }) => (
  <label className="block">
    <span className="text-[11px] text-white/60">{label}</span>
    <div className="mt-1 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-white/10 text-sm tracking-widest text-white/80 select-none">
      {value}
    </div>
  </label>
);

const Row = ({ k, v }: { k: string; v: any }) => (
  <div className="flex justify-between"><span className="text-white/50">{k}</span><span className="font-semibold">{v}</span></div>
);

export default NftDetailPage;

