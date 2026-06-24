import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, User, Image as ImageIcon, Globe, Twitter, Instagram, MessageCircle, Tag, Send, Facebook, Youtube } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { NFT_CATEGORIES } from "@/lib/nftCategories";

const ACCENT = "hsl(217 91% 60%)";

const NftStoreSettingsPage = () => {
  const nav = useNavigate();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    handle: "", display_name: "", bio: "",
    avatar_url: "", banner_url: "",
    website_url: "", twitter_url: "", instagram_url: "", discord_url: "", telegram_url: "",
    email_public: "", feature_nfts: true,
    category: "general",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { nav("/auth"); return; }
      setMe(user);
      const { data } = await (supabase as any)
        .from("nft_store_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setForm({
          handle: data.handle || "",
          display_name: data.display_name || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
          banner_url: data.banner_url || "",
          website_url: data.website_url || "",
          twitter_url: data.twitter_url || "",
          instagram_url: data.instagram_url || "",
          discord_url: data.discord_url || "",
          telegram_url: data.telegram_url || "",
          email_public: data.email_public || "",
          feature_nfts: data.feature_nfts ?? true,
          category: data.category || "general",
        });
      } else {
        const { data: base } = await (supabase as any)
          .from("profiles").select("full_name,username,avatar_url").eq("id", user.id).maybeSingle();
        setForm((f) => ({
          ...f,
          handle: base?.username || "",
          display_name: base?.full_name || "",
          avatar_url: base?.avatar_url || "",
        }));
      }
      setLoading(false);
    })();
  }, []);

  const handleImage = async (file: File, field: "avatar_url" | "banner_url") => {
    if (!me) return;
    const ext = file.name.split(".").pop();
    const path = `${me.id}/${field}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setForm((f) => ({ ...f, [field]: data.publicUrl }));
  };

  const onSave = async () => {
    if (!me) return;
    if (!form.handle || form.handle.length < 3) {
      toast({ title: "Handle required", description: "Min 3 characters", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload = { ...form, user_id: me.id, handle: form.handle.toLowerCase().replace(/[^a-z0-9_]/g, "") };
    const { error } = await (supabase as any)
      .from("nft_store_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Store profile saved" });
    nav(`/web3/nft/store/${payload.handle}`);
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold flex-1">Edit Store Profile</h1>
        <button onClick={onSave} disabled={saving}
          className="h-9 px-4 rounded-full font-bold text-sm flex items-center gap-1"
          style={{ backgroundColor: ACCENT }}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </button>
      </header>

      {/* Banner */}
      <div className="relative">
        <label className="block cursor-pointer">
          <div className="h-44 w-full overflow-hidden"
            style={form.banner_url
              ? { backgroundImage: `url(${form.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(135deg, hsl(280 80% 30%), hsl(217 91% 40%))` }}>
            <div className="h-full w-full bg-black/30 flex items-center justify-center text-xs font-bold">
              <ImageIcon className="h-4 w-4 mr-1" /> Change banner
            </div>
          </div>
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0], "banner_url")} />
        </label>
      </div>

      <div className="px-4 -mt-12 relative">
        <label className="block cursor-pointer w-fit">
          <div className="h-24 w-24 rounded-full ring-4 ring-black overflow-hidden bg-gradient-to-br from-pink-500 to-blue-500 relative">
            {form.avatar_url && <img src={form.avatar_url} className="h-full w-full object-cover" alt="" />}
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-[10px] font-bold">
              Change
            </div>
          </div>
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0], "avatar_url")} />
        </label>
      </div>

      <div className="p-4 space-y-4">
        <Field label="Handle (username)" hint="Lowercase letters, numbers, underscore. This is your public URL: /web3/nft/store/[handle]">
          <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })}
            placeholder="wainfoundation" className="input" />
        </Field>
        <Field label="Display Name">
          <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="Your store name" className="input" />
        </Field>
        <Field label="Bio">
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Tell collectors about your store…" rows={3} className="input resize-none" />
        </Field>
        <Field label="Category" icon={<Tag className="h-4 w-4" />} hint="Helps collectors discover your store on the marketplace.">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
            {NFT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </Field>

        <p className="text-[11px] uppercase text-white/40 font-bold pt-2">Links</p>
        <Field label="Website" icon={<Globe className="h-4 w-4" />}>
          <input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            placeholder="https://…" className="input" />
        </Field>
        <Field label="Twitter / X" icon={<Twitter className="h-4 w-4" />}>
          <input value={form.twitter_url} onChange={(e) => setForm({ ...form, twitter_url: e.target.value })}
            placeholder="https://x.com/…" className="input" />
        </Field>
        <Field label="Instagram" icon={<Instagram className="h-4 w-4" />}>
          <input value={form.instagram_url} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
            placeholder="https://instagram.com/…" className="input" />
        </Field>
        <Field label="Discord" icon={<MessageCircle className="h-4 w-4" />}>
          <input value={form.discord_url} onChange={(e) => setForm({ ...form, discord_url: e.target.value })}
            placeholder="https://discord.gg/…" className="input" />
        </Field>
        <Field label="Telegram" icon={<Send className="h-4 w-4" />} hint="Your Telegram channel, group, or @username link.">
          <input value={form.telegram_url} onChange={(e) => setForm({ ...form, telegram_url: e.target.value })}
            placeholder="https://t.me/…" className="input" />
        </Field>
        <Field label="Public email" icon={<User className="h-4 w-4" />}>
          <input value={form.email_public} onChange={(e) => setForm({ ...form, email_public: e.target.value })}
            placeholder="contact@…" className="input" />
        </Field>

        <label className="flex items-center justify-between rounded-xl bg-[#0f0f0f] border border-white/10 p-3">
          <div>
            <p className="font-bold text-sm">Feature my NFTs</p>
            <p className="text-[11px] text-white/50">Allow OpenPay to showcase your store in marketing.</p>
          </div>
          <input type="checkbox" checked={form.feature_nfts}
            onChange={(e) => setForm({ ...form, feature_nfts: e.target.checked })}
            className="h-5 w-5 accent-blue-500" />
        </label>
      </div>

      <style>{`.input{width:100%;background:#0f0f0f;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 12px;color:#fff;font-size:14px;outline:none}.input:focus{border-color:${ACCENT}}`}</style>
    </div>
  );
};

const Field = ({ label, hint, icon, children }: any) => (
  <div>
    <label className="text-xs font-bold text-white/70 flex items-center gap-1.5 mb-1.5">{icon}{label}</label>
    {children}
    {hint && <p className="text-[10px] text-white/40 mt-1">{hint}</p>}
  </div>
);

export default NftStoreSettingsPage;
