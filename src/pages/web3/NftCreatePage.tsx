import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Gavel } from "lucide-react";
import { celebrate, playNftSound } from "@/lib/nftFx";
import NftBurst from "@/components/web3/NftBurst";
import { NFT_CATEGORIES } from "@/lib/nftCategories";

const ACCENT = "hsl(217 91% 60%)";

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

  const upd = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => upd("image_url", reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.name || !form.code) {
      toast({ title: "Name and code required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");

      // Ensure unique item code by appending a short suffix if taken
      const baseCode = form.code;
      let itemCode = baseCode;
      const { data: existingItem } = await (supabase as any)
        .from("nft_items").select("id").eq("code", itemCode).maybeSingle();
      if (existingItem) {
        itemCode = `${baseCode}-${Date.now().toString(36).slice(-5)}`;
      }

      // Create or reuse collection by code prefix
      const colCode = `${baseCode}-col`;

      const { data: existingCol } = await (supabase as any)
        .from("nft_collections").select("id").eq("code", colCode).maybeSingle();
      let collectionId = existingCol?.id as string | undefined;
      if (!collectionId) {
        const { data: newCol, error: colErr } = await (supabase as any)
          .from("nft_collections")
          .insert({
            creator_id: user.id,
            name: form.name,
            code: colCode,
            description: form.description,
            cover_url: form.image_url,
            royalty_pct: form.royalty_pct,
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
      });
      if (error) throw error;
      // Attach category to the newly minted item (column added via migration)
      try {
        await (supabase as any).from("nft_items").update({ category: form.category }).eq("id", data);
      } catch {}

      // If sale_type is auction, immediately start an auction for the full supply
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
      setTimeout(() => nav(`/web3/nft/${data}`), 1800);
    } catch (e: any) {
      playNftSound("error");
      toast({ title: "Mint failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold">Mint NFT</h1>
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
          onClick={submit}
          disabled={loading}
          className="w-full rounded-full py-3 font-bold disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {loading ? "Minting…" : "Mint NFT"}
        </button>
      </div>
      <NftBurst show={!!minted} kind="mint" message={minted ? `${minted.name} minted!` : ""} />
    </div>
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

export default NftCreatePage;
