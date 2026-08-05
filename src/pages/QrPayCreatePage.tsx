import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Copy, Share2, ImagePlus, Loader2, QrCode,
  Package, Download, HeartHandshake, Coffee, ShieldCheck, Sparkles, X, Settings2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QrPayHeader from "@/components/qrpay/QrPayHeader";
import CurrencyPicker from "@/components/CurrencyPicker";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import QrPayIntegrations from "@/components/qr-pay/QrPayIntegrations";

interface Item { name: string; description?: string; quantity: number; unit_price: number; image_url?: string }

type PType = "product" | "digital" | "donation" | "tip";
type AfterAction = "receipt" | "download" | "redirect";

const PAYMENT_TYPES: { value: PType; label: string; hint: string; icon: typeof Package }[] = [
  { value: "product", label: "Product", hint: "Goods or services", icon: Package },
  { value: "digital", label: "Digital", hint: "Files & downloads", icon: Download },
  { value: "donation", label: "Donation", hint: "Any amount", icon: HeartHandshake },
  { value: "tip", label: "Tip", hint: "Say thanks", icon: Coffee },
];

async function uploadQrPayImage(file: File): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const toDataUrl = () => new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

  if (!user) {
    const inline = await toDataUrl();
    if (!inline) toast.error("Image upload failed");
    return inline;
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("qr-pay-images").upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    const inline = await toDataUrl();
    if (!inline) {
      toast.error(error.message);
      return null;
    }
    toast.success("Image added inline");
    return inline;
  }

  const { data } = supabase.storage.from("qr-pay-images").getPublicUrl(path);
  return data.publicUrl;
}

const StepBadge = ({ n }: { n: number }) => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paypal-blue/10 text-sm font-bold text-paypal-blue">
    {n}
  </span>
);

export default function QrPayCreatePage() {
  const navigate = useNavigate();
  const { currencies, currency } = useCurrency();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cur, setCur] = useState<string>(currency.code);
  const [items, setItems] = useState<Item[]>([{ name: "", quantity: 1, unit_price: 0 }]);
  const [allow, setAllow] = useState({ pi: true, wallet: true, card: true, guest: true });
  const [reusable, setReusable] = useState(false);
  const [collectDelivery, setCollectDelivery] = useState(false);
  const [deliveryFields, setDeliveryFields] = useState<string[]>(["name", "email", "address"]);
  const [expiresMin, setExpiresMin] = useState<string>("");
  const [paymentType, setPaymentType] = useState<PType>("product");
  const [afterAction, setAfterAction] = useState<AfterAction>("receipt");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [suggested, setSuggested] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [coverImage, setCoverImage] = useState<string>("");
  const [uploading, setUploading] = useState<number | "cover" | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ token: string; total: number } | null>(null);

  const isFlexible = paymentType === "donation" || paymentType === "tip";
  const total = isFlexible
    ? Number(suggested || 0)
    : items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  const previewTitle = title || (paymentType === "donation" ? "Support our project" : paymentType === "tip" ? "Leave a tip" : "Your checkout title");
  const filledItems = items.filter(it => it.name.trim());

  const update = (i: number, k: keyof Item, v: any) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const handleItemImage = async (i: number, file: File) => {
    setUploading(i);
    const url = await uploadQrPayImage(file);
    setUploading(null);
    if (url) update(i, "image_url", url);
  };
  const handleCoverImage = async (file: File) => {
    setUploading("cover");
    const url = await uploadQrPayImage(file);
    setUploading(null);
    if (url) setCoverImage(url);
  };

  const submit = async () => {
    let cleaned: Item[] = [];
    if (!isFlexible) {
      cleaned = items
        .filter(it => it.name.trim() && Number(it.unit_price) >= 0 && Number(it.quantity) > 0)
        .map(it => ({
          name: it.name.trim(),
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          image_url: it.image_url,
        }));
      if (cleaned.length === 0) { toast.error("Add at least one item"); return; }
      if (total <= 0) { toast.error("Total must be greater than 0"); return; }
    }
    if (afterAction === "download" && !downloadUrl.trim()) { toast.error("Add a download URL"); return; }
    if (afterAction === "redirect" && !redirectUrl.trim()) { toast.error("Add a redirect URL"); return; }

    setLoading(true);
    const { data, error } = await (supabase as any).rpc("qr_pay_create", {
      p_title: title || (isFlexible ? (paymentType === "tip" ? "Tip" : "Donation") : "QR Payment"),
      p_description: description || null,
      p_currency: cur,
      p_items: cleaned,
      p_allow_pi: allow.pi,
      p_allow_wallet: allow.wallet,
      p_allow_virtual_card: allow.card,
      p_allow_guest: allow.guest,
      p_reusable: isFlexible ? true : reusable,
      p_expires_minutes: expiresMin ? Number(expiresMin) : null,
      p_payment_type: paymentType,
      p_after_payment_action: afterAction,
      p_download_url: downloadUrl || null,
      p_redirect_url: redirectUrl || null,
      p_suggested_amount: suggested ? Number(suggested) : null,
      p_min_amount: minAmount ? Number(minAmount) : null,
      p_allow_custom_amount: isFlexible,
      p_cover_image_url: coverImage || null,
      p_collect_delivery: collectDelivery,
      p_delivery_fields: collectDelivery ? deliveryFields : ["name", "email", "address"],
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setCreated({ token: data.token, total: Number(data.total) });
    toast.success("QR payment created");
  };

  if (created) {
    const url = `${window.location.origin}/qr-pay/${created.token}`;
    return (
      <div className="min-h-screen bg-muted/30">
        <QrPayHeader
          eyebrow="OpenPay · QR Pay"
          title="Share QR Payment"
          subtitle="Your payment link is ready — share it anywhere."
          icon={Share2}
          backTo="/qr-pay"
          backLabel="Back to QR Pay"
        />

        <div className="p-4 max-w-md mx-auto space-y-4 -mt-4 qrp-pop">
          <div className="qrp-card p-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl shadow-inner ring-1 ring-black/5"><QRCodeSVG value={url} size={220} /></div>
            <div className="mt-4 text-center">
              <div className="text-3xl font-bold text-foreground tracking-tight">{cur} {created.total.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground mt-1">Customers scan with OpenPay scanner or any QR app</p>
            </div>
            <div className="w-full mt-4 bg-muted rounded-xl p-2.5 text-xs break-all text-center font-mono">{url}</div>
            <div className="flex gap-2 w-full mt-3">
              <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="h-4 w-4 mr-1" />Copy</Button>
              <Button className="flex-1 qrp-primary-btn" onClick={async () => {
                try { if ((navigator as any).share) await (navigator as any).share({ title: "Pay with OpenPay", url }); else { navigator.clipboard.writeText(url); toast.success("Link copied"); } } catch { }
              }}><Share2 className="h-4 w-4 mr-1" />Share</Button>
            </div>
            <Button variant="ghost" className="mt-2 w-full rounded-xl" onClick={() => window.open(url, "_blank")}>Open checkout preview</Button>
          </div>
          <QrPayIntegrations url={url} amount={created.total} currency={cur} title={title || "OpenPay Checkout"} />
          <Button variant="outline" className="w-full rounded-xl h-11" onClick={() => navigate("/qr-pay")}>Back to dashboard</Button>
          <Button variant="ghost" className="w-full rounded-xl" onClick={() => { setCreated(null); setItems([{ name: "", quantity: 1, unit_price: 0 }]); setTitle(""); setDescription(""); setCoverImage(""); }}>Create another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      <QrPayHeader
        eyebrow="OpenPay · QR Pay"
        title="New QR Payment"
        subtitle="Configure your checkout experience, then generate a sharable QR code."
        icon={QrCode}
        backTo="/qr-pay"
        backLabel="Back to QR Pay"
      />


      <div className="mx-auto -mt-6 grid w-full max-w-5xl grid-cols-1 gap-6 p-4 lg:grid-cols-12">
        {/* ── Left: setup form ───────────────────────────── */}
        <div className="space-y-5 lg:col-span-7">

          {/* Step 1 — details */}
          <div className="qrp-card space-y-5 p-5">
            <div className="flex items-center gap-3 border-b border-border/60 pb-3">
              <StepBadge n={1} />
              <div>
                <h2 className="font-semibold text-foreground">Payment details</h2>
                <p className="text-xs text-muted-foreground">What are you charging for?</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment type</Label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {PAYMENT_TYPES.map(({ value, label, hint, icon: Icon }) => {
                  const active = paymentType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentType(value)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition-all active:scale-95 ${
                        active
                          ? "border-paypal-blue bg-paypal-blue/5 shadow-sm"
                          : "border-border bg-card hover:border-paypal-blue/40"
                      }`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${active ? "bg-paypal-blue text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className={`text-xs font-bold ${active ? "text-paypal-blue" : "text-foreground"}`}>{label}</span>
                      <span className="text-[10px] leading-tight text-muted-foreground">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display title</Label>
                <Input
                  className="qrp-input h-12 rounded-xl"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={paymentType === "donation" ? "Support our project" : paymentType === "tip" ? "Leave a tip" : "e.g. Morning Coffee Combo"}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currency</Label>
                <CurrencyPicker value={cur} onChange={setCur} className="qrp-input h-12" />

              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description (optional)</Label>
              <Textarea className="qrp-input rounded-xl" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Shown to your customer at checkout" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover image</Label>
              {coverImage ? (
                <div className="relative overflow-hidden rounded-2xl border border-border">
                  <img src={coverImage} alt="Checkout cover" className="h-36 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImage("")}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="group flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-border p-7 text-center transition-all hover:border-paypal-blue hover:bg-paypal-blue/5">
                  {uploading === "cover"
                    ? <Loader2 className="mb-2 h-7 w-7 animate-spin text-paypal-blue" />
                    : <ImagePlus className="mb-2 h-7 w-7 text-muted-foreground transition-colors group-hover:text-paypal-blue" />}
                  <span className="text-sm font-medium text-foreground">Click to upload cover photo</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">Makes your checkout look 2× more trusted</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleCoverImage(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>

          {/* Step 2 — amount / items */}
          <div className="qrp-card space-y-4 p-5">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <StepBadge n={2} />
                <div>
                  <h2 className="font-semibold text-foreground">{isFlexible ? "Amount settings" : "Line items"}</h2>
                  <p className="text-xs text-muted-foreground">{isFlexible ? "Customers pick their own amount" : "What the customer is paying for"}</p>
                </div>
              </div>
              {!isFlexible && (
                <button
                  type="button"
                  onClick={() => setItems([...items, { name: "", quantity: 1, unit_price: 0 }])}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-paypal-blue/10 px-3 py-1.5 text-xs font-bold uppercase tracking-tight text-paypal-blue transition-colors hover:bg-paypal-blue/20"
                >
                  <Plus className="h-3.5 w-3.5" />Add item
                </button>
              )}
            </div>

            {isFlexible ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Suggested ({cur})</Label>
                    <Input className="qrp-input h-12 rounded-xl" type="number" step="0.01" min={0} value={suggested} onChange={e => setSuggested(e.target.value)} placeholder="5.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Minimum ({cur})</Label>
                    <Input className="qrp-input h-12 rounded-xl" type="number" step="0.01" min={0} value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 5, 10, 25, 50].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSuggested(String(v))}
                      className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                        Number(suggested) === v ? "border-paypal-blue bg-paypal-blue text-primary-foreground" : "border-border bg-card text-foreground hover:border-paypal-blue/50"
                      }`}
                    >
                      {cur} {v}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">The suggested amount is pre-filled at checkout — customers can change it.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, i) => (
                  <div key={i} className="group relative rounded-2xl border border-border bg-muted/40 p-4">
                    <div className="flex gap-3">
                      <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-card transition-colors hover:border-paypal-blue">
                        {it.image_url
                          ? <img src={it.image_url} alt={it.name || "Item"} className="h-full w-full object-cover" />
                          : uploading === i
                            ? <Loader2 className="h-5 w-5 animate-spin text-paypal-blue" />
                            : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleItemImage(i, e.target.files[0])} />
                      </label>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Input
                          className="h-8 border-0 bg-transparent px-0 font-semibold text-foreground shadow-none focus-visible:ring-0"
                          placeholder="Item name"
                          value={it.name}
                          onChange={e => update(i, "name", e.target.value)}
                        />
                        <Input
                          className="h-7 border-0 bg-transparent px-0 text-xs text-muted-foreground shadow-none focus-visible:ring-0"
                          placeholder="Optional description"
                          value={it.description || ""}
                          onChange={e => update(i, "description", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Qty</span>
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" onClick={() => update(i, "quantity", Math.max(1, Number(it.quantity) - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground active:scale-90">−</button>
                          <span className="w-6 text-center text-sm font-bold">{it.quantity}</span>
                          <button type="button" onClick={() => update(i, "quantity", Number(it.quantity) + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground active:scale-90">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Unit price ({cur})</span>
                        <Input
                          type="number" step="0.01" min={0}
                          className="qrp-input mt-1 h-9 w-28 rounded-lg text-right font-bold"
                          value={it.unit_price}
                          onChange={e => update(i, "unit_price", Number(e.target.value))}
                        />
                      </div>
                      <div className="ml-auto text-right">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Line</span>
                        <div className="text-sm font-bold text-paypal-blue">{cur} {(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}</div>
                      </div>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3 — options */}
          <div className="qrp-card p-5">
            <div className="flex items-center gap-3 border-b border-border/60 pb-3">
              <StepBadge n={3} />
              <div>
                <h2 className="font-semibold text-foreground">Checkout options</h2>
                <p className="text-xs text-muted-foreground">Great defaults are already set — tweak if you need to</p>
              </div>
            </div>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="methods" className="border-border/60">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-paypal-blue" />Payment methods</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {[
                    { k: "pi", l: "Pi Network", d: "Pay from Pi balance" },
                    { k: "wallet", l: "OpenPay Wallet", d: "Instant internal transfer" },
                    { k: "card", l: "Virtual Card", d: "Card checkout" },
                    { k: "guest", l: "Allow guest checkout", d: "No sign-in needed for Pi" },
                  ].map(m => (
                    <div key={m.k} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.l}</p>
                        <p className="text-xs text-muted-foreground">{m.d}</p>
                      </div>
                      <Switch checked={(allow as any)[m.k]} onCheckedChange={v => setAllow({ ...allow, [m.k]: v })} />
                    </div>
                  ))}
                  {!isFlexible && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Reusable link</p>
                        <p className="text-xs text-muted-foreground">Accept multiple payments</p>
                      </div>
                      <Switch checked={reusable} onCheckedChange={setReusable} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expires in (minutes)</Label>
                    <Input className="qrp-input h-11 rounded-xl" type="number" min={1} value={expiresMin} onChange={e => setExpiresMin(e.target.value)} placeholder="Never" />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="after" className="border-border/60">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-paypal-blue" />After payment</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <Select value={afterAction} onValueChange={v => setAfterAction(v as AfterAction)}>
                    <SelectTrigger className="qrp-input h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">Show receipt only</SelectItem>
                      <SelectItem value="download">Show download link</SelectItem>
                      <SelectItem value="redirect">Redirect to URL</SelectItem>
                    </SelectContent>
                  </Select>
                  {afterAction === "download" && (
                    <Input className="qrp-input h-11 rounded-xl" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} placeholder="https://…/file.pdf" />
                  )}
                  {afterAction === "redirect" && (
                    <Input className="qrp-input h-11 rounded-xl" value={redirectUrl} onChange={e => setRedirectUrl(e.target.value)} placeholder="https://your-site.com/thanks" />
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="delivery" className="border-b-0">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-paypal-blue" />Customer details</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Collect customer details</p>
                      <p className="text-xs text-muted-foreground">For delivery, contact, or fulfilment</p>
                    </div>
                    <Switch checked={collectDelivery} onCheckedChange={setCollectDelivery} />
                  </div>
                  {collectDelivery && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Required fields at checkout:</p>
                      {[
                        { k: "name", l: "Full name" },
                        { k: "email", l: "Email" },
                        { k: "phone", l: "Phone" },
                        { k: "address", l: "Shipping address" },
                      ].map(f => (
                        <label key={f.k} className="flex items-center justify-between rounded-xl bg-muted/50 p-3 text-sm">
                          <span>{f.l}</span>
                          <Switch
                            checked={deliveryFields.includes(f.k)}
                            onCheckedChange={(v) =>
                              setDeliveryFields(prev => v ? Array.from(new Set([...prev, f.k])) : prev.filter(x => x !== f.k))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* ── Right: live preview + generate ─────────────── */}
        <div className="lg:col-span-5">
          <div className="space-y-5 lg:sticky lg:top-6">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Customer preview</p>

            {/* live checkout card */}
            <div className="mx-auto max-w-[340px] overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl">
              {coverImage ? (
                <img src={coverImage} alt="Checkout cover preview" className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-muted">
                  <ImagePlus className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}

              <div className="space-y-4 px-6 py-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paypal-blue">
                    <QrCode className="h-3 w-3 text-primary-foreground" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">OpenPay Checkout</span>
                </div>

                <div>
                  <h3 className="truncate text-lg font-bold text-foreground">{previewTitle}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{description || "Secure payment via QR"}</p>
                </div>

                {!isFlexible && (
                  <div className="space-y-2 border-t border-border/60 pt-3">
                    {filledItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Add items to see them here…</p>
                    ) : filledItems.slice(0, 4).map((it, i) => (
                      <div key={i} className="flex justify-between gap-3 text-xs">
                        <span className="truncate text-muted-foreground">{it.name} × {it.quantity}</span>
                        <span className="shrink-0 font-medium text-foreground">{(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)} {cur}</span>
                      </div>
                    ))}
                    {filledItems.length > 4 && <p className="text-xs text-muted-foreground">+{filledItems.length - 4} more</p>}
                  </div>
                )}

                <div className="flex items-end justify-between border-t border-border/60 pt-3">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-paypal-dark">{total.toFixed(2)}</div>
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">{cur}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {allow.pi && <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">Pi</span>}
                  {allow.wallet && <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">Wallet</span>}
                  {allow.card && <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">Card</span>}
                </div>

                <div className="pointer-events-none w-full rounded-2xl bg-paypal-blue py-3 text-center text-sm font-bold text-primary-foreground shadow-lg">
                  Pay {total.toFixed(2)} {cur}
                </div>
              </div>
            </div>

            {/* grand total + generate */}
            <div className="space-y-4 rounded-3xl bg-paypal-dark p-6 text-primary-foreground shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-primary-foreground/70">Grand total</p>
                  <h4 className="truncate text-2xl font-bold">{total.toFixed(2)} <span className="text-lg">{cur}</span></h4>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/10">
                  <QrCode className="h-6 w-6" />
                </span>
              </div>
              <Button
                className="h-14 w-full rounded-2xl bg-background text-lg font-bold text-paypal-dark shadow-lg hover:bg-background/90"
                disabled={loading || (!isFlexible && total <= 0)}
                onClick={submit}
              >
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating…</> : "Generate & Share QR"}
              </Button>
              <p className="text-center text-[11px] text-primary-foreground/70">Double-check your settings before generating</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
