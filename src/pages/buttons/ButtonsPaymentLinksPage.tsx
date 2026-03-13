import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Link2, QrCode, Sparkles, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";

type BuildTab = "product" | "checkout" | "confirmation";
type OutputType = "link_qr" | "buttons";
type Deliverable = "button" | "direct" | "qr" | "iframe" | "widget";
type PriceType = "fixed" | "customer_choice";

const ButtonsPaymentLinksPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<BuildTab>("product");
  const [outputType, setOutputType] = useState<OutputType>("link_qr");
  const [deliverable, setDeliverable] = useState<Deliverable>("button");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("fixed");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [allowQuantity, setAllowQuantity] = useState(false);
  const [maxQty, setMaxQty] = useState("1");
  const [enableImages, setEnableImages] = useState(false);
  const [customerNotes, setCustomerNotes] = useState(false);
  const [productId, setProductId] = useState(false);
  const [variants, setVariants] = useState(false);
  const [inventory, setInventory] = useState(false);

  const shareTab = useMemo(() => {
    if (deliverable === "direct") return "direct";
    if (deliverable === "qr") return "qr";
    if (deliverable === "iframe") return "iframe";
    if (deliverable === "widget") return "widget";
    return "button";
  }, [deliverable]);

  const previewAmount = useMemo(() => {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [price]);

  const goNext = () => {
    setTab((current) => {
      if (current === "product") return "checkout";
      if (current === "checkout") return "confirmation";
      return "confirmation";
    });
  };

  const goPrev = () => {
    setTab((current) => {
      if (current === "confirmation") return "checkout";
      if (current === "checkout") return "product";
      return "product";
    });
  };

  const handleBuild = () => {
    const params = new URLSearchParams();
    params.set("share_tab", shareTab);
    params.set("link_type", "custom_amount");
    params.set("title", (itemName || "OpenPay Payment").slice(0, 64));
    if (description.trim()) params.set("description", description.trim().slice(0, 2048));
    if (currency.trim()) params.set("currency", currency.trim().toUpperCase().slice(0, 8));
    if (priceType === "fixed" && previewAmount !== null) {
      params.set("amount", String(Math.round(previewAmount * 100) / 100));
    }
    params.set("cta", outputType === "buttons" ? "Pay now" : "OpenPay");
    params.set("button_style", "default");
    params.set("button_size", "medium");

    navigate(`/payment-links/create?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-28">
      <div className="px-4 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/buttons")}
              className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-paypal-dark">Build your payment links & buttons</h1>
              <p className="text-xs font-semibold text-muted-foreground">
                Create an OpenPay link, QR code, or website button with an interactive preview.
              </p>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <div className="paypal-surface rounded-[2rem] bg-white p-6 shadow-sm border border-paypal-blue/5">
              <div className="flex flex-wrap items-center gap-3">
                <a
                  className="text-xs font-bold text-paypal-blue hover:underline"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/buttons");
                  }}
                >
                  Back to Buttons
                </a>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" className="h-10 rounded-full px-4" onClick={() => undefined}>
                    More actions <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                  <Button className="h-10 rounded-full bg-paypal-blue px-5 text-white hover:bg-[#004dc5]" onClick={handleBuild}>
                    Build it
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-6 border-b border-border/60">
                {([
                  { key: "product", label: "Product" },
                  { key: "checkout", label: "Checkout" },
                  { key: "confirmation", label: "Confirmation" },
                ] as const).map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setTab(row.key)}
                    className={`pb-3 text-sm font-bold ${
                      tab === row.key ? "border-b-2 border-paypal-blue text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {row.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-6">
                <div>
                  <p className="text-sm font-black text-foreground">Choose a payment link or button</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    If you don’t have a website, choose a payment link and QR code. For websites, choose buttons/embeds.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOutputType("link_qr");
                        setDeliverable("qr");
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        outputType === "link_qr" ? "border-paypal-blue bg-paypal-blue/5" : "border-border/70 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-paypal-blue/10">
                          <QrCode className="h-5 w-5 text-paypal-blue" />
                        </div>
                        <p className="text-sm font-black text-foreground">Payment link & QR code</p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Share a link or QR customers can open to pay instantly.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOutputType("buttons");
                        setDeliverable("button");
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        outputType === "buttons" ? "border-paypal-blue bg-paypal-blue/5" : "border-border/70 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-paypal-blue/10">
                          <Link2 className="h-5 w-5 text-paypal-blue" />
                        </div>
                        <p className="text-sm font-black text-foreground">Payment buttons</p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Copy button/widget/iframe code to embed checkout on your website.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white p-5">
                  <p className="text-sm font-black text-foreground">Name and description</p>
                  <p className="mt-1 text-xs text-muted-foreground">Let customers know what they’ll get.</p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-bold text-muted-foreground">Item name</p>
                      <input
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                        placeholder="Item name"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold text-muted-foreground">Description (optional)</p>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="min-h-[88px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                        placeholder="Description"
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground text-right">{description.length}/2048</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white p-5">
                  <p className="text-sm font-black text-foreground">Price</p>
                  <p className="mt-1 text-xs text-muted-foreground">Set a fixed price or give customers control.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <p className="mb-1 text-xs font-bold text-muted-foreground">Choose type</p>
                      <select
                        value={priceType}
                        onChange={(e) => setPriceType(e.target.value as PriceType)}
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="fixed">One set price</option>
                        <option value="customer_choice">Customer chooses</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <p className="mb-1 text-xs font-bold text-muted-foreground">Price</p>
                      <input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={priceType === "customer_choice"}
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60"
                        placeholder={priceType === "customer_choice" ? "Customer sets amount" : "0.00"}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <p className="mb-1 text-xs font-bold text-muted-foreground">Currency</p>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="USD">USD</option>
                        <option value="PHP">PHP</option>
                        <option value="OUSD">OPEN USD</option>
                        <option value="PI">PI</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-foreground">Quantity</p>
                      <p className="mt-1 text-xs text-muted-foreground">Let customers buy multiple items at once.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllowQuantity((v) => !v)}
                      className={`h-7 w-12 rounded-full border transition ${
                        allowQuantity ? "border-paypal-blue bg-paypal-blue" : "border-border bg-secondary/40"
                      }`}
                      aria-label="Toggle quantity"
                    >
                      <div
                        className={`h-6 w-6 rounded-full bg-white shadow-sm transition ${
                          allowQuantity ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {allowQuantity ? (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-bold text-muted-foreground">Maximum</p>
                      <input
                        value={maxQty}
                        onChange={(e) => setMaxQty(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                        inputMode="numeric"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border/70 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-foreground">Images</p>
                      <p className="mt-1 text-xs text-muted-foreground">Add up to 5 photos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableImages((v) => !v)}
                      className={`h-7 w-12 rounded-full border transition ${
                        enableImages ? "border-paypal-blue bg-paypal-blue" : "border-border bg-secondary/40"
                      }`}
                      aria-label="Toggle images"
                    >
                      <div
                        className={`h-6 w-6 rounded-full bg-white shadow-sm transition ${
                          enableImages ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {enableImages ? (
                    <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      Drag and drop images (coming soon)
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border/70 bg-white p-5">
                  <p className="text-sm font-black text-foreground">More options</p>
                  <div className="mt-3 space-y-3">
                    {[
                      { key: "customerNotes", label: "Customer notes", value: customerNotes, set: setCustomerNotes },
                      { key: "productId", label: "Product ID", value: productId, set: setProductId },
                      { key: "variants", label: "Variants", value: variants, set: setVariants },
                      { key: "inventory", label: "Inventory", value: inventory, set: setInventory },
                    ].map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{row.label}</p>
                        <button
                          type="button"
                          onClick={() => row.set(!row.value)}
                          className={`h-7 w-12 rounded-full border transition ${
                            row.value ? "border-paypal-blue bg-paypal-blue" : "border-border bg-secondary/40"
                          }`}
                          aria-label={`Toggle ${row.label}`}
                        >
                          <div
                            className={`h-6 w-6 rounded-full bg-white shadow-sm transition ${
                              row.value ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={goPrev} disabled={tab === "product"}>
                    Back
                  </Button>
                  <Button className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]" onClick={goNext}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-[420px]">
            <div className="paypal-surface rounded-[2rem] bg-white p-6 shadow-sm border border-paypal-blue/5 lg:sticky lg:top-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-foreground">Interactive preview</p>
                <button type="button" className="text-xs font-black text-paypal-blue">
                  Settings
                </button>
              </div>
              <div className="mt-4 flex justify-center">
                <div className="w-[280px] rounded-[2.25rem] border border-border bg-secondary/10 p-3 shadow-inner">
                  <div className="mx-auto mb-2 h-6 w-24 rounded-full bg-secondary/40" />
                  <div className="rounded-3xl bg-white p-4">
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Order summary</p>
                    <div className="mt-3 rounded-2xl bg-secondary/20 p-3">
                      <p className="text-sm font-black text-foreground">{itemName.trim() || "OpenPay Payment"}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {description.trim() || "Your customers will see this summary before paying."}
                      </p>
                      <p className="mt-2 text-base font-black text-foreground">
                        {priceType === "customer_choice"
                          ? "Customer sets amount"
                          : previewAmount !== null
                            ? `${previewAmount.toFixed(2)} ${currency}`
                            : `0.00 ${currency}`}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-xl bg-paypal-blue py-3 text-sm font-black text-white"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        OpenPay
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-border" />
                        <p className="text-[10px] font-bold text-muted-foreground">or pay with</p>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-xl bg-paypal-dark py-3 text-sm font-black text-white"
                      >
                        <WalletCards className="mr-2 h-4 w-4" />
                        Debit or Credit Card
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-secondary/20 p-4 text-xs text-muted-foreground">
                Choose deliverable:
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([
                    { key: "button", label: "Button" },
                    { key: "direct", label: "Link" },
                    { key: "qr", label: "QR" },
                    { key: "iframe", label: "Iframe" },
                    { key: "widget", label: "Widget" },
                  ] as const).map((row) => (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => setDeliverable(row.key)}
                      className={`h-9 rounded-xl border text-xs font-black ${
                        deliverable === row.key
                          ? "border-paypal-blue bg-white text-paypal-blue"
                          : "border-border/70 bg-white/70 text-foreground"
                      }`}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default ButtonsPaymentLinksPage;
