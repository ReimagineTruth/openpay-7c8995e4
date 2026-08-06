import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Copy, Share2, ImagePlus, Loader2, QrCode,
  Package, Download, HeartHandshake, Coffee, ShieldCheck, Sparkles, X, Settings2,
  Smartphone, Monitor, HelpCircle, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QrPayHeader from "@/components/qrpay/QrPayHeader";
import QrPaySteps from "@/components/qrpay/QrPaySteps";
import CurrencyPicker from "@/components/CurrencyPicker";
import QrPayShareHelpDialog from "@/components/qrpay/QrPayShareHelpDialog";


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
import BrandLogo from "@/components/BrandLogo";
import { OpenPayStyledButton, defaultBtnStyleForPayment } from "@/components/qr-pay/OpenPayPayButton";
import {
  getProDestinationError,
  formatProDestinationPreview,
  formatProDestinationForApi,
} from "@/lib/openpayProTransfer";


interface Item { name: string; description?: string; quantity: number; unit_price: number; image_url?: string }

type PType = "product" | "digital" | "donation" | "tip";
type AfterAction = "receipt" | "download" | "redirect";

const PAYMENT_TYPES: { value: PType; label: string; hint: string; icon: typeof Package; tone: string }[] = [
  { value: "product", label: "Product", hint: "Goods or services", icon: Package, tone: "ios-glyph-blue" },
  { value: "digital", label: "Digital", hint: "Files & downloads", icon: Download, tone: "ios-glyph-indigo" },
  { value: "donation", label: "Donation", hint: "Any amount", icon: HeartHandshake, tone: "ios-glyph-pink" },
  { value: "tip", label: "Tip", hint: "Say thanks", icon: Coffee, tone: "ios-glyph-orange" },
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
  const [proEnabled, setProEnabled] = useState(false);
  const [proTo, setProTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ token: string; total: number } | null>(null);
  const [shareSection, setShareSection] = useState<"mobile" | "desktop">("mobile");
  const [shareHelpOpen, setShareHelpOpen] = useState(false);

  const proError = proEnabled ? getProDestinationError(proTo) : null;


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
    if (proEnabled && proError) { toast.error(proError); return; }

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
    if (error) { setLoading(false); toast.error(error.message); return; }

    if (proEnabled && proTo.trim()) {
      const { error: proErr } = await (supabase as any).rpc("qr_pay_set_pro_settlement", {
        p_token: data.token,
        p_to: formatProDestinationForApi(proTo),
      });
      if (proErr) toast.error(`QR created, but Pro settlement wasn't saved: ${proErr.message}`);
    }

    setLoading(false);
    setCreated({ token: data.token, total: Number(data.total) });
    setShareSection("mobile");
    setShareHelpOpen(true);
    toast.success("QR payment created");

  };

  if (created) {
    const url = `${window.location.origin}/qr-pay/${created.token}`;
    const resetCreate = () => {
      setCreated(null);
      setShareSection("mobile");
      setItems([{ name: "", quantity: 1, unit_price: 0 }]);
      setTitle("");
      setDescription("");
      setCoverImage("");
    };

    return (
      <div className="min-h-screen qrp-page-bg pb-10">
        <QrPayHeader
          eyebrow="OpenPay"
          title="Share"
          subtitle="Send to a customer, or embed on your website."
          watermark="SHARE"
          backTo="/qr-pay"
          backLabel="Back to QR Pay"
        >
          <QrPaySteps current="share" />
        </QrPayHeader>

        <div className="relative z-[1] mx-auto w-full max-w-3xl px-3 pb-8 sm:px-5">
          {/* Section switcher */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="qrp-share-seg" role="tablist" aria-label="Share destination">
              <button
                type="button"
                role="tab"
                aria-selected={shareSection === "mobile"}
                className={shareSection === "mobile" ? "is-on" : ""}
                onClick={() => setShareSection("mobile")}
              >
                <Smartphone className="h-4 w-4" />
                <span>Mobile</span>
                <span className="qrp-share-seg-hint">Share to customer</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={shareSection === "desktop"}
                className={shareSection === "desktop" ? "is-on" : ""}
                onClick={() => setShareSection("desktop")}
              >
                <Monitor className="h-4 w-4" />
                <span>Website</span>
                <span className="qrp-share-seg-hint">Site &amp; apps</span>
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 self-start rounded-full px-3 text-[13px] font-semibold text-[var(--qrp-accent)] hover:bg-[var(--qrp-accent)]/10 sm:self-auto"
              onClick={() => setShareHelpOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
              Which should I use?
            </Button>
          </div>

          {shareSection === "mobile" ? (
            <div className="qrp-pop space-y-4">
              <div className="rounded-[16px] border border-[var(--qrp-accent)]/20 bg-[var(--qrp-accent)]/[0.06] px-4 py-3">
                <p className="text-[13px] font-semibold text-[var(--qrp-ink)]">Share to a customer</p>
                <p className="mt-0.5 text-[12px] leading-snug text-[var(--qrp-muted)]">
                  Send the link in chat, email, or SMS — or let them scan the QR in person. No website code needed.
                </p>
              </div>

              <div className="qrp-pay-sheet flex flex-col items-center p-5 sm:p-7">
                <div className="rounded-[20px] bg-white p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.06]">
                  <QRCodeSVG value={url} size={180} />
                </div>
                <div className="mt-5 text-center">
                  <div className="qrp-amount-hero">{cur} {created.total.toFixed(2)}</div>
                  <p className="mt-2 text-[13px] text-[var(--qrp-muted)]">Scan with OpenPay or any QR app</p>
                </div>
                <div className="mt-4 w-full break-all rounded-[12px] bg-black/[0.04] p-2.5 text-center font-mono text-[11px] text-[var(--qrp-muted)]">
                  {url}
                </div>
                <div className="mt-3 flex w-full gap-2">
                  <Button
                    variant="outline"
                    className="h-12 flex-1 rounded-[14px] border-0 bg-black/[0.04]"
                    onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}
                  >
                    <Copy className="mr-1 h-4 w-4" />Copy link
                  </Button>
                  <Button
                    className="qrp-primary-btn h-12 flex-1 gap-2"
                    onClick={async () => {
                      try {
                        if ((navigator as any).share) await (navigator as any).share({ title: "Pay with OpenPay", url });
                        else { navigator.clipboard.writeText(url); toast.success("Link copied"); }
                      } catch { /* user cancelled */ }
                    }}
                  >
                    <BrandLogo variant="white" animate={false} className="h-4 w-4" />
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="mt-2 w-full gap-1.5 rounded-xl text-[var(--qrp-accent)]"
                  onClick={() => window.open(url, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview checkout
                </Button>
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[16px] bg-white/80 px-4 py-3.5 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.05)] backdrop-blur"
                onClick={() => setShareSection("desktop")}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.05]">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold tracking-[-0.01em]">Need this on a website or app?</p>
                    <p className="text-[12px] text-[var(--qrp-muted)]">Button, iFrame, widget, or HTML page</p>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-[var(--qrp-accent)]">Open</span>
              </button>
            </div>
          ) : (
            <div className="qrp-pop space-y-4">
              <div className="rounded-[16px] border border-black/5 bg-black/[0.03] px-4 py-3">
                <p className="text-[13px] font-semibold text-[var(--qrp-ink)]">Website &amp; apps</p>
                <p className="mt-0.5 text-[12px] leading-snug text-[var(--qrp-muted)]">
                  Embed a Pay button, checkout iFrame, widget, or download a full HTML page for your site or app.
                </p>
              </div>

              <QrPayIntegrations
                url={url}
                amount={created.total}
                currency={cur}
                title={title || "OpenPay Checkout"}
                paymentType={paymentType}
                hideQrTab
                compactHeader
              />

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[16px] bg-white/80 px-4 py-3.5 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.05)] backdrop-blur"
                onClick={() => setShareSection("mobile")}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.05]">
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold tracking-[-0.01em]">Just sharing with a customer?</p>
                    <p className="text-[12px] text-[var(--qrp-muted)]">QR code, copy link, and Share</p>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-[var(--qrp-accent)]">Open</span>
              </button>
            </div>
          )}

          <div className="mt-5 space-y-2">
            <Button className="qrp-primary-btn mt-1 w-full gap-2" onClick={() => navigate("/qr-pay")}>
              <BrandLogo variant="white" animate={false} className="h-5 w-5" />
              Done
            </Button>
            <Button variant="ghost" className="w-full rounded-xl text-[var(--qrp-muted)]" onClick={resetCreate}>
              Create another
            </Button>
          </div>
        </div>

        <QrPayShareHelpDialog
          open={shareHelpOpen}
          onOpenChange={setShareHelpOpen}
          onPick={setShareSection}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen qrp-page-bg pb-32">
      <QrPayHeader
        eyebrow="OpenPay"
        title="New Payment"
        subtitle="Set up checkout, then share a QR code."
        watermark="PAY"
        backTo="/qr-pay"
        backLabel="Back to QR Pay"
      >
        <QrPaySteps current="setup" />
      </QrPayHeader>


      <div className="relative z-[1] mx-auto mt-3 grid w-full max-w-6xl grid-cols-1 gap-4 p-3 sm:mt-5 sm:gap-5 sm:p-5 lg:grid-cols-12 lg:gap-8">
        {/* ── Left: setup form ───────────────────────────── */}
        <div className="space-y-4 lg:col-span-7 lg:space-y-5">

          {/* Step 1 — details */}
          <div className="qrp-card space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="ios-glyph ios-glyph-blue">
                <Package className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">Payment details</h2>
                <p className="text-[13px] text-[var(--qrp-muted)]">What are you charging for?</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="px-0.5 text-[12px] font-medium tracking-[-0.01em] text-[#8e8e93]">Payment type</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PAYMENT_TYPES.map(({ value, label, hint, icon: Icon, tone }) => {
                  const active = paymentType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentType(value)}
                      className={`ios-type-tile ${active ? "is-active" : ""}`}
                    >
                      <span className={`ios-glyph ${tone}`}>
                        <Icon className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <span className={`text-[13px] font-semibold tracking-[-0.01em] ${active ? "text-[#007AFF]" : "text-[#1d1d1f]"}`}>{label}</span>
                      <span className="text-[10px] leading-tight text-[#8e8e93]">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ios-form-group">
              <div className="ios-form-row">
                <label className="ios-form-label">Display title</label>
                <Input
                  className="ios-form-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={paymentType === "donation" ? "Support our project" : paymentType === "tip" ? "Leave a tip" : "e.g. Morning Coffee Combo"}
                />
              </div>
              <div className="ios-form-row !gap-2">
                <label className="ios-form-label">Currency</label>
                <CurrencyPicker value={cur} onChange={setCur} className="!bg-transparent !px-0 !min-h-0 !rounded-none" />
              </div>
              <div className="ios-form-row">
                <label className="ios-form-label">Description (optional)</label>
                <Textarea
                  className="ios-form-input min-h-[56px] resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Shown at checkout"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="px-0.5 text-[12px] font-medium tracking-[-0.01em] text-[#8e8e93]">Cover photo</p>
              {coverImage ? (
                <div className="relative overflow-hidden rounded-[14px]">
                  <img src={coverImage} alt="Checkout cover" className="h-36 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImage("")}
                    className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <label className="ios-upload">
                  {uploading === "cover"
                    ? <Loader2 className="h-7 w-7 animate-spin text-[#007AFF]" />
                    : (
                      <span className="ios-glyph ios-glyph-gray mb-1">
                        <ImagePlus className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                    )}
                  <span className="text-[15px] font-medium text-[#007AFF]">Add Cover Photo</span>
                  <span className="text-[12px] text-[#8e8e93]">Looks more trusted at checkout</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleCoverImage(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>

          {/* Step 2 — amount / items */}
          <div className="qrp-card space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`ios-glyph ${isFlexible ? "ios-glyph-orange" : "ios-glyph-teal"}`}>
                  {isFlexible ? <Coffee className="h-4 w-4" strokeWidth={2.25} /> : <Package className="h-4 w-4" strokeWidth={2.25} />}
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{isFlexible ? "Amount settings" : "Line items"}</h2>
                  <p className="text-[13px] text-[var(--qrp-muted)]">{isFlexible ? "Customers pick their own amount" : "What the customer is paying for"}</p>
                </div>
              </div>
              {!isFlexible && (
                <button
                  type="button"
                  onClick={() => setItems([...items, { name: "", quantity: 1, unit_price: 0 }])}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-[#007AFF]/12 px-3 py-1.5 text-[13px] font-semibold text-[#007AFF] transition-colors hover:bg-[#007AFF]/18"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />Add
                </button>
              )}
            </div>

            {isFlexible ? (
              <div className="space-y-3">
                <div className="ios-form-group">
                  <div className="ios-form-row">
                    <label className="ios-form-label">Suggested ({cur})</label>
                    <Input className="ios-form-input" type="number" step="0.01" min={0} value={suggested} onChange={e => setSuggested(e.target.value)} placeholder="5.00" />
                  </div>
                  <div className="ios-form-row">
                    <label className="ios-form-label">Minimum ({cur})</label>
                    <Input className="ios-form-input" type="number" step="0.01" min={0} value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 5, 10, 25, 50].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSuggested(String(v))}
                      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
                        Number(suggested) === v ? "bg-[#007AFF] text-white" : "bg-[#f2f2f7] text-[#1d1d1f]"
                      }`}
                    >
                      {cur} {v}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-[#8e8e93]">Suggested amount is pre-filled — customers can change it.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((it, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-[14px] bg-[#f2f2f7] p-3.5">
                    <div className="flex gap-3">
                      <label className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[12px] bg-white">
                        {it.image_url
                          ? <img src={it.image_url} alt={it.name || "Item"} className="h-full w-full object-cover" />
                          : uploading === i
                            ? <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
                            : <ImagePlus className="h-5 w-5 text-[#c7c7cc]" strokeWidth={1.75} />}
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleItemImage(i, e.target.files[0])} />
                      </label>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <Input
                          className="h-8 border-0 bg-transparent px-0 text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f] shadow-none focus-visible:ring-0"
                          placeholder="Item name"
                          value={it.name}
                          onChange={e => update(i, "name", e.target.value)}
                        />
                        <Input
                          className="h-7 border-0 bg-transparent px-0 text-[13px] text-[#8e8e93] shadow-none focus-visible:ring-0"
                          placeholder="Optional description"
                          value={it.description || ""}
                          onChange={e => update(i, "description", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-medium text-[#8e8e93]">Qty</span>
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" onClick={() => update(i, "quantity", Math.max(1, Number(it.quantity) - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[17px] text-[#007AFF] active:scale-90">−</button>
                          <span className="w-6 text-center text-[15px] font-semibold">{it.quantity}</span>
                          <button type="button" onClick={() => update(i, "quantity", Number(it.quantity) + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[17px] text-[#007AFF] active:scale-90">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-medium text-[#8e8e93]">Unit ({cur})</span>
                        <Input
                          type="number" step="0.01" min={0}
                          className="mt-1 h-9 w-28 rounded-[10px] border-0 bg-white text-right text-[15px] font-semibold shadow-none focus-visible:ring-1 focus-visible:ring-[#007AFF]/30"
                          value={it.unit_price}
                          onChange={e => update(i, "unit_price", Number(e.target.value))}
                        />
                      </div>
                      <div className="ml-auto text-right">
                        <span className="text-[11px] font-medium text-[#8e8e93]">Line</span>
                        <div className="text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">{cur} {(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}</div>
                      </div>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#FF3B30] shadow-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3 — options */}
          <div className="qrp-card space-y-1 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-3">
              <span className="ios-glyph ios-glyph-green">
                <Settings2 className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">Checkout options</h2>
                <p className="text-[13px] text-[var(--qrp-muted)]">Defaults work great — tweak if needed</p>
              </div>
            </div>

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="methods" className="border-black/[0.06]">
                <AccordionTrigger className="text-[15px] font-semibold tracking-[-0.01em] hover:no-underline">
                  <span className="flex items-center gap-2.5">
                    <span className="ios-glyph ios-glyph-blue !h-7 !w-7 !rounded-[7px]">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    Payment methods
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-4">
                  {[
                    { k: "pi", l: "Pi Network", d: "Pay from Pi balance" },
                    { k: "wallet", l: "OpenPay Wallet", d: "Instant internal transfer" },
                    { k: "card", l: "Virtual Card", d: "Card checkout" },
                    { k: "guest", l: "Allow guest checkout", d: "No sign-in needed for Pi" },
                  ].map(m => (
                    <div key={m.k} className="flex items-center justify-between gap-3 rounded-[12px] bg-[#f2f2f7] px-3.5 py-3">
                      <div>
                        <p className="text-[15px] font-medium tracking-[-0.01em] text-[#1d1d1f]">{m.l}</p>
                        <p className="text-[12px] text-[#8e8e93]">{m.d}</p>
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
                  <div className="space-y-2 rounded-xl border border-black/10 bg-black/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Settle to OpenPay Pro</p>
                        <p className="text-xs text-muted-foreground">Credit earnings to your Pro wallet</p>
                      </div>
                      <Switch checked={proEnabled} onCheckedChange={setProEnabled} />
                    </div>
                    {proEnabled && (
                      <div className="space-y-1.5">
                        <Input
                          className="qrp-input h-11 rounded-xl"
                          value={proTo}
                          onChange={e => setProTo(e.target.value)}
                          placeholder="@username or 0x wallet address"
                        />
                        {proError ? (
                          <p className="text-xs font-medium text-destructive">{proError}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Paid orders are credited to {proTo.trim() ? formatProDestinationPreview(proTo) : "your OpenPay Pro wallet"} automatically.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expires in (minutes)</Label>
                    <Input className="qrp-input h-11 rounded-xl" type="number" min={1} value={expiresMin} onChange={e => setExpiresMin(e.target.value)} placeholder="Never" />
                  </div>

                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="after" className="border-border/60">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                  <span className="flex items-center gap-2.5">
                    <span className="ios-glyph ios-glyph-indigo !h-7 !w-7 !rounded-[7px]">
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    After payment
                  </span>
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
                  <span className="flex items-center gap-2.5">
                    <span className="ios-glyph ios-glyph-gray !h-7 !w-7 !rounded-[7px]">
                      <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    Customer details
                  </span>
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
          <div className="space-y-4 lg:sticky lg:top-6 lg:space-y-5">
            <p className="text-center text-[11px] font-semibold tracking-[-0.01em] text-muted-foreground">Customer preview</p>

            {/* live checkout card — Apple Pay sheet preview */}
            <div className="qrp-pay-sheet mx-auto max-w-[340px]">
              {coverImage ? (
                <img src={coverImage} alt="Checkout cover preview" className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center bg-black/[0.03]">
                  <ImagePlus className="h-8 w-8 text-muted-foreground/35" />
                </div>
              )}

              <div className="space-y-4 px-5 py-5">
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--qrp-muted)]">OpenPay</p>
                  <h3 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.02em] text-foreground">{previewTitle}</h3>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--qrp-muted)]">{description || "Secure payment via QR"}</p>
                  <div className="qrp-amount-hero mt-3 text-[2rem]">{total.toFixed(2)} <span className="text-base font-medium text-[var(--qrp-muted)]">{cur}</span></div>
                </div>

                {!isFlexible && (
                  <div className="qrp-group">
                    {filledItems.length === 0 ? (
                      <div className="qrp-group-row text-[12px] text-muted-foreground">Add items to see them here…</div>
                    ) : filledItems.slice(0, 4).map((it, i) => (
                      <div key={i} className="qrp-group-row text-[13px]">
                        <span className="truncate text-[var(--qrp-muted)]">{it.name} × {it.quantity}</span>
                        <span className="shrink-0 font-medium">{(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-1.5">
                  {allow.pi && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-semibold">Pi</span>}
                  {allow.wallet && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-semibold">Wallet</span>}
                  {allow.card && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[10px] font-semibold">Card</span>}
                </div>

                <div className="pointer-events-none w-full">
                  <OpenPayStyledButton
                    as="div"
                    style={defaultBtnStyleForPayment(paymentType)}
                    theme="black"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* grand total + generate */}
            <div className="qrp-dark-panel space-y-4 rounded-[22px] bg-[var(--qrp-ink)] p-6 text-white shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white/60">Total</p>
                  <h4 className="qrp-display truncate text-[1.85rem] sm:text-[2.1rem]">{total.toFixed(2)} <span className="text-base font-medium text-white/70">{cur}</span></h4>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <QrCode className="h-5 w-5" />
                </span>
              </div>
              <Button
                className="h-14 w-full gap-2 rounded-[14px] bg-white text-[16px] font-semibold text-[var(--qrp-ink)] shadow-lg hover:bg-white/95"
                disabled={loading || (!isFlexible && total <= 0)}
                onClick={submit}
              >
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating…</> : (
                  <><BrandLogo animate={false} className="h-5 w-5" />Generate QR</>
                )}
              </Button>
              <p className="text-center text-[11px] text-white/55">Review details before sharing</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
