import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload } from "lucide-react";

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
    properties: "",
  });
  const [loading, setLoading] = useState(false);

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
        p_code: form.code,
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
      toast({ title: "NFT minted!" });
      nav(`/web3/nft/${data}`);
    } catch (e: any) {
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

        <Field label="Royalty %" value={String(form.royalty_pct)} onChange={(v) => upd("royalty_pct", Number(v) || 0)} type="number" />
        <Field label="Properties (JSON or notes)" value={form.properties} onChange={(v) => upd("properties", v)} multiline />

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-full py-3 font-bold disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {loading ? "Minting…" : "Mint NFT"}
        </button>
      </div>
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
