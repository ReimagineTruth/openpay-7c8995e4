import { useMemo, useState } from "react";
import { Code2, Copy, Monitor, QrCode, Layers, Globe, Sparkles, Play } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  amount: number;
  currency: string;
  title?: string;
}

const copy = (text: string, label = "Copied") => {
  navigator.clipboard.writeText(text).then(() => toast.success(label)).catch(() => toast.error("Copy failed"));
};

const CodeBlock = ({ code, lang = "html" }: { code: string; lang?: string }) => (
  <div className="relative rounded-lg border bg-muted/60 overflow-hidden">
    <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/80">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">{lang}</span>
      <button onClick={() => copy(code, "Code copied")} className="text-muted-foreground hover:text-foreground">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
    <pre className="p-3 text-xs overflow-x-auto whitespace-pre max-h-72">{code}</pre>
  </div>
);

export default function QrPayIntegrations({ url, amount, currency, title }: Props) {
  const [tab, setTab] = useState("button");
  const label = title || "Pay with OpenPay";
  const priceLabel = `${currency} ${amount.toFixed(2)}`;
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  const snippets = useMemo(() => ({
    button: `<!-- OpenPay Payment Button -->
<a href="${url}" target="_blank"
   style="display:inline-block;background:#1d1d1f;
          color:#fff;padding:14px 28px;border-radius:14px;text-decoration:none;
          font-weight:600;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif;
          box-shadow:0 8px 20px -10px rgba(0,0,0,.45);letter-spacing:-0.01em;">
  ${label} — ${priceLabel}
</a>`,
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
<div style="text-align:center;padding:20px;background:#f8fafc;border-radius:16px;display:inline-block;font-family:system-ui;">
  <h3 style="margin:0 0 12px;color:#003087;">Scan to Pay</h3>
  <img src="${qrImg}" alt="Pay with OpenPay" style="border-radius:12px;background:#fff;padding:8px;" />
  <p style="margin:12px 0 0;color:#64748b;font-size:13px;">${priceLabel}</p>
</div>`,
    widget: `<!-- OpenPay Complete Widget -->
<div style="max-width:380px;margin:0 auto;background:linear-gradient(135deg,#e6f0ff,#fff);
            border-radius:20px;padding:24px;text-align:center;font-family:system-ui;
            box-shadow:0 8px 24px rgba(0,112,186,.15);">
  <h2 style="margin:0 0 4px;color:#003087;">${label}</h2>
  <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Powered by OpenPay</p>
  <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;">
    <div style="font-size:13px;color:#64748b;">Total</div>
    <div style="font-size:28px;font-weight:800;color:#0070ba;">${priceLabel}</div>
  </div>
  <a href="${url}" target="_blank"
     style="display:block;background:#0070ba;color:#fff;padding:14px;
            border-radius:12px;text-decoration:none;font-weight:700;">
    Pay Now →
  </a>
  <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">🔒 Secure checkout</p>
</div>`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${label}</title>
</head>
<body style="font-family:system-ui;background:#f8fafc;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;
              padding:32px;box-shadow:0 8px 24px rgba(0,0,0,.08);">
    <h1 style="color:#003087;margin:0 0 8px;">${label}</h1>
    <p style="color:#64748b;margin:0 0 24px;">Complete your purchase securely with OpenPay.</p>
    <div style="background:#f0f6ff;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
      <div style="font-size:14px;color:#64748b;">Amount Due</div>
      <div style="font-size:36px;font-weight:800;color:#0070ba;">${priceLabel}</div>
    </div>
    <a href="${url}" target="_blank"
       style="display:block;background:linear-gradient(135deg,#0070ba,#003087);
              color:#fff;text-align:center;padding:16px;border-radius:12px;
              text-decoration:none;font-weight:700;font-size:16px;">
      💳 Pay with OpenPay
    </a>
    <p style="text-align:center;margin:16px 0 0;font-size:12px;color:#94a3b8;">
      🔒 Secured by OpenPay
    </p>
  </div>
</body>
</html>`,
  }), [url, label, priceLabel, qrImg]);

  const PreviewButton = (
    <a href={url} target="_blank" rel="noreferrer"
       className="inline-block rounded-[14px] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)]"
       style={{ background: "#1d1d1f" }}>
      {label} — {priceLabel}
    </a>
  );

  const PreviewWidget = (
    <div className="qrp-pay-sheet mx-auto max-w-xs p-5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--qrp-muted,#86868b)]">OpenPay</p>
      <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[var(--qrp-ink,#1d1d1f)]">{label}</h2>
      <div className="my-4 text-[28px] font-semibold tracking-[-0.04em] text-[var(--qrp-ink,#1d1d1f)]">{priceLabel}</div>
      <a href={url} target="_blank" rel="noreferrer"
         className="block rounded-[14px] bg-[var(--qrp-ink,#1d1d1f)] py-3.5 text-[15px] font-semibold text-white">Pay Now</a>
    </div>
  );

  return (
    <div className="qrp-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--qrp-accent,#0071e3)]" />
        <div>
          <h3 className="font-semibold tracking-[-0.01em]">Choose Your Integration</h3>
          <p className="text-xs text-muted-foreground">Add OpenPay to your website in seconds</p>
        </div>
      </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full h-auto">
            <TabsTrigger value="button" className="flex-col gap-1 py-2 text-[10px]"><Code2 className="h-4 w-4"/>Button</TabsTrigger>
            <TabsTrigger value="iframe" className="flex-col gap-1 py-2 text-[10px]"><Monitor className="h-4 w-4"/>iFrame</TabsTrigger>
            <TabsTrigger value="qr" className="flex-col gap-1 py-2 text-[10px]"><QrCode className="h-4 w-4"/>QR Code</TabsTrigger>
            <TabsTrigger value="widget" className="flex-col gap-1 py-2 text-[10px]"><Layers className="h-4 w-4"/>Widget</TabsTrigger>
            <TabsTrigger value="html" className="flex-col gap-1 py-2 text-[10px]"><Globe className="h-4 w-4"/>HTML</TabsTrigger>
          </TabsList>

          <TabsContent value="button" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Beautiful, responsive payment button — works everywhere.</p>
            <CodeBlock code={snippets.button} lang="html"/>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <div className="text-[10px] uppercase text-muted-foreground mb-2">Live Preview</div>
              {PreviewButton}
            </div>
          </TabsContent>

          <TabsContent value="iframe" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Embed the full checkout inside your page.</p>
            <CodeBlock code={snippets.iframe} lang="html"/>
            <div className="rounded-lg border bg-muted/30 p-2">
              <div className="text-[10px] uppercase text-muted-foreground mb-2 text-center">Live Preview</div>
              <iframe src={url} title="OpenPay preview" className="w-full h-[420px] rounded-lg bg-white" />
            </div>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Perfect for posters, receipts, and physical locations.</p>
            <CodeBlock code={snippets.qr} lang="html"/>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <div className="text-[10px] uppercase text-muted-foreground mb-2">Live Preview</div>
              <div className="inline-block bg-white p-3 rounded-xl"><QRCodeSVG value={url} size={160}/></div>
              <div className="mt-2 font-bold text-paypal-blue">{priceLabel}</div>
            </div>
          </TabsContent>

          <TabsContent value="widget" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">A fully styled, drop-in payment widget.</p>
            <CodeBlock code={snippets.widget} lang="html"/>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-[10px] uppercase text-muted-foreground mb-2 text-center">Live Preview</div>
              {PreviewWidget}
            </div>
          </TabsContent>

          <TabsContent value="html" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Complete ready-to-deploy HTML page.</p>
            <CodeBlock code={snippets.html} lang="html"/>
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              const blob = new Blob([snippets.html], { type: "text/html" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "openpay-checkout.html";
              a.click();
            }}><Play className="h-3 w-3 mr-1"/>Download HTML file</Button>
          </TabsContent>
        </Tabs>
    </div>
  );
}
