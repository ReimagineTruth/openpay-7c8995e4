import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Code2,
  Copy,
  FlaskConical,
  Globe,
  ExternalLink,
  RefreshCw,
  BookOpen,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type App = {
  id: string;
  app_name: string;
  app_public_key: string;
  app_secret_key: string;
};

type Plan = { id: string; plan_name: string; amount: number; currency: string };
type Link = { id: string; link_token: string; link_name: string; payment_url?: string };

type Env = "testnet" | "live";

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "";

const copy = async (text: string, label = "Copied") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Copy failed");
  }
};

const CodeBlock = ({ code, lang = "bash" }: { code: string; lang?: string }) => (
  <div className="relative rounded-lg border border-border bg-muted/60 overflow-hidden">
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/80">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">{lang}</span>
      <button
        onClick={() => copy(code, "Code copied")}
        className="text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
    <pre className="p-3 text-xs overflow-x-auto text-foreground font-mono whitespace-pre">
      {code}
    </pre>
  </div>
);

export default function IntegrationPreview({
  app,
  plans,
  paymentLinks,
}: {
  app: App;
  plans: Plan[];
  paymentLinks: Link[];
}) {
  const [env, setEnv] = useState<Env>("testnet");
  const [iframeKey, setIframeKey] = useState(0);

  const baseUrl =
    env === "live"
      ? "https://openpyv1.lovable.app"
      : typeof window !== "undefined"
      ? window.location.origin
      : "";

  const previewToken = paymentLinks[0]?.link_token;
  const previewUrl = previewToken
    ? `${baseUrl}/app-payment/checkout?token=${previewToken}&env=${env}`
    : "";
  const embedUrl = previewToken
    ? `${baseUrl}/app-payment/checkout?token=${previewToken}&env=${env}&embed=1`
    : "";

  const samplePlan = plans[0];
  const apiBase = `${SUPABASE_URL}/functions/v1/app-payments`;

  const snippets = useMemo(() => {
    const pub = app.app_public_key || "opk_xxx";
    const sec = app.app_secret_key || "osk_xxx";
    const planId = samplePlan?.id || "PLAN_ID";
    const amount = samplePlan?.amount ?? 9.99;
    const currency = samplePlan?.currency || "OUSD";
    const tokenForEmbed = previewToken || "LINK_TOKEN";

    return {
      install: `# Install the OpenPay JS SDK
npm install @openpay/js
# or via CDN
<script src="https://openpyv1.lovable.app/openpay.js"></script>`,
      init: `// Initialize OpenPay in your app
import { OpenPay } from "@openpay/js";

const openpay = new OpenPay({
  publicKey: "${pub}",
  environment: "${env}", // "testnet" | "live"
});`,
      button: `<!-- Add a Pay with OpenPay button -->
<button id="openpay-btn">Pay ${currency} ${amount}</button>

<script>
  document.getElementById("openpay-btn").onclick = async () => {
    const session = await openpay.createCheckout({
      planId: "${planId}",
      successUrl: window.location.origin + "/success",
      cancelUrl: window.location.origin + "/cancel",
    });
    window.location.href = session.checkout_url;
  };
</script>`,
      server: `// Server-side: create a checkout link (Node.js)
const res = await fetch("${apiBase}/create-payment-link", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${sec}",
    "x-environment": "${env}",
  },
  body: JSON.stringify({
    app_id: "${app.id}",
    plan_id: "${planId}",
    link_name: "Checkout for Order #123",
    redirect_url: "https://yourapp.com/success",
  }),
});
const { data } = await res.json();
console.log("Checkout URL:", data.payment_url);`,
      webhook: `// Receive payment events at your webhook URL
// POST {your_webhook_url}
{
  "event": "payment.succeeded",
  "environment": "${env}",
  "app_id": "${app.id}",
  "data": {
    "transaction_id": "txn_...",
    "plan_id": "${planId}",
    "amount": ${amount},
    "currency": "${currency}",
    "user_id": "uuid",
    "status": "completed"
  },
  "signature": "sha256=..."
}

// Verify signature using your secret key (${sec.slice(0, 8)}...)`,
      embedIframe: `<!-- Drop-in OpenPay checkout (iframe) -->
<iframe
  src="${baseUrl}/app-payment/checkout?token=${tokenForEmbed}&env=${env}&embed=1"
  style="width:100%;max-width:900px;height:780px;border:0;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.08);"
  allow="payment"
  title="Pay with OpenPay">
</iframe>`,
      embedJs: `<!-- OpenPay embed + parent-window event listener -->
<div id="openpay-checkout" style="width:100%;max-width:900px;margin:0 auto;"></div>

<script>
  (function () {
    var token = "${tokenForEmbed}"; // generated server-side per order
    var env = "${env}";              // "testnet" | "live"

    var iframe = document.createElement("iframe");
    iframe.src = "${baseUrl}/app-payment/checkout?token=" + token + "&env=" + env + "&embed=1";
    iframe.style.cssText = "width:100%;height:780px;border:0;border-radius:16px;";
    iframe.allow = "payment";
    iframe.title = "Pay with OpenPay";
    document.getElementById("openpay-checkout").appendChild(iframe);

    window.addEventListener("message", function (e) {
      if (!e.data || e.data.source !== "openpay-checkout") return;
      if (e.data.type === "payment_success") {
        console.log("Payment success:", e.data.transaction_id);
        // TODO: confirm on your server using transaction_id + webhook
      } else if (e.data.type === "payment_error") {
        console.warn("Payment error:", e.data.error);
      }
    });
  })();
</script>`,
      embedReact: `// React component — drop-in OpenPay checkout
import { useEffect } from "react";

export function OpenPayCheckout({ token, env = "${env}", onSuccess, onError }) {
  useEffect(() => {
    const handler = (e) => {
      if (!e.data || e.data.source !== "openpay-checkout") return;
      if (e.data.type === "payment_success") onSuccess?.(e.data.transaction_id);
      if (e.data.type === "payment_error")   onError?.(e.data.error);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSuccess, onError]);

  return (
    <iframe
      src={\`${baseUrl}/app-payment/checkout?token=\${token}&env=\${env}&embed=1\`}
      title="Pay with OpenPay"
      allow="payment"
      style={{ width: "100%", maxWidth: 900, height: 780, border: 0, borderRadius: 16 }}
    />
  );
}`,
    };
  }, [app, samplePlan, env, apiBase, baseUrl, previewToken]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Integration & Live Preview
          </h3>
          <p className="text-sm text-muted-foreground">
            Set up OpenPay in your app and preview the checkout in testnet or live mode.
          </p>
        </div>

        {/* Env Switch */}
        <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
          <button
            onClick={() => { setEnv("testnet"); setIframeKey(k => k + 1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              env === "testnet"
                ? "bg-amber-100 text-amber-700 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Testnet
          </button>
          <button
            onClick={() => { setEnv("live"); setIframeKey(k => k + 1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              env === "live"
                ? "bg-emerald-100 text-emerald-700 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Live
          </button>
        </div>
      </div>

      {/* Env banner */}
      <div
        className={`rounded-lg border p-3 text-xs ${
          env === "testnet"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {env === "testnet" ? (
          <>
            <strong>Testnet mode</strong> — use test wallets and sandbox keys. No real
            OUSD is moved. Safe for development.
          </>
        ) : (
          <>
            <strong>Live mode</strong> — real OUSD balances will be charged. Make sure
            your app and webhook URLs are production-ready.
          </>
        )}
      </div>

      {/* Steps + Snippets */}
      <Tabs defaultValue="quickstart">
        <TabsList className="w-full justify-start overflow-x-auto bg-muted/40">
          <TabsTrigger value="quickstart">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Quick Start
          </TabsTrigger>
          <TabsTrigger value="button">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            Checkout Button
          </TabsTrigger>
          <TabsTrigger value="server">Server SDK</TabsTrigger>
          <TabsTrigger value="webhook">Webhooks</TabsTrigger>
          <TabsTrigger value="embed">
            <Code2 className="h-3.5 w-3.5 mr-1.5" />
            Embed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quickstart" className="space-y-4 pt-4">
          <Step n={1} title="Install the SDK">
            <CodeBlock code={snippets.install} lang="bash" />
          </Step>
          <Step n={2} title="Initialize with your public key">
            <CodeBlock code={snippets.init} lang="javascript" />
          </Step>
          <Step n={3} title="Add a Pay button">
            <p className="text-xs text-muted-foreground mb-2">
              Use any of your payment plans below. See "Checkout Button" tab for the full snippet.
            </p>
          </Step>
          <Step n={4} title="Test in sandbox, then go live">
            <p className="text-xs text-muted-foreground">
              Toggle the switch above to view the live preview on the right.
              When ready, change <code className="bg-muted px-1 rounded">environment: "testnet"</code> to{" "}
              <code className="bg-muted px-1 rounded">"live"</code> in your code.
            </p>
          </Step>
        </TabsContent>

        <TabsContent value="button" className="pt-4">
          <CodeBlock code={snippets.button} lang="html" />
        </TabsContent>

        <TabsContent value="server" className="pt-4">
          <CodeBlock code={snippets.server} lang="javascript" />
        </TabsContent>

        <TabsContent value="webhook" className="pt-4">
          <CodeBlock code={snippets.webhook} lang="json" />
        </TabsContent>

        <TabsContent value="embed" className="space-y-4 pt-4">
          <div className="rounded-lg border border-paypal-blue/30 bg-paypal-blue/5 p-3 text-xs text-foreground">
            <strong>Drop-in checkout.</strong> Embed OpenPay directly inside your site or app — no redirect, no SDK required. Listen for{" "}
            <code className="bg-muted px-1 rounded">window.postMessage</code> events to know when a payment succeeds.
          </div>

          {embedUrl && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(embedUrl, "Embed URL copied")}>
                <Copy className="h-3 w-3 mr-1" /> Copy embed URL
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(embedUrl, "_blank")}>
                <ExternalLink className="h-3 w-3 mr-1" /> Open in new tab
              </Button>
              <code className="text-[11px] text-muted-foreground font-mono truncate max-w-full">
                {embedUrl}
              </code>
            </div>
          )}

          <Step n={1} title="Paste the iframe into your page">
            <CodeBlock code={snippets.embedIframe} lang="html" />
          </Step>
          <Step n={2} title="Or use the JS snippet with success/error events">
            <CodeBlock code={snippets.embedJs} lang="html" />
          </Step>
          <Step n={3} title="React component (drop-in)">
            <CodeBlock code={snippets.embedReact} lang="tsx" />
          </Step>

          <p className="text-xs text-muted-foreground">
            Events sent to the parent window:{" "}
            <code className="bg-muted px-1 rounded">{"{ source: 'openpay-checkout', type: 'payment_success', transaction_id }"}</code>{" "}
            and{" "}
            <code className="bg-muted px-1 rounded">{"{ type: 'payment_error', error }"}</code>.
            Always verify the transaction server-side via your webhook before fulfilling the order.
          </p>
        </TabsContent>
      </Tabs>

      {/* Live preview frame */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">
            Checkout Preview ({env})
          </h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIframeKey((k) => k + 1)}
              disabled={!previewUrl}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reload
            </Button>
            {previewUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(previewUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/60">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-muted-foreground font-mono truncate">
              {previewUrl || "Create a payment link to preview your checkout"}
            </span>
          </div>
          {previewUrl ? (
            <iframe
              key={iframeKey}
              src={previewUrl}
              title="Checkout preview"
              className="w-full h-[560px] bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center px-6">
              <CreditCard className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">No payment link yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a plan and payment link above to preview your checkout page here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paypal-blue/10 text-paypal-blue text-xs font-bold">
        {n}
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}
