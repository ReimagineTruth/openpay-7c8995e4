import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import QrPayHeader from "@/components/qrpay/QrPayHeader";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound, Plus, Copy, Check, Trash2, Activity, Zap, AlertTriangle, Code2, BookOpen, Sparkles,
  ListOrdered, Link2, ShieldCheck, Terminal, FileText,
} from "lucide-react";
import {
  QR_PAY_API_BASE,
  QR_PAY_SITE,
  OPENLEDGER_SITE_DOCS,
  buildQrPayAiPrompt,
  buildQrPayApiReference,
  buildQrPayCurlSnippet,
  buildQrPayEnvSnippet,
  buildQrPayFullDocumentation,
  buildQrPayJsSnippet,
  buildQrPayNodeSnippet,
  buildQrPayPhpSnippet,
  buildQrPayPythonSnippet,
  buildQrPayQuickStart,
  buildQrPayReactSnippet,
  buildQrPayWebhookGuide,
} from "@/lib/qrPayApiIntegrationKit";

type ApiKey = {
  id: string; name: string; key_prefix: string; last4: string;
  scopes: string[]; is_active: boolean; last_used_at: string | null; created_at: string;
};

type Stats = {
  total_keys: number; active_keys: number; calls_24h: number; calls_7d: number;
  avg_latency_ms: number; error_rate: number;
  series: Array<{ day: string; calls: number }>;
};

type LogRow = {
  id: string; endpoint: string; method: string; status_code: number;
  qr_pay_token: string | null; latency_ms: number | null; created_at: string;
};

const CopyBtn = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm" variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true); setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
      {copied ? "Copied" : label}
    </Button>
  );
};

const CodeBlock = ({ code, lang }: { code: string; lang?: string }) => (
  <div className="relative group">
    <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-4 overflow-x-auto max-h-[520px] whitespace-pre-wrap break-words">
      <code>{code}</code>
    </pre>
    <div className="absolute top-2 right-2 flex gap-2 items-center">
      {lang && <Badge variant="secondary" className="text-[10px] uppercase">{lang}</Badge>}
      <CopyBtn text={code} />
    </div>
  </div>
);

/** Lightweight markdown for readable docs (headings, lists, tables, fences, inline). */
function DocMarkdown({ md }: { md: string }) {
  const nodes = useMemo(() => {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const out: ReactNode[] = [];
    let i = 0;
    let listBuf: string[] = [];
    let tableBuf: string[][] = [];

    const inline = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">$1</code>')
        .replace(
          /\[(.+?)\]\((.+?)\)/g,
          '<a class="text-[#0070BA] underline underline-offset-2" href="$2" target="_blank" rel="noreferrer">$1</a>',
        );

    const flushList = () => {
      if (!listBuf.length) return;
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
          {listBuf.map((li, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: inline(li) }} />
          ))}
        </ul>,
      );
      listBuf = [];
    };

    const flushTable = () => {
      if (!tableBuf.length) return;
      const rows = tableBuf.filter((r) => !r.every((c) => /^:?-+:?$/.test(c.trim())));
      if (!rows.length) {
        tableBuf = [];
        return;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={`tbl-${out.length}`} className="my-3 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="bg-slate-50 text-muted-foreground">
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} className="px-3 py-2 font-semibold" dangerouslySetInnerHTML={{ __html: inline(c.trim()) }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-t border-black/5">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-foreground/90" dangerouslySetInnerHTML={{ __html: inline(c.trim()) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      tableBuf = [];
    };

    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trimEnd();

      if (line.startsWith("```")) {
        flushList();
        flushTable();
        const lang = line.slice(3).trim();
        const buf: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith("```")) {
          buf.push(lines[i]);
          i += 1;
        }
        out.push(
          <div key={`code-${out.length}`} className="my-3">
            <CodeBlock code={buf.join("\n")} lang={lang || undefined} />
          </div>,
        );
        i += 1;
        continue;
      }

      if (/^\|/.test(line) && line.includes("|")) {
        flushList();
        tableBuf.push(line.split("|").slice(1, -1));
        i += 1;
        continue;
      }
      if (tableBuf.length) flushTable();

      if (/^[-*]{3,}\s*$/.test(line)) {
        flushList();
        out.push(<hr key={`hr-${out.length}`} className="my-6 border-black/10" />);
        i += 1;
        continue;
      }

      if (/^####\s+/.test(line)) {
        flushList();
        out.push(
          <h4 key={i} className="mt-4 mb-1 text-sm font-bold text-foreground" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^####\s+/, "")) }} />,
        );
        i += 1;
        continue;
      }
      if (/^###\s+/.test(line)) {
        flushList();
        out.push(
          <h3 key={i} className="mt-5 mb-2 text-base font-bold text-foreground" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^###\s+/, "")) }} />,
        );
        i += 1;
        continue;
      }
      if (/^##\s+/.test(line)) {
        flushList();
        out.push(
          <h2 key={i} className="mt-7 mb-2 border-b border-black/5 pb-1 text-lg font-bold text-foreground" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^##\s+/, "")) }} />,
        );
        i += 1;
        continue;
      }
      if (/^#\s+/.test(line)) {
        flushList();
        out.push(
          <h1 key={i} className="mt-2 mb-3 text-xl font-extrabold tracking-tight text-foreground" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^#\s+/, "")) }} />,
        );
        i += 1;
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        listBuf.push(line.replace(/^[-*]\s+/, ""));
        i += 1;
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        listBuf.push(line.replace(/^\d+\.\s+/, ""));
        i += 1;
        continue;
      }

      if (!line.trim()) {
        flushList();
        i += 1;
        continue;
      }

      flushList();
      out.push(
        <p key={i} className="my-2 text-sm leading-relaxed text-foreground/90" dangerouslySetInnerHTML={{ __html: inline(line) }} />,
      );
      i += 1;
    }

    flushList();
    flushTable();
    return out;
  }, [md]);

  return <div className="doc-md max-w-none">{nodes}</div>;
}

const Kpi = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </CardContent>
  </Card>
);

const Step = ({ n, title, body }: { n: number; title: string; body: string }) => (
  <div className="flex gap-3 rounded-2xl border border-black/5 bg-white/70 p-4">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0070BA] text-sm font-bold text-white">
      {n}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  </div>
);

export default function QrPayApiDashboardPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sampleToken, setSampleToken] = useState("QR_TOKEN");
  const [docsTab, setDocsTab] = useState<"read" | "raw">("read");

  const load = async () => {
    setLoading(true);
    const [{ data: k }, { data: l }, { data: s }, { data: pays }] = await Promise.all([
      supabase.from("qr_pay_api_keys").select("*").order("created_at", { ascending: false }),
      supabase.from("qr_pay_api_logs").select("id, endpoint, method, status_code, qr_pay_token, latency_ms, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.rpc("qr_pay_api_stats"),
      (supabase as any).from("qr_payments").select("token").order("created_at", { ascending: false }).limit(1),
    ]);
    setKeys((k as ApiKey[]) || []);
    setLogs((l as LogRow[]) || []);
    setStats((s as Stats) || null);
    if (Array.isArray(pays) && pays[0]?.token) setSampleToken(String(pays[0].token));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("qr_pay_api_create_key", { p_name: newKeyName });
    setCreating(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setNewSecret(row?.api_key || null);
    setNewKeyName("");
    await load();
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Revoke this API key? Apps using it will stop working.")) return;
    const { error } = await supabase.rpc("qr_pay_api_revoke_key", { p_id: id });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Key revoked" });
    load();
  };

  const sampleKey = useMemo(
    () => newSecret || (keys[0] ? `${keys[0].key_prefix}_••••••••${keys[0].last4}` : "qpk_live_YOUR_API_KEY"),
    [newSecret, keys],
  );

  const kitOpts = useMemo(
    () => ({
      site: QR_PAY_SITE,
      apiBase: QR_PAY_API_BASE,
      apiKey: sampleKey,
      qrToken: sampleToken,
      openLedgerSite: OPENLEDGER_SITE_DOCS,
    }),
    [sampleKey, sampleToken],
  );

  const snippets = useMemo(() => ({
    ai: buildQrPayAiPrompt(kitOpts),
    quick: buildQrPayQuickStart(kitOpts),
    ref: buildQrPayApiReference(kitOpts),
    full: buildQrPayFullDocumentation(kitOpts),
    webhook: buildQrPayWebhookGuide(kitOpts),
    env: buildQrPayEnvSnippet(kitOpts),
    curl: buildQrPayCurlSnippet(kitOpts),
    js: buildQrPayJsSnippet(kitOpts),
    node: buildQrPayNodeSnippet(kitOpts),
    react: buildQrPayReactSnippet(kitOpts),
    python: buildQrPayPythonSnippet(kitOpts),
    php: buildQrPayPhpSnippet(kitOpts),
  }), [kitOpts]);

  return (
    <div className="min-h-screen qrp-page-bg pb-24">
      <QrPayHeader
        eyebrow="OpenPay · Developers"
        title="QR Pay API"
        subtitle="Full documentation + copy-paste kit — connect any app (or AI) to OpenPay QR Pay in minutes."
        icon={Code2}
        backTo="/qr-pay"
        backLabel="Back to QR Pay"
        actions={
          <div className="flex flex-wrap gap-2">
            <CopyBtn text={snippets.full} label="Copy full docs" />
            <Button onClick={() => setShowCreate(true)} className="qrp-hero-cta rounded-full h-9 px-4">
              <Plus className="h-4 w-4 mr-1" /> New API key
            </Button>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={KeyRound} label="Active keys" value={stats?.active_keys ?? "—"} hint={`${stats?.total_keys ?? 0} total`} />
          <Kpi icon={Activity} label="Calls 24h" value={stats?.calls_24h ?? "—"} hint={`${stats?.calls_7d ?? 0} this week`} />
          <Kpi icon={Zap} label="Avg latency" value={`${stats?.avg_latency_ms ?? 0} ms`} />
          <Kpi icon={AlertTriangle} label="Error rate" value={`${stats?.error_rate ?? 0}%`} />
        </div>

        {/* Beginner steps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <ListOrdered className="h-5 w-5" /> Easy setup — 4 steps
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              No OAuth client id needed for QR Pay. Only an API key + a QR token.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Step n={1} title="Create a QR Pay link" body="QR Pay → New → copy the token from /qr-pay/YOUR_TOKEN" />
            <Step n={2} title="Create an API key here" body="Click + New API key. Copy qpk_live_… once — treat it like a password." />
            <Step n={3} title="Paste into your AI or code" body="Use Copy full docs or the AI prompt tab — Lovable, Cursor, Claude, ChatGPT." />
            <Step n={4} title="Verify with callbacks" body="Pass success_url on checkout-session, then GET /transactions/by-ref/{ref}." />
            <div className="md:col-span-2 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs">
              <Label className="shrink-0">Sample QR token</Label>
              <Input
                className="h-9 max-w-xs font-mono text-xs"
                value={sampleToken}
                onChange={(e) => setSampleToken(e.target.value.trim() || "QR_TOKEN")}
                placeholder="Paste a QR token"
              />
              <span className="text-muted-foreground">Snippets + docs below auto-fill this token + your key preview.</span>
            </div>
          </CardContent>
        </Card>

        {/* Full documentation */}
        <Card id="full-docs" className="border-[#0070BA]/20 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#0070BA]" /> Full documentation
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete API reference: auth, every endpoint, request/response schemas, return URLs, payment methods, OpenLedger, and security.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={docsTab === "read" ? "default" : "outline"}
                  className={docsTab === "read" ? "bg-[#0070BA] hover:bg-[#005ea6]" : ""}
                  onClick={() => setDocsTab("read")}
                >
                  Read
                </Button>
                <Button
                  size="sm"
                  variant={docsTab === "raw" ? "default" : "outline"}
                  className={docsTab === "raw" ? "bg-[#0070BA] hover:bg-[#005ea6]" : ""}
                  onClick={() => setDocsTab("raw")}
                >
                  Markdown
                </Button>
                <CopyBtn text={snippets.full} label="Copy all" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="font-mono">Base {QR_PAY_API_BASE}</Badge>
              <Badge variant="secondary" className="font-mono">Checkout {QR_PAY_SITE}/qr-pay/{"{token}"}</Badge>
              <Badge variant="secondary" className="font-mono">Ledger {OPENLEDGER_SITE_DOCS}/tx/ref/{"{ref}"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {docsTab === "read" ? (
              <div className="max-h-[720px] overflow-y-auto rounded-xl border border-black/5 bg-white/80 p-4 sm:p-6">
                <DocMarkdown md={snippets.ref} />
              </div>
            ) : (
              <CodeBlock code={snippets.full} lang="md" />
            )}
          </CardContent>
        </Card>

        {/* Keys */}
        <Card>
          <CardHeader><CardTitle className="text-foreground">API keys</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : keys.length === 0 ? (
              <div className="text-center py-8">
                <KeyRound className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No API keys yet. Create one to start integrating.</p>
                <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Create your first key</Button>
              </div>
            ) : (
              <div className="divide-y">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {k.name}
                        {k.is_active ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                                     : <Badge variant="secondary">Revoked</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {k.key_prefix}_••••••••{k.last4}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleString()}` : "Never used"}
                      </div>
                    </div>
                    {k.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integration kit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Integration kit — copy &amp; paste
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Drop into Lovable, Cursor, Bolt, Claude, ChatGPT, or any codebase. Auth header: <code>x-api-key</code>.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ai">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1" />AI prompt</TabsTrigger>
                <TabsTrigger value="quick">Quick start</TabsTrigger>
                <TabsTrigger value="env">.env</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="js">JavaScript</TabsTrigger>
                <TabsTrigger value="node">Node proxy</TabsTrigger>
                <TabsTrigger value="react">React</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="php">PHP</TabsTrigger>
                <TabsTrigger value="callback"><Link2 className="h-3.5 w-3.5 mr-1" />Callbacks</TabsTrigger>
                <TabsTrigger value="ref"><Terminal className="h-3.5 w-3.5 mr-1" />API reference</TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Paste this entire prompt into Lovable / Cursor / Claude / ChatGPT — it scaffolds checkout + verify + OpenLedger.
                </p>
                <CodeBlock code={snippets.ai} lang="prompt" />
              </TabsContent>
              <TabsContent value="quick"><CodeBlock code={snippets.quick} lang="md" /></TabsContent>
              <TabsContent value="env"><CodeBlock code={snippets.env} lang="env" /></TabsContent>
              <TabsContent value="curl"><CodeBlock code={snippets.curl} lang="bash" /></TabsContent>
              <TabsContent value="js"><CodeBlock code={snippets.js} lang="js" /></TabsContent>
              <TabsContent value="node"><CodeBlock code={snippets.node} lang="js" /></TabsContent>
              <TabsContent value="react"><CodeBlock code={snippets.react} lang="tsx" /></TabsContent>
              <TabsContent value="python"><CodeBlock code={snippets.python} lang="py" /></TabsContent>
              <TabsContent value="php"><CodeBlock code={snippets.php} lang="php" /></TabsContent>
              <TabsContent value="callback"><CodeBlock code={snippets.webhook} lang="md" /></TabsContent>
              <TabsContent value="ref"><CodeBlock code={snippets.ref} lang="md" /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card>
          <CardHeader><CardTitle className="text-foreground">Endpoints</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["GET", "/health", "Service status (public)"],
              ["GET", "/qr", "List your QR payments"],
              ["GET", "/qr/{token}", "Read one QR pay + line items"],
              ["GET", "/qr/{token}/checkout-url", "Hosted checkout URL"],
              ["POST", "/checkout-session", "Create checkout session (success_url / cancel_url)"],
              ["GET", "/transactions", "List your QR Pay transactions"],
              ["GET", "/transactions/{id}", "Verify by transaction UUID"],
              ["GET", "/transactions/by-ref/{ref}", "Verify by QRP-… reference"],
            ].map(([m, p, d]) => (
              <div key={p} className="flex items-center gap-3 py-1 border-b last:border-0">
                <Badge className={m === "GET" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>{m}</Badge>
                <code className="text-foreground font-mono text-xs">{p}</code>
                <span className="text-muted-foreground text-xs">{d}</span>
              </div>
            ))}
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div>Base URL: <code className="text-foreground">{QR_PAY_API_BASE}</code></div>
              <div>Hosted checkout: <code className="text-foreground">{QR_PAY_SITE}/qr-pay/{"{token}"}</code></div>
              <div>OpenLedger: <code className="text-foreground">{OPENLEDGER_SITE_DOCS}/tx/ref/{"{transaction_ref}"}</code></div>
              <div className="flex items-center gap-1.5 pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                QR Pay uses API key only. Partner OAuth client_id is optional (only for Sign in with OpenPay).
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader><CardTitle className="text-foreground">Recent requests</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API calls yet.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {logs.map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="text-[10px]">{l.method}</Badge>
                      <code className="text-foreground truncate">{l.endpoint || "/"}</code>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                      <span className={l.status_code >= 400 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>{l.status_code}</span>
                      <span>{l.latency_ms ?? 0}ms</span>
                      <span>{new Date(l.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 text-sm text-foreground">
            <p className="font-semibold mb-1">Security notes</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Treat keys like passwords — never commit them. Prefer a server/Node proxy.</li>
              <li>Each key is scoped to <strong>your</strong> QR payments only. Revoke anytime.</li>
              <li>Always verify payments with <code>/transactions/by-ref/{"{ref}"}</code> before fulfilling orders.</li>
              <li>Need Sign in with OpenPay? Use Partner API client id at <code>/partner-api</code> — not required for QR checkout.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setNewSecret(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newSecret ? "Save your API key" : "Create new API key"}</DialogTitle>
          </DialogHeader>
          {newSecret ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This is the only time you can copy this key. Store it somewhere safe.
              </p>
              <div className="bg-slate-950 text-emerald-300 p-3 rounded font-mono text-xs break-all">{newSecret}</div>
              <div className="flex justify-end gap-2">
                <CopyBtn text={newSecret} label="Copy key" />
                <Button onClick={() => { setNewSecret(null); setShowCreate(false); }}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Key name</Label>
                <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="My Shopify store / Lovable app" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                  {creating ? "Creating…" : "Create key"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
