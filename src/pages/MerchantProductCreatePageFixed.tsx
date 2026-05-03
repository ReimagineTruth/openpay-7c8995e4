import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, X, Package, CreditCard, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import AuthMark from "@/components/AuthMark";

const sanitizeCode = (name: string) => {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!base) return "PRODUCT";
  return base.slice(0, 18);
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

interface ProductData {
  productCode: string;
  productName: string;
  productDescription: string;
  unitAmount: number;
  currency: string;
  isActive: boolean;
  productTags: string[];
  mediaUrls: string[];
  checkoutInfo: string;
  metadata: any;
  pricingType: "one_time" | "subscription";
  repeatEvery: number | null;
  repeatUnit: string | null;
  taxCode: string;
}

const MerchantProductCreatePageFixed = () => {
  const navigate = useNavigate();
  const { currencies, currency: dashboardCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merchantName, setMerchantName] = useState("OpenPay Merchant");
  const [merchantUsername, setMerchantUsername] = useState("");
  const [merchantApiKey, setMerchantApiKey] = useState("");
  const [merchantMode, setMerchantMode] = useState<"sandbox" | "live">("sandbox");

  // Product form state
  const [productName, setProductName] = useState("");
  const [productImages, setProductImages] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const [productTags, setProductTags] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [checkoutInfo, setCheckoutInfo] = useState("");
  const [paymentType, setPaymentType] = useState<"one_time" | "subscription">("one_time");
  const [amount, setAmount] = useState("0.00");
  const [currency, setCurrency] = useState("USD");
  const [feePayer, setFeePayer] = useState<"customer" | "merchant">("customer");
  const [productKind, setProductKind] = useState<"physical" | "digital">("physical");
  const [digitalDeliveryType, setDigitalDeliveryType] = useState<"file" | "link">("file");
  const [digitalFileName, setDigitalFileName] = useState("");
  const [digitalFileDataUrl, setDigitalFileDataUrl] = useState("");
  const [digitalDownloadLink, setDigitalDownloadLink] = useState("");
  const [repeatEvery, setRepeatEvery] = useState("1");
  const [repeatUnit, setRepeatUnit] = useState("month");
  const [taxCode, setTaxCode] = useState("digital_goods");

  // Checkout state
  const [checkoutSession, setCheckoutSession] = useState<any>(null);
  const [showCheckoutQr, setShowCheckoutQr] = useState(false);
  const [previewTab, setPreviewTab] = useState<"product" | "checkout">("product");

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/sign-in?mode=signin");
        return;
      }

      // Load merchant profile and API keys
      const [{ data: profile }, { data: account }, { data: apiKeys }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", user.id)
          .single(),
        supabase.rpc("upsert_my_user_account"),
        supabase
          .from("merchant_api_keys")
          .select("key_mode, api_key")
          .eq("merchant_user_id", user.id)
          .eq("is_active", true)
      ]);

      const profileUsername = String(profile?.username || "").trim().replace(/^@+/, "");
      const accountRow = account as { account_number?: string; account_username?: string } | null;
      const accountUsername = String(accountRow?.account_username || "").trim().replace(/^@+/, "");

      setMerchantName(profile?.full_name || profileUsername || accountUsername || "OpenPay Merchant");
      setMerchantUsername(profileUsername || accountUsername);

      // Set API key and mode - for now, we'll use a mock key
      // In production, you'd need to fetch the actual secret key from a secure endpoint
      if (apiKeys && !('error' in apiKeys) && apiKeys.length > 0) {
        const sandboxKey = apiKeys.find((key: any) => key.key_mode === "sandbox");
        const liveKey = apiKeys.find((key: any) => key.key_mode === "live");
        
        if (sandboxKey) {
          setMerchantApiKey("mock_sandbox_key"); // Replace with actual key retrieval
          setMerchantMode("sandbox");
        } else if (liveKey) {
          setMerchantApiKey("mock_live_key"); // Replace with actual key retrieval
          setMerchantMode("live");
        }
      }
      
      if (currencies.length) {
        const defaultCurrency = currencies.find((c) => c.code === (dashboardCurrency?.code || currency))?.code || currencies[0].code;
        setCurrency(defaultCurrency);
      }
      setLoading(false);
    };
    boot();
  }, [currencies, dashboardCurrency?.code, navigate]);

  const previewAmount = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amount]);

  const selectedCurrencySymbol = useMemo(
    () => currencies.find((c) => c.code === currency)?.symbol || "",
    [currencies, currency],
  );

  const feeAmount = useMemo(() => Number((previewAmount * 0.02).toFixed(2)), [previewAmount]);
  const totalDue = useMemo(
    () => Number((previewAmount + (feePayer === "customer" ? feeAmount : 0)).toFixed(2)),
    [feeAmount, feePayer, previewAmount],
  );

  const merchantReceivable = useMemo(
    () => Number((previewAmount - (feePayer === "merchant" ? feeAmount : 0)).toFixed(2)),
    [feeAmount, feePayer, previewAmount],
  );

  const productTagList = useMemo(
    () =>
      productTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [productTags],
  );

  const handleSave = async (publish: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in first");
      navigate("/sign-in?mode=signin");
      return;
    }

    if (!productName.trim()) {
      toast.error("Enter a product name");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (productKind === "digital") {
      const hasFile = Boolean(digitalDeliveryType === "file" && digitalFileDataUrl && digitalFileName);
      const hasLink = Boolean(digitalDeliveryType === "link" && digitalDownloadLink.trim());
      if (!hasFile && !hasLink) {
        toast.error("Digital product requires a file upload or direct link");
        return;
      }
    }

    if (!merchantApiKey) {
      toast.error("Merchant API key required. Please create an API key first.");
      return;
    }

    setSaving(true);
    const productCode = sanitizeCode(productName);
    const tags = productTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const imageUrls = productImages.map((image) => image.dataUrl).filter(Boolean);

    const metadata = {
      product_images: imageUrls,
      fee_percent: 2,
      fee_payer: feePayer,
      product_kind: productKind,
      digital_delivery_type: productKind === "digital" ? digitalDeliveryType : null,
      digital_file_name: productKind === "digital" && digitalDeliveryType === "file" ? digitalFileName || null : null,
      digital_file_data_url: productKind === "digital" && digitalDeliveryType === "file" ? digitalFileDataUrl || null : null,
      digital_download_link: productKind === "digital" && digitalDeliveryType === "link" ? digitalDownloadLink.trim() || null : null,
    };

    try {
      // Create a type-safe RPC call wrapper
      const { data, error } = await (supabase.rpc as any)("upsert_merchant_product", {
        p_product_code: productCode,
        p_product_name: productName.trim(),
        p_product_description: productDescription.trim(),
        p_unit_amount: parsedAmount,
        p_currency: currency.toUpperCase(),
        p_is_active: publish,
        p_product_tags: tags,
        p_media_urls: imageUrls,
        p_checkout_info: checkoutInfo.trim(),
        p_metadata: metadata,
        p_pricing_type: paymentType,
        p_repeat_every: paymentType === "subscription" ? Number(repeatEvery) || 1 : null,
        p_repeat_unit: paymentType === "subscription" ? repeatUnit : null,
        p_tax_code: taxCode,
        p_publish: publish
      });

      if (error) {
        throw error;
      }

      if (data && Array.isArray(data) && data.length > 0 && data[0]?.success) {
        toast.success(publish ? "Product published successfully" : "Product saved successfully");
        navigate("/merchant-products");
      } else {
        toast.error("Failed to save product");
      }
    } catch (error: any) {
      console.error("Product save error:", error);
      toast.error(error.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCheckoutSession = async () => {
    if (!merchantApiKey) {
      toast.error("Merchant API key required");
      return;
    }

    if (!productName.trim() || previewAmount <= 0) {
      toast.error("Product name and amount required");
      return;
    }

    try {
      // First, save the product if not already saved
      const productCode = sanitizeCode(productName);
      const tags = productTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const imageUrls = productImages.map((image) => image.dataUrl).filter(Boolean);

      const metadata = {
        product_images: imageUrls,
        fee_percent: 2,
        fee_payer: feePayer,
        product_kind: productKind,
      };

      const { data: productData, error: productError } = await (supabase.rpc as any)("upsert_merchant_product", {
        p_product_code: productCode,
        p_product_name: productName.trim(),
        p_product_description: productDescription.trim(),
        p_unit_amount: previewAmount,
        p_currency: currency.toUpperCase(),
        p_is_active: true,
        p_product_tags: tags,
        p_media_urls: imageUrls,
        p_checkout_info: checkoutInfo.trim(),
        p_metadata: metadata,
        p_pricing_type: paymentType,
        p_repeat_every: paymentType === "subscription" ? Number(repeatEvery) || 1 : null,
        p_repeat_unit: paymentType === "subscription" ? repeatUnit : null,
        p_tax_code: taxCode,
        p_publish: true
      });

      if (productError) {
        throw productError;
      }

      // Get the product ID
      const productId = productData?.[0]?.product_id;
      if (!productId) {
        throw new Error("Failed to create product");
      }

      // Create checkout session
      const { data, error } = await (supabase.rpc as any)("create_merchant_checkout_session", {
        p_secret_key: merchantApiKey,
        p_mode: merchantMode,
        p_currency: currency.toUpperCase(),
        p_items: JSON.stringify([{
          product_id: productId,
          quantity: 1
        }]),
        p_expires_in_minutes: 30
      });

      if (error) {
        throw error;
      }

      if (data && Array.isArray(data) && data.length > 0 && data[0]?.success) {
        setCheckoutSession(data[0]);
        setShowCheckoutQr(true);
        toast.success("Checkout session created successfully");
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (error: any) {
      console.error("Checkout session error:", error);
      toast.error(error.message || "Failed to create checkout session");
    }
  };

  const handleProductImageSelection = async (files: FileList | null) => {
    if (!files?.length) return;

    const current = productImages.length;
    const available = Math.max(0, 5 - current);
    if (available <= 0) {
      toast.error("Maximum of 5 product images allowed");
      return;
    }

    const selected = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!selected.length) {
      toast.error("Please select image files only");
      return;
    }

    const toAdd = selected.slice(0, available);
    if (selected.length > available) {
      toast.message("Only the first 5 images are kept");
    }

    try {
      const nextImages = await Promise.all(
        toAdd.map(async (file) => ({
          name: file.name,
          dataUrl: await fileToDataUrl(file),
        })),
      );
      setProductImages((prev) => [...prev, ...nextImages].slice(0, 5));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load images");
    }
  };

  const handleDigitalFileSelection = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setDigitalFileName(file.name);
      setDigitalFileDataUrl(dataUrl);
      setDigitalDeliveryType("file");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load file");
    }
  };

  if (loading)     return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
        <div className="text-center">
          <AuthMark className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Loading product builder...</p>
          <p className="mt-1 text-xs font-medium tracking-normal text-white/65">Powered by Pi Network</p>
          <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <button onClick={() => navigate("/merchant-products")} className="flex h-9 w-9 items-center justify-center rounded-full border border-border">
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium">Create product</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 rounded-full" disabled={saving} onClick={() => handleSave(false)}>
              Save as unpublished
            </Button>
            <Button className="h-9 rounded-full bg-[#1f2530] text-white hover:bg-[#11151b]" disabled={saving} onClick={() => handleSave(true)}>
              Continue to publish
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-4 text-sm font-semibold text-foreground">
            <span>Details</span>
            <span className="text-muted-foreground">Content</span>
          </div>

          <div className="mt-6 space-y-6">
            {/* Product Name */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Product name</p>
                <span className="text-xs text-muted-foreground">{productName.length}/64</span>
              </div>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Add a product name"
                className="mt-2 h-11 rounded-lg"
              />
            </div>

            {/* Product Images */}
            <div>
              <p className="text-sm font-semibold text-foreground">Visuals</p>
              <p className="text-xs text-muted-foreground">Include screenshots and videos to show what customers are getting.</p>
              <label className="mt-2 flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground hover:bg-secondary/30">
                Drag and drop, or browse (up to 5 images)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleProductImageSelection(e.target.files)}
                />
              </label>
              {productImages.length > 0 ? (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {productImages.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-lg border border-border bg-white">
                      <img src={image.dataUrl} alt={image.name} className="h-16 w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white"
                        onClick={() => setProductImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Product Tags */}
            <div>
              <p className="text-sm font-semibold text-foreground">Product tags</p>
              <Input
                value={productTags}
                onChange={(e) => setProductTags(e.target.value)}
                placeholder="Search for relevant skills, tools, and industries"
                className="mt-2 h-11 rounded-lg"
              />
            </div>

            {/* Product Description */}
            <div>
              <p className="text-sm font-semibold text-foreground">Product description</p>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe your product's benefits..."
                className="mt-2 h-32 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>

            {/* Checkout Info */}
            <div>
              <p className="text-sm font-semibold text-foreground">Checkout information</p>
              <p className="text-xs text-muted-foreground">Add details to display on the checkout page.</p>
              <textarea
                value={checkoutInfo}
                onChange={(e) => setCheckoutInfo(e.target.value)}
                placeholder="Add any policies, demo links, or contact details..."
                className="mt-2 h-28 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>

            {/* Product Type */}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Product type</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProductKind("physical")}
                    className={`rounded-xl border px-3 py-3 text-left ${productKind === "physical" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">Physical</p>
                    <p className="text-xs text-muted-foreground">Ship or deliver physically</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductKind("digital")}
                    className={`rounded-xl border px-3 py-3 text-left ${productKind === "digital" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">Digital</p>
                    <p className="text-xs text-muted-foreground">File or direct download link</p>
                  </button>
                </div>
              </div>

              {/* Digital Delivery */}
              {productKind === "digital" && (
                <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
                  <p className="text-sm font-semibold text-foreground">Digital delivery</p>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setDigitalDeliveryType("file")}
                      className={`rounded-lg px-3 py-2 text-sm ${digitalDeliveryType === "file" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                    >
                      Upload file
                    </button>
                    <button
                      type="button"
                      onClick={() => setDigitalDeliveryType("link")}
                      className={`rounded-lg px-3 py-2 text-sm ${digitalDeliveryType === "link" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                    >
                      Direct link
                    </button>
                  </div>
                  {digitalDeliveryType === "file" ? (
                    <>
                      <label className="mt-1 flex h-12 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-white text-xs text-muted-foreground hover:bg-secondary/30">
                        Upload digital file
                        <input type="file" className="hidden" onChange={(e) => void handleDigitalFileSelection(e.target.files)} />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {digitalFileName ? `Uploaded: ${digitalFileName}` : "No file uploaded yet"}
                      </p>
                    </>
                  ) : (
                    <Input
                      value={digitalDownloadLink}
                      onChange={(e) => setDigitalDownloadLink(e.target.value)}
                      placeholder="https://your-download-link.com/file"
                      className="h-11 rounded-lg bg-white"
                    />
                  )}
                </div>
              )}

              {/* Payment Type */}
              <div>
                <p className="text-sm font-semibold text-foreground">Payment details</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentType("one_time")}
                    className={`rounded-xl border px-3 py-3 text-left ${paymentType === "one_time" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">One-time</p>
                    <p className="text-xs text-muted-foreground">Charge a one-time amount</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("subscription")}
                    className={`rounded-xl border px-3 py-3 text-left ${paymentType === "subscription" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">Subscription</p>
                    <p className="text-xs text-muted-foreground">Charge an ongoing amount</p>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <p className="text-sm font-semibold text-foreground">Amount</p>
                <div className="mt-2 grid grid-cols-[1fr_120px] gap-2">
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-lg" />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Charge what you want. Enter $0 for free products.</p>
              </div>

              {/* Platform Fee */}
              <div>
                <p className="text-sm font-semibold text-foreground">Platform fee (2%)</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFeePayer("customer")}
                    className={`rounded-xl border px-3 py-3 text-left ${feePayer === "customer" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">Customer pays fee</p>
                    <p className="text-xs text-muted-foreground">Fee added on top of checkout total</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeePayer("merchant")}
                    className={`rounded-xl border px-3 py-3 text-left ${feePayer === "merchant" ? "border-foreground" : "border-border"}`}
                  >
                    <p className="text-sm font-semibold">Merchant pays fee</p>
                    <p className="text-xs text-muted-foreground">Fee deducted from merchant settlement</p>
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  2% fee goes to @openpay. Estimated fee: {selectedCurrencySymbol}{feeAmount.toFixed(2)} {currency}.
                </p>
              </div>

              {/* Subscription Details */}
              {paymentType === "subscription" && (
                <div>
                  <p className="text-sm font-semibold text-foreground">Repeat payment every</p>
                  <div className="mt-2 grid grid-cols-[120px_1fr] gap-2">
                    <Input value={repeatEvery} onChange={(e) => setRepeatEvery(e.target.value)} className="h-11 rounded-lg" />
                    <select
                      value={repeatUnit}
                      onChange={(e) => setRepeatUnit(e.target.value)}
                      className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
                    >
                      <option value="week">week</option>
                      <option value="month">month</option>
                      <option value="year">year</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Tax Code */}
              <div>
                <p className="text-sm font-semibold text-foreground">Product tax code</p>
                <select
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm"
                >
                  <option value="downloadable_software_personal">Downloadable software - personal use</option>
                  <option value="digital_goods">Digital goods</option>
                  <option value="services">Services</option>
                  <option value="physical_goods">Physical goods</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center gap-6 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setPreviewTab("product")}
              className={previewTab === "product" ? "text-foreground" : "text-muted-foreground"}
            >
              Product page
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab("checkout")}
              className={previewTab === "checkout" ? "text-foreground" : "text-muted-foreground"}
            >
              Checkout
            </button>
          </div>

          {previewTab === "product" ? (
            <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-4">
              {productImages.length > 0 ? (
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {productImages.slice(0, 3).map((image, index) => (
                    <img
                      key={`${image.name}-product-preview-${index}`}
                      src={image.dataUrl}
                      alt={`Product image ${index + 1}`}
                      className="h-20 w-full rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary" />
                <div>
                  <p className="text-sm font-semibold">{productName || "Untitled Product"}</p>
                  <p className="text-xs text-muted-foreground">{merchantName}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-white p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Get it for</p>
                <p className="mt-1 text-2xl font-semibold">{currency} {previewAmount.toFixed(2)}{paymentType === "subscription" ? ` / ${repeatUnit}` : ""}</p>
                <Button 
                  className="mt-4 w-full rounded-full bg-[#1f2530] text-white hover:bg-[#11151b]"
                  onClick={handleCreateCheckoutSession}
                  disabled={!merchantApiKey || !productName.trim() || previewAmount <= 0}
                >
                  Buy
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-4">
              <div className="mb-4 flex items-start justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f2530] text-white">
                    <BrandLogo className="h-4 w-4" />
                  </div>
                  <p className="text-base font-medium text-foreground">OpenPay</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Mode</p>
                  <p className="text-xl font-semibold text-foreground capitalize">{merchantMode}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                <div>
                  <p className="text-2xl font-semibold text-foreground">{productName || "Untitled Product"}</p>
                  <p className="mt-1 text-4xl font-bold text-paypal-blue">{currency} {previewAmount.toFixed(2)}</p>
                  <div className="mt-4 border-t border-dashed border-border pt-4 text-lg">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{currency} {previewAmount.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-muted-foreground">
                      <span>OpenPay fee (2%)</span>
                      <span>
                        {feePayer === "customer" ? `${currency} ${feeAmount.toFixed(2)} (customer)` : `${currency} ${feeAmount.toFixed(2)} (merchant)`}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between font-semibold text-foreground">
                      <span>Total due</span>
                      <span>{currency} {totalDue.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-border bg-white p-3 text-sm">
                    <p className="font-semibold text-foreground">Merchant details</p>
                    <p className="mt-1 text-muted-foreground">Name: {merchantName || "OpenPay Merchant"}</p>
                    <p className="text-muted-foreground">Username: @{merchantUsername || "merchant"}</p>
                    <p className="text-muted-foreground">Product: {productName || "Untitled Product"}</p>
                  </div>
                </div>
                <div>
                  <Button 
                    className="w-full rounded-full bg-[#1f2530] text-white hover:bg-[#11151b]"
                    onClick={handleCreateCheckoutSession}
                    disabled={!merchantApiKey || !productName.trim() || previewAmount <= 0}
                  >
                    Create Checkout Session
                  </Button>
                  {checkoutSession && (
                    <div className="mt-4 rounded-xl border border-border bg-white p-4 text-center">
                      <p className="text-sm font-semibold text-foreground">Checkout Session Created</p>
                      <p className="mt-2 text-xs text-muted-foreground">Session Token: {checkoutSession.session_token}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Total: {currency} {checkoutSession.total_amount.toFixed(2)}</p>
                      <Button
                        className="mt-3 w-full rounded-full"
                        variant="outline"
                        onClick={() => setShowCheckoutQr(!showCheckoutQr)}
                      >
                        {showCheckoutQr ? "Hide" : "Show"} QR Code
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* QR Code Modal */}
          {showCheckoutQr && checkoutSession && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Checkout QR Code</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowCheckoutQr(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex justify-center mb-4">
                  <QRCodeSVG
                    value={checkoutSession.checkout_url || `https://openpay.app/merchant-checkout?session=${checkoutSession.session_token}`}
                    size={200}
                    level="H"
                    includeMargin
                    imageSettings={{ src: "/openpay-logo.jpg", height: 32, width: 32, excavate: true }}
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Scan to pay {currency} {checkoutSession.total_amount.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchantProductCreatePageFixed;
