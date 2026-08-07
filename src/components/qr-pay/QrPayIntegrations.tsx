import { useMemo, useState } from "react";
import { Code2, Copy, Monitor, QrCode, Layers, Globe, Sparkles, Play } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
import {
  OPENPAY_BTN_STYLES,
  OPENPAY_BTN_THEMES,
  OpenPayStyledButton,
  OpenPayWordmark,
  defaultBtnStyleForPayment,
  getOpenPayBtnTheme,
  openPayButtonHtml,
  type OpenPayBtnStyle,
  type OpenPayBtnTheme,
} from "@/components/qr-pay/OpenPayPayButton";

interface Props {
  url: string;
  amount: number;
  currency: string;
  title?: string;
  paymentType?: string;
  hideQrTab?: boolean;
  compactHeader?: boolean;
}

const copy = (text: string, label = "Copied") => {
  navigator.clipboard.writeText(text).then(() => toast.success(label)).catch(() => toast.error("Copy failed"));
};

const CodeBlock = ({ code, lang = "html" }: { code: string; lang?: string }) => (
  <div className="relative overflow-hidden rounded-lg border bg-muted/60">
    <div className="flex items-center justify-between border-b bg-muted/80 px-3 py-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{lang}</span>
      <button type="button" onClick={() => copy(code, "Code copied")} className="text-muted-foreground hover:text-foreground">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
    <pre className="max-h-72 overflow-x-auto whitespace-pre p-3 text-[12px] sm:text-[13px]">{code}</pre>
  </div>
);

export default function QrPayIntegrations({
  url,
  amount,
  currency,
  title,
  paymentType,
  hideQrTab = false,
  compactHeader = false,
}: Props) {
  const [tab, setTab] = useState("button");
  const [btnStyle, setBtnStyle] = useState<OpenPayBtnStyle>(() => defaultBtnStyleForPayment(paymentType));
  const [btnTheme, setBtnTheme] = useState<OpenPayBtnTheme>("black");

  const label = title || "Pay with OpenPay";
  const priceLabel = `${currency} ${amount.toFixed(2)}`;
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  const logoWhite = typeof window !== "undefined"
    ? `${window.location.origin}/openpay-o-white.svg`
    : "/openpay-o-white.svg";
  const logoColor = typeof window !== "undefined"
    ? `${window.location.origin}/openpay-o.svg`
    : "/openpay-o.svg";
  const themeMeta = getOpenPayBtnTheme(btnTheme);
  const logoUrl = themeMeta.wordVariant === "white" ? logoWhite : logoColor;
  const embedFont =
    "'Plus Jakarta Sans','SF Pro Display','SF Pro Text',-apple-system,BlinkMacSystemFont,system-ui,sans-serif";

  const previewShellClass = themeMeta.previewDark
    ? "rounded-2xl border border-black/8 bg-zinc-900 p-5 text-center sm:p-6"
    : "rounded-2xl border border-black/5 bg-zinc-100 p-5 text-center sm:p-6";
  const previewLabelClass = themeMeta.previewDark
    ? "mb-3 text-xs font-semibold uppercase tracking-wide text-white/55"
    : "mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const previewHintClass = themeMeta.previewDark
    ? "mt-3 text-[13px] text-white/60"
    : "mt-3 text-[13px] text-muted-foreground";

  const buttonHtml = useMemo(
    () => openPayButtonHtml({ url, logoUrl, style: btnStyle, theme: btnTheme }),
    [url, logoUrl, btnStyle, btnTheme],
  );

  const snippets = useMemo(() => ({
    button: buttonHtml,
    iframe: `<!-- OpenPay iFrame Checkout -->
<iframe
  src="${url}"
  width="100%"
  height="700"
  frameborder="0"
  style="border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.1);max-width:480px;"
  title="OpenPay Checkout"
  allow="payment">
</iframe>`,
    qr: `<!-- OpenPay QR Code -->
<div style="text-align:center;padding:20px;background:#f5f5f7;border-radius:16px;display:inline-block;font-family:${embedFont};">
  <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">
    <img src="${logoColor}" alt="OpenPay" width="20" height="20" />
    <span style="font-size:15px;font-weight:600;color:#1d1d1f;">Scan to Pay</span>
  </div>
  <img src="${qrImg}" alt="Pay with OpenPay" style="border-radius:12px;background:#fff;padding:8px;" />
  <p style="margin:12px 0 0;color:#86868b;font-size:14px;font-weight:600;">${priceLabel}</p>
</div>`,
    widget: `<!-- OpenPay Complete Widget -->
<div style="max-width:380px;margin:0 auto;background:rgba(255,255,255,.92);
            border-radius:20px;padding:24px;text-align:center;
            font-family:${embedFont};
            box-shadow:0 0 0 1px rgba(0,0,0,.05),0 16px 40px -24px rgba(0,0,0,.28);">
  <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
    <img src="${logoColor}" alt="OpenPay" width="20" height="20" />
    <span style="font-size:13px;font-weight:600;color:#86868b;">OpenPay</span>
  </div>
  <h2 style="margin:0 0 16px;color:#1d1d1f;font-size:17px;font-weight:600;letter-spacing:-0.02em;">${label}</h2>
  <div style="background:#f5f5f7;border-radius:12px;padding:16px;margin-bottom:16px;">
    <div style="font-size:13px;color:#86868b;">Total</div>
    <div style="font-size:28px;font-weight:800;color:#1d1d1f;letter-spacing:-0.04em;">${priceLabel}</div>
  </div>
  ${buttonHtml}
  <p style="margin:12px 0 0;font-size:13px;color:#86868b;">Secure checkout</p>
</div>`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${label}</title>
</head>
<body style="font-family:${embedFont};background:#f5f5f7;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;
              padding:32px;box-shadow:0 0 0 1px rgba(0,0,0,.05),0 16px 40px -24px rgba(0,0,0,.22);">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <img src="${logoColor}" alt="OpenPay" width="28" height="28" />
      <span style="font-size:15px;font-weight:600;color:#86868b;">OpenPay</span>
    </div>
    <h1 style="color:#1d1d1f;margin:0 0 8px;font-size:22px;letter-spacing:-0.02em;">${label}</h1>
    <p style="color:#86868b;margin:0 0 24px;font-size:15px;">Complete your purchase securely with OpenPay.</p>
    <div style="background:#f5f5f7;border-radius:14px;padding:20px;text-align:center;margin-bottom:20px;">
      <div style="font-size:14px;color:#86868b;">Amount Due</div>
      <div style="font-size:36px;font-weight:800;color:#1d1d1f;letter-spacing:-0.04em;">${priceLabel}</div>
    </div>
    <div style="text-align:center;">
      ${buttonHtml}
    </div>
    <p style="text-align:center;margin:16px 0 0;font-size:13px;color:#86868b;">
      Secured by OpenPay
    </p>
  </div>
</body>
</html>`,
  }), [buttonHtml, url, label, priceLabel, qrImg, logoColor, embedFont]);

  return (
    <div className="qrp-card space-y-4 p-4 sm:p-5">
      {!compactHeader && (
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--qrp-accent)]" />
          <div>
            <h3 className="text-[16px] font-semibold tracking-[-0.01em]">Website & apps</h3>
            <p className="text-[13px] text-muted-foreground">Embed OpenPay on your site, store, or app</p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={cn("grid h-auto w-full", hideQrTab ? "grid-cols-4" : "grid-cols-5")}>
          <TabsTrigger value="button" className="flex-col gap-1 py-2.5 text-[11px] sm:text-[12px]"><Code2 className="h-4 w-4"/>Button</TabsTrigger>
          <TabsTrigger value="iframe" className="flex-col gap-1 py-2.5 text-[11px] sm:text-[12px]"><Monitor className="h-4 w-4"/>iFrame</TabsTrigger>
          {!hideQrTab && (
            <TabsTrigger value="qr" className="flex-col gap-1 py-2.5 text-[11px] sm:text-[12px]"><QrCode className="h-4 w-4"/>QR Code</TabsTrigger>
          )}
          <TabsTrigger value="widget" className="flex-col gap-1 py-2.5 text-[11px] sm:text-[12px]"><Layers className="h-4 w-4"/>Widget</TabsTrigger>
          <TabsTrigger value="html" className="flex-col gap-1 py-2.5 text-[11px] sm:text-[12px]"><Globe className="h-4 w-4"/>HTML</TabsTrigger>
        </TabsList>

        <TabsContent value="button" className="space-y-4 pt-4">
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--qrp-ink)]">
              Button design
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground sm:text-[14px]">
              Apple Pay-style: logo + OpenPay name. Pick a label for your checkout.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OPENPAY_BTN_STYLES.map((s) => {
              const on = btnStyle === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setBtnStyle(s.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-all",
                    on
                      ? "border-[var(--qrp-ink)] bg-[var(--qrp-ink)] text-white shadow-sm"
                      : "border-black/8 bg-black/[0.04] text-[var(--qrp-ink)] hover:bg-black/[0.06]",
                  )}
                >
                  <div className="text-[14px] font-semibold sm:text-[15px]">{s.label}</div>
                  <div className={cn("mt-0.5 text-[12px] leading-snug sm:text-[13px]", on ? "text-white/75" : "text-muted-foreground")}>
                    {s.hint}
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <p className="mb-2 text-[14px] font-semibold">Color</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {OPENPAY_BTN_THEMES.map((t) => {
                const on = btnTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setBtnTheme(t.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[14px] font-semibold transition-all sm:text-[15px]",
                      on
                        ? "border-[var(--qrp-accent)] bg-[var(--qrp-accent)]/10 text-[var(--qrp-ink)]"
                        : "border-black/8 bg-black/[0.04]",
                    )}
                  >
                    <span className={cn("h-5 w-5 shrink-0 rounded-full", t.swatch)} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={previewShellClass}>
            <div className={previewLabelClass}>Live preview</div>
            <OpenPayStyledButton href={url} style={btnStyle} theme={btnTheme} />
            <p className={previewHintClass}>
              Customers see the OpenPay logo and name - like Apple Pay.
            </p>
          </div>

          <CodeBlock code={snippets.button} lang="html" />
        </TabsContent>

        <TabsContent value="iframe" className="space-y-3 pt-4">
          <p className="text-[14px] text-muted-foreground">Embed the full checkout inside your page or WebView.</p>
          <CodeBlock code={snippets.iframe} lang="html" />
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</div>
            <iframe src={url} title="OpenPay preview" className="h-[420px] w-full rounded-lg bg-white" />
          </div>
        </TabsContent>

        {!hideQrTab && (
          <TabsContent value="qr" className="space-y-3 pt-4">
            <p className="text-[14px] text-muted-foreground">Perfect for posters, receipts, and physical locations.</p>
            <CodeBlock code={snippets.qr} lang="html" />
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</div>
              <div className="mb-2 flex items-center justify-center gap-2">
                <BrandLogo animate={false} className="h-5 w-5" />
                <span className="text-[15px] font-semibold">Scan to Pay</span>
              </div>
              <div className="inline-block rounded-xl bg-white p-3"><QRCodeSVG value={url} size={160} /></div>
              <div className="mt-2 text-[15px] font-semibold text-[var(--qrp-ink)]">{priceLabel}</div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="widget" className="space-y-3 pt-4">
          <p className="text-[14px] text-muted-foreground">
            Drop-in widget using your selected button style ({OPENPAY_BTN_STYLES.find((s) => s.id === btnStyle)?.hint}).
          </p>
          <CodeBlock code={snippets.widget} lang="html" />
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</div>
            <div className="qrp-pay-sheet mx-auto max-w-xs p-5 text-center">
              <div className="flex items-center justify-center">
                <OpenPayWordmark variant="color" logoClassName="h-[18px] w-[18px]" textClassName="text-[14px] text-[var(--qrp-muted)]" />
              </div>
              <h2 className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-[var(--qrp-ink)]">{label}</h2>
              <div className="my-4 text-[28px] font-semibold tracking-[-0.04em] text-[var(--qrp-ink)]">{priceLabel}</div>
              <OpenPayStyledButton href={url} style={btnStyle} theme={btnTheme} className="w-full" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="html" className="space-y-3 pt-4">
          <p className="text-[14px] text-muted-foreground">Complete ready-to-deploy HTML page with your chosen OpenPay button.</p>
          <CodeBlock code={snippets.html} lang="html" />
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl text-[14px] font-semibold"
            onClick={() => {
              const blob = new Blob([snippets.html], { type: "text/html" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "openpay-checkout.html";
              a.click();
            }}
          >
            <Play className="mr-1 h-4 w-4" />Download HTML file
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
