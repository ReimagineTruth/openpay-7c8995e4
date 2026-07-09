import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Gavel, Wallet, CreditCard } from "lucide-react";
import { celebrate, playNftSound } from "@/lib/nftFx";
import NftBurst from "@/components/web3/NftBurst";
import { NFT_CATEGORIES } from "@/lib/nftCategories";
import NftPageShell from "@/components/web3/NftPageShell";

const ACCENT = "hsl(217 91% 60%)";
const PI_ICON = "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png";

type PayMethod = "openpay_balance" | "pi" | "virtual_card";

const NftCreatePage = () => {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    image_url: "",
    media_type: "image" as "image" | "gif" | "video" | "audio",
    quantity: 1,
    price: 0,
    currency: "OUSD",
    royalty_pct: 5,
    category: "general",
    properties: "",
    sale_type: "fixed" as "fixed" | "auction",
    auction_start_price: 0,
    auction_min_increment: 1,
    auction_duration_hours: 24,
  });
  const [loading, setLoading] = useState(false);
  const [minted, setMinted] = useState<{ id: string; name: string } | null>(null);

  // Payment state
  const [mintFee, setMintFee] = useState<{ enabled: boolean; flat_amount: number; rate: number; currency: string }>({
    enabled: true, flat_amount: 1, rate: 0, currency: "OUSD",
  });
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PayMethod>("openpay_balance");
  const [card, setCard] = useState({ number: "", cvc: "", exp_month: "", exp_year: "" });
  const [savedCards, setSavedCards] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any).rpc("nft_get_mint_fee");
        if (data) {
          setMintFee({
            enabled: !!data.enabled,
            flat_amount: Number(data.flat_amount || 0),
            rate: Number(data.rate || 0),
            currency: data.currency || "OUSD",
          });
        }
      } catch {}
    })();
  }, []);

  const upd = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => upd("image_url", reader.result as string);
    reader.readAsDataURL(file);
  };

  const computeFee = () => {
    if (!mintFee.enabled) return 0;
    let f = mintFee.flat_amount;
    if (mintFee.rate > 0) {
      const base = Math.max(Number(form.price) * Number(form.quantity), Number(form.quantity));
      f += Math.round((base * mintFee.rate) / 100 * 100) / 100;
    }
    return f;
  };
  const totalFee = computeFee();

  const openPay = async () => {
    if (!form.name || !form.code) {
      toast({ title: "Name and code required", variant: "destructive" });
      return;
    }
    if (!totalFee) {
      // free mint (fee disabled) — skip modal
      return doMint();
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { nav("/auth"); return; }
    // Preload virtual card if exists
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
    setPayOpen(true);
  };

  const doMint = async (extra: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      const baseCode = form.code;
      let itemCode = baseCode;
      const { data: existingItem } = await (supabase as any)
        .from("nft_items").select("id").eq("code", itemCode).maybeSingle();
      if (existingItem) itemCode = `${baseCode}-${Date.now().toString(36).slice(-5)}`;

      const colCode = `${baseCode}-col`;
      const { data: existingCol } = await (supabase as any)
        .from("nft_collections").select("id").eq("code", colCode).maybeSingle();
      let collectionId = existingCol?.id as string | undefined;
      if (!collectionId) {
        const { data: newCol, error: colErr } = await (supabase as any)
          .from("nft_collections")
          .insert({
            creator_id: user.id, name: form.name, code: colCode,
            description: form.description, cover_url: form.image_url, royalty_pct: form.royalty_pct,
          })
          .select("id").single();
        if (colErr) throw colErr;
        collectionId = newCol.id;
      }

      let properties: any = {};
      if (form.properties) {
        try { properties = JSON.parse(form.properties); }
        catch { properties = { notes: form.properties }; }
      }
      properties = { ...properties, category: form.category };

      const { data, error } = await (supabase as any).rpc("nft_mint_item", {
        p_collection_id: collectionId,
        p_name: form.name,
        p_code: itemCode,
        p_description: form.description,
        p_image_url: form.image_url,
        p_media_url: form.image_url,
        p_media_type: form.media_type,
        p_quantity: Number(form.quantity),
        p_price: Number(form.price),
        p_currency: form.currency,
        p_properties: properties,
        p_payment_method: method,
        ...extra,
      });
      if (error) throw error;
      try {
        await (supabase as any).from("nft_items").update({ category: form.category }).eq("id", data);
      } catch {}

      if (form.sale_type === "auction") {
        try {
          const startPrice = Number(form.auction_start_price) > 0
            ? Number(form.auction_start_price)
            : Number(form.price) || 1;
          const { error: aErr } = await (supabase as any).rpc("nft_create_auction", {
            p_item_id: data,
            p_quantity: Number(form.quantity),
            p_start_price: startPrice,
            p_min_increment: Math.max(0.01, Number(form.auction_min_increment) || 1),
            p_duration_hours: Math.max(1, Number(form.auction_duration_hours) || 24),
          });
          if (aErr) throw aErr;
          toast({ title: "🔥 Auction is live!", description: "Bidders can now compete in realtime." });
        } catch (ae: any) {
          toast({ title: "Auction not started", description: ae.message, variant: "destructive" });
        }
      }

      celebrate("mint");
      toast({ title: "NFT minted!" });
      setMinted({ id: data, name: form.name });
      setPayOpen(false);
      setTimeout(() => nav(`/web3/nft/${data}`), 1600);
    } catch (e: any) {
      playNftSound("error");
      toast({ title: "Mint failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (method === "openpay_balance") {
      await doMint();
    } else if (method === "virtual_card") {
      if (!card.number || !card.cvc || !card.exp_month || !card.exp_year) {
        toast({ title: "Card details required", variant: "destructive" }); return;
      }
      await doMint({
        p_card_number: card.number.replace(/\s+/g, ""),
        p_card_cvc: card.cvc,
        p_card_exp_month: Number(card.exp_month),
        p_card_exp_year: Number(card.exp_year),
      });
    } else if (method === "pi") {
      const Pi = (window as any).Pi;
      if (!Pi || typeof Pi.createPayment !== "function") {
        toast({ title: "Pi SDK not available", description: "Open in Pi Browser to pay with Pi.", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
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
            { amount: totalFee, memo: `Mint NFT ${form.name}`.slice(0, 64),
              metadata: { kind: "nft_mint", name: form.name } },
            {
              onReadyForServerApproval: async (paymentId: string) => {
                await supabase.functions.invoke("pi-platform", { body: { action: "approve", paymentId } });
              },
              onReadyForServerCompletion: async (paymentId: string, txid: string) => {
                try {
                  await supabase.functions.invoke("pi-platform", { body: { action: "complete", paymentId, txid } });
                  await doMint({ p_pi_payment_id: paymentId, p_pi_txid: txid });
                  resolve();
                } catch (err: any) { reject(err); }
              },
              onCancel: () => reject(new Error("Pi payment cancelled")),
              onError: (e: any) => reject(new Error(e?.message || "Pi payment failed")),
            },
          );
        });
      } catch (e: any) {
        playNftSound("error");
        toast({ title: "Pi payment failed", description: e.message, variant: "destructive" });
      } finally { setLoading(false); }
    }
  };

  return (
    <NftPageShell className="pb-32" splashTitle="Mint NFT">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold">Mint NFT</h1>
        {mintFee.enabled && totalFee > 0 && (
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${ACCENT}20`, color: ACCENT }}>
            Fee {totalFee} {mintFee.currency}
          </span>
        )}
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <label className="block">
          <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-white/15 bg-[#0f0f0f] flex flex-col items-center justify-center cursor-pointer overflow-hidden">
            {form.image_url ? (
              <img src={form.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <>
                <Upload className="h-7 w-7 text-white/40 mb-2" />
                <span className="text-white/50 text-sm">Upload image / GIF</span>
              </>
            )}
          </div>
          <input type="file" accept="image/*,video/*,audio/*" className="hidden"
            onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
        </label>

        <Field label="Name" value={form.name} onChange={(v) => upd("name", v)} />
        <Field label="Code (unique)" value={form.code} onChange={(v) => upd("code", v.replace(/\s+/g, "-").toLowerCase())} />
        <Field label="Description" value={form.description} onChange={(v) => upd("description", v)} multiline />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" value={String(form.quantity)} onChange={(v) => upd("quantity", Number(v) || 1)} type="number" />
          <Field label="Price" value={String(form.price)} onChange={(v) => upd("price", Number(v) || 0)} type="number" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Media type" value={form.media_type} onChange={(v) => upd("media_type", v)} options={["image","gif","video","audio"]} />
          <Select label="Currency" value={form.currency} onChange={(v) => upd("currency", v)} options={["OUSD","USD","PI"]} />
        </div>

        <div>
          <label className="text-xs text-white/60 font-semibold">Category</label>
          <select
            value={form.category}
            onChange={(e) => upd("category", e.target.value)}
            className="mt-1 w-full rounded-xl bg-[#0f0f0f] border border-white/10 p-3 text-sm outline-none"
          >
            {NFT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>

        <Field label="Royalty %" value={String(form.royalty_pct)} onChange={(v) => upd("royalty_pct", Number(v) || 0)} type="number" />
        <Field label="Properties (JSON or notes)" value={form.properties} onChange={(v) => upd("properties", v)} multiline />

        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-3 space-y-3">
          <p className="text-xs font-bold text-white/70 uppercase tracking-wide flex items-center gap-1">
            <Gavel className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Sale Type
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => upd("sale_type", "fixed")}
              className={`p-3 rounded-xl border text-left transition ${form.sale_type === "fixed" ? "border-blue-500 bg-blue-500/10" : "border-white/10"}`}>
              <p className="font-bold text-sm">💰 Fixed Price</p>
              <p className="text-[11px] text-white/50">Buyers pay the set price</p>
            </button>
            <button type="button" onClick={() => upd("sale_type", "auction")}
              className={`p-3 rounded-xl border text-left transition ${form.sale_type === "auction" ? "border-amber-400 bg-amber-400/10" : "border-white/10"}`}>
              <p className="font-bold text-sm">🔥 Live Auction</p>
              <p className="text-[11px] text-white/50">Realtime bidding war</p>
            </button>
          </div>
          {form.sale_type === "auction" && (
            <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starting bid" value={String(form.auction_start_price)} onChange={(v: any) => upd("auction_start_price", Number(v) || 0)} type="number" />
                <Field label="Min increment" value={String(form.auction_min_increment)} onChange={(v: any) => upd("auction_min_increment", Number(v) || 1)} type="number" />
              </div>
              <Field label="Duration (hours)" value={String(form.auction_duration_hours)} onChange={(v: any) => upd("auction_duration_hours", Number(v) || 24)} type="number" />
              <p className="text-[11px] text-white/50 leading-relaxed">
                ⏱️ Live countdown · 📈 Bid amount goes up in realtime · 🏆 Highest bidder wins when timer ends · 💸 Funds escrowed safely.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={openPay}
          disabled={loading}
          className="w-full rounded-full py-3 font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {loading
            ? "Processing…"
            : mintFee.enabled && totalFee > 0
              ? `Pay ${totalFee} ${mintFee.currency} & Mint`
              : (form.sale_type === "auction" ? "🔥 Mint & Start Auction" : "Mint NFT")}
        </button>
      </div>

      {/* Payment modal */}
      {payOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => !loading && setPayOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-white/10 rounded-t-3xl p-4 pb-6 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold">Mint Payment</h3>
                <button onClick={() => !loading && setPayOpen(false)} className="text-sm text-foreground/60">Close</button>
              </div>

              <div className="rounded-xl bg-white/5 p-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground/60">NFT</span>
                  <span className="font-semibold truncate">{form.name || "Untitled"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground/60">Quantity</span>
                  <span className="font-semibold">{form.quantity}</span>
                </div>
                <div className="flex items-center justify-between text-base pt-1 border-t border-white/10 mt-1">
                  <span className="font-bold">Mint Fee</span>
                  <span className="font-extrabold" style={{ color: ACCENT }}>{totalFee} {mintFee.currency}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-foreground/60 uppercase tracking-wide mb-2">Payment method</p>
                <div className="space-y-2">
                  <PayOpt active={method === "openpay_balance"} onClick={() => setMethod("openpay_balance")}
                    icon={<Wallet className="h-4 w-4" />} label="OpenPay Balance" />
                  <PayOpt active={method === "pi"} onClick={() => setMethod("pi")}
                    icon={<img src={PI_ICON} className="h-4 w-4 rounded-full" alt="Pi" />} label="Pi Network" />
                  <PayOpt active={method === "virtual_card"} onClick={() => setMethod("virtual_card")}
                    icon={<CreditCard className="h-4 w-4" />} label="Virtual Card" />
                </div>
              </div>

              {method === "virtual_card" && (
                <div className="space-y-2">
                  {savedCards.length > 0 && (
                    <p className="text-[11px] text-foreground/60">Using saved card ending •••• {String(savedCards[0].card_number).slice(-4)}</p>
                  )}
                  <input placeholder="Card number" value={card.number}
                    onChange={(e) => setCard({ ...card, number: e.target.value })}
                    className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm outline-none" />
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="MM" value={card.exp_month}
                      onChange={(e) => setCard({ ...card, exp_month: e.target.value })}
                      className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm outline-none" />
                    <input placeholder="YYYY" value={card.exp_year}
                      onChange={(e) => setCard({ ...card, exp_year: e.target.value })}
                      className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm outline-none" />
                    <input placeholder="CVC" value={card.cvc}
                      onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                      className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm outline-none" />
                  </div>
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full rounded-full py-3 font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {loading ? "Processing…" : `Pay ${totalFee} ${mintFee.currency} & Mint`}
              </button>
            </div>
          </div>
        </>
      )}

      <NftBurst show={!!minted} kind="mint" message={minted ? `${minted.name} minted!` : ""} />
    </NftPageShell>
  );
};

const Field = ({ label, value, onChange, multiline, type = "text" }: any) => (
  <div>
    <label className="text-xs text-white/60 font-semibold">{label}</label>
    {multiline ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-[#0f0f0f] border border-white/10 p-3 text-sm outline-none focus:border-white/30" rows={3} />
    ) : (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-[#0f0f0f] border border-white/10 p-3 text-sm outline-none focus:border-white/30" />
    )}
  </div>
);

const Select = ({ label, value, onChange, options }: any) => (
  <div>
    <label className="text-xs text-white/60 font-semibold">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-xl bg-[#0f0f0f] border border-white/10 p-3 text-sm outline-none">
      {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const PayOpt = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-sm font-semibold transition ${
      active ? "border-transparent" : "border-white/10 hover:border-white/20"
    }`}
    style={active ? { background: `${ACCENT}20`, color: ACCENT } : {}}
  >
    {icon}
    {label}
  </button>
);

export default NftCreatePage;
