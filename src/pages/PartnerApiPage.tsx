import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Power,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildOpenPayLovablePrompt } from "@/lib/openpayPartnerLovablePrompt";
import { cn } from "@/lib/utils";

type PartnerApp = {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  redirect_uris: string[];
};

type PortalTab = "setup" | "apps" | "auth" | "transfers" | "paybutton" | "lovable" | "reference";

/** Public OpenPay domain for all third-party docs & redirects (never lovable.app). */
const SITE = "https://openpy.space";
const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-transfer-api`;
const AUTH_DOCS = `${SITE}/openpay-auth`;
const PORTAL_DOCS = `${SITE}/partner-api`;

const copyText = (text: string, label = "Copied") => {
  navigator.clipboard.writeText(text);
  toast.success(label);
};

const CodeBlock = ({ children }: { children: string }) => (
  <div className="group relative">
    <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
      <code>{children}</code>
    </pre>
    <button
      type="button"
      onClick={() => copyText(children)}
      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white opacity-0 transition hover:bg-white/20 group-hover:opacity-100"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  </div>
);

const FieldLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{children}</p>
);

function RedirectUrisEditor({ app, onSaved }: { app: PartnerApp; onSaved: () => void }) {
  const [value, setValue] = useState((app.redirect_uris || []).join("\n"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue((app.redirect_uris || []).join("\n"));
  }, [app.id, app.redirect_uris]);

  async function save() {
    const uris = value
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const u of uris) {
      try {
        new URL(u);
      } catch {
        return toast.error(`Invalid URL: ${u}`);
      }
    }
    setSaving(true);
    const { error } = await supabase.from("partner_apps").update({ redirect_uris: uris }).eq("id", app.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Redirect URIs saved");
    onSaved();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#1652f0]/20 bg-[#1652f0]/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Link2 className="h-4 w-4 text-[#1652f0]" />
            Connect with OpenPay — redirect URIs
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Exact callback URLs only (scheme + host + path). Required for Sign in with OpenPay.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {(app.redirect_uris || []).length} URI{(app.redirect_uris || []).length === 1 ? "" : "s"}
        </Badge>
      </div>
      <Textarea
        rows={3}
        placeholder={"https://yourapp.com/auth/openpay/callback\nhttps://staging.yourapp.com/auth/openpay/callback"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">One URL per line · must match your app callback exactly</p>
        <Button size="sm" className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save URIs"}
        </Button>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  hint,
  mono = true,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-start gap-2">
        <code className={cn("flex-1 break-all text-xs text-slate-800", mono && "font-mono")}>{value}</code>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => copyText(value, `${label} copied`)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      {hint ? <p className="mt-2 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function PartnerApiPageInner() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<PortalTab>("setup");
  const [apps, setApps] = useState<PartnerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_apps")
      .select("id,name,description,website,key_prefix,is_active,last_used_at,created_at,redirect_uris")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = (data as PartnerApp[]) || [];
    setApps(list);
    if (!selectedAppId && list[0]?.id) setSelectedAppId(list[0].id);
    if (selectedAppId && !list.some((a) => a.id === selectedAppId)) {
      setSelectedAppId(list[0]?.id || null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedApp = useMemo(
    () => apps.find((a) => a.id === selectedAppId) || apps[0] || null,
    [apps, selectedAppId],
  );

  const clientId = selectedApp?.id || "YOUR_CLIENT_ID";
  const hasRedirects = (selectedApp?.redirect_uris || []).length > 0;

  async function createApp() {
    if (!name.trim()) return toast.error("Give your app a name");
    setCreating(true);
    const rand = crypto.getRandomValues(new Uint8Array(24));
    const rawSecret = Array.from(rand)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const rawKey = `opk_live_${rawSecret}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
    const hash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const prefix = rawKey.slice(0, 16);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      setCreating(false);
      return toast.error("Not signed in");
    }
    const { data, error } = await supabase
      .from("partner_apps")
      .insert({
        owner_user_id: uid,
        name: name.trim(),
        description: description.trim() || null,
        website: website.trim() || null,
        key_prefix: prefix,
        key_hash: hash,
      })
      .select("id")
      .maybeSingle();
    setCreating(false);
    if (error) return toast.error(error.message);
    setNewKey(rawKey);
    setName("");
    setDescription("");
    setWebsite("");
    setShowCreate(false);
    if (data?.id) setSelectedAppId(data.id);
    await load();
    setTab("apps");
    toast.success("App created — copy your API key now");
  }

  async function toggleActive(app: PartnerApp) {
    const { error } = await supabase.from("partner_apps").update({ is_active: !app.is_active }).eq("id", app.id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function remove(app: PartnerApp) {
    if (!confirm(`Delete "${app.name}"? Integrations using this key will stop working.`)) return;
    const { error } = await supabase.from("partner_apps").delete().eq("id", app.id);
    if (error) return toast.error(error.message);
    if (selectedAppId === app.id) setSelectedAppId(null);
    await load();
  }

  const tabs: { id: PortalTab; label: string; icon: typeof KeyRound }[] = [
    { id: "setup", label: "Setup guide", icon: Rocket },
    { id: "apps", label: "Apps & keys", icon: KeyRound },
    { id: "auth", label: "Sign in Auth", icon: ShieldCheck },
    { id: "transfers", label: "Transfers", icon: Wallet },
    { id: "paybutton", label: "PayButton", icon: CreditCard },
    { id: "lovable", label: "Copy-paste", icon: ClipboardPaste },
    { id: "reference", label: "Reference", icon: BookOpen },
  ];

  const authorizeUrl = `${SITE}/connect?client_id=${clientId}&redirect_uri=https://yourapp.com/auth/openpay/callback&scope=profile&state=RANDOM_STATE&response_type=code`;

  const lovablePrompt = useMemo(
    () =>
      buildOpenPayLovablePrompt({
        site: SITE,
        apiBase: API_BASE,
        clientId: selectedApp?.id || "YOUR_CLIENT_ID",
      }),
    [selectedApp?.id],
  );

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#062a78]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src="/openpay-auth-logo.png" alt="OpenPay" className="h-9 w-9 rounded-lg bg-black/20 object-contain p-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/65">Developer Portal</p>
            <h1 className="truncate text-lg font-black tracking-tight">Partner API · {SITE.replace("https://", "")}</h1>
          </div>
          <Button
            asChild
            variant="secondary"
            className="hidden rounded-full bg-white/15 text-white hover:bg-white/25 sm:inline-flex"
          >
            <a href={AUTH_DOCS} target="_blank" rel="noreferrer">
              Auth docs
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-24">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#1652f0]/15 bg-gradient-to-br from-[#062a78] via-[#0a53d8] to-[#1652f0] p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Third-party integration · openpy.space
              </p>
              <h2 className="text-2xl font-black tracking-tight md:text-3xl">
                Connect your app to OpenPay professionally
              </h2>
              <p className="mt-2 text-sm text-white/85 md:text-base">
                Create an app, copy <strong>Client ID</strong> + <strong>API key</strong>, add{" "}
                <strong>Connect with OpenPay</strong> redirect URIs, then ship Sign in, transfers, or PayButton.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[280px]">
              {[
                { label: "Apps", value: apps.length },
                { label: "Active", value: apps.filter((a) => a.is_active).length },
                {
                  label: "Redirects",
                  value: apps.reduce((n, a) => n + (a.redirect_uris?.length || 0), 0),
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur">
                  <p className="text-xl font-black">{loading ? "…" : stat.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-4">
            {[
              { n: "1", t: "Register app", d: "Get Client ID + opk_ key" },
              { n: "2", t: "Add redirects", d: "OAuth callback URLs" },
              { n: "3", t: "Sign in / pay", d: "Auth · transfers · PayButton" },
              { n: "4", t: "Go live", d: "Keep secrets on your server" },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/15 bg-white/10 p-3">
                <p className="text-xs font-black text-white/60">Step {s.n}</p>
                <p className="mt-1 text-sm font-bold">{s.t}</p>
                <p className="text-xs text-white/75">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                tab === item.id ? "bg-[#1652f0] text-white shadow" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "setup" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm md:p-8">
            <div>
              <h3 className="text-xl font-black">Smooth setup tutorial</h3>
              <p className="mt-1 text-sm text-slate-600">
                Follow these steps once. All public links use <strong>openpy.space</strong>.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <FieldLabel>Public site</FieldLabel>
                <button
                  type="button"
                  className="font-mono text-sm font-semibold text-[#1652f0] hover:underline"
                  onClick={() => copyText(SITE)}
                >
                  {SITE}
                </button>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <FieldLabel>API endpoint</FieldLabel>
                <button
                  type="button"
                  className="break-all text-left font-mono text-xs font-semibold text-[#1652f0] hover:underline"
                  onClick={() => copyText(API_BASE, "API endpoint copied")}
                >
                  {API_BASE}
                </button>
              </div>
            </div>

            <ol className="space-y-4">
              <li className="rounded-2xl border p-4">
                <p className="font-bold">1. Create a partner app</p>
                <p className="mt-1 text-sm text-slate-600">
                  Open <button type="button" className="font-semibold text-[#1652f0]" onClick={() => { setTab("apps"); setShowCreate(true); }}>Apps &amp; keys</button> →
                  Register app. Copy the <code className="rounded bg-slate-100 px-1">opk_live_…</code> API key immediately
                  (shown once). Save the <strong>Client ID</strong> (UUID).
                </p>
              </li>
              <li className="rounded-2xl border p-4">
                <p className="font-bold">2. Add Connect with OpenPay redirect URIs</p>
                <p className="mt-1 text-sm text-slate-600">
                  On your app card, paste exact callbacks like{" "}
                  <code className="rounded bg-slate-100 px-1">https://yourapp.com/auth/openpay/callback</code> and Save.
                  Wildcards are not allowed.
                </p>
              </li>
              <li className="rounded-2xl border p-4">
                <p className="font-bold">3. Launch Sign in with OpenPay</p>
                <p className="mt-1 text-sm text-slate-600 mb-3">
                  Send users to OpenPay authorize on <strong>openpy.space</strong>:
                </p>
                <CodeBlock>{authorizeUrl}</CodeBlock>
              </li>
              <li className="rounded-2xl border p-4">
                <p className="font-bold">4. Exchange code on your backend</p>
                <p className="mt-1 text-sm text-slate-600 mb-3">
                  Never put <code className="rounded bg-slate-100 px-1">opk_</code> in the browser. Use your server:
                </p>
                <CodeBlock>{`curl -X POST "${API_BASE}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/auth/openpay/callback",
    "client_id": "${clientId}",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</CodeBlock>
              </li>
              <li className="rounded-2xl border p-4">
                <p className="font-bold">5. Load the user with the access token</p>
                <CodeBlock>{`curl -H "Authorization: Bearer opa_live_..." ${API_BASE}/user/me`}</CodeBlock>
                <p className="mt-2 text-xs text-slate-500">
                  Returns OpenPay <code>user_id</code>, <code>username</code>, profile, and optional email/balance by scope.
                </p>
              </li>
            </ol>

            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    Easy integrate for Lovable AI
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Copy one full markdown prompt → paste into Lovable chat → Auth, transfers &amp; PayButton scaffolded for you.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-full bg-violet-600 hover:bg-violet-700"
                    onClick={() => copyText(lovablePrompt, "Lovable prompt copied — paste into Lovable")}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy full MD
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => setTab("lovable")}>
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Open Copy-paste
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]" onClick={() => { setTab("apps"); setShowCreate(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Create app now
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => setTab("auth")}>
                Full Auth tutorial
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <a href={AUTH_DOCS} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {AUTH_DOCS.replace("https://", "")}
                </a>
              </Button>
            </div>

            {selectedApp ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-sm font-bold text-emerald-950">Selected app credentials</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <CredentialRow label="Client ID" value={selectedApp.id} hint="OAuth client_id" />
                  <CredentialRow
                    label="API key prefix"
                    value={`${selectedApp.key_prefix}••••••••`}
                    hint="Full opk_live_… secret is only shown once at creation"
                  />
                </div>
                <p className="mt-3 text-xs text-emerald-900/80">
                  Redirect URIs configured: <strong>{(selectedApp.redirect_uris || []).length}</strong>
                  {!hasRedirects ? " — add at least one before testing Sign in" : " ✓"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-8 text-center">
                <p className="font-semibold">No app selected yet</p>
                <p className="mt-1 text-sm text-slate-600">Create an app to see Client ID and configure redirect URIs.</p>
              </div>
            )}
          </section>
        )}

        {tab === "apps" && (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <div className="rounded-2xl border bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">Your apps</p>
                  <Button
                    size="sm"
                    className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    New
                  </Button>
                </div>
                {loading ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">Loading…</p>
                ) : apps.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-slate-50 px-3 py-8 text-center">
                    <KeyRound className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-semibold">No apps yet</p>
                    <p className="mt-1 text-xs text-slate-500">Register your first partner app.</p>
                    <Button size="sm" className="mt-3 rounded-full" onClick={() => setShowCreate(true)}>
                      Register app
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {apps.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setSelectedAppId(app.id)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition",
                          selectedApp?.id === app.id
                            ? "bg-[#1652f0]/10 ring-1 ring-[#1652f0]/30"
                            : "hover:bg-slate-50",
                        )}
                      >
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#062a78] text-xs font-black text-white">
                          {app.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold">{app.name}</p>
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                app.is_active ? "bg-emerald-500" : "bg-slate-300",
                              )}
                            />
                          </div>
                          <p className="truncate font-mono text-[10px] text-slate-500">{app.key_prefix}…</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <div className="space-y-4">
              {showCreate && (
                <section className="rounded-2xl border border-[#1652f0]/20 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-black">
                        <Plus className="h-5 w-5 text-[#1652f0]" />
                        Register a partner app
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        You get one API key. Copy it now — it can’t be shown again.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel>App name</FieldLabel>
                      <Input placeholder="e.g. OpenPay Pro" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel>Website (optional)</FieldLabel>
                      <Input
                        placeholder="https://yourapp.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <FieldLabel>Description (optional)</FieldLabel>
                    <Textarea
                      rows={2}
                      placeholder="What this integration does"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <Button
                    className="mt-4 rounded-full bg-[#1652f0] hover:bg-[#1246d0]"
                    onClick={createApp}
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Create API key
                      </>
                    )}
                  </Button>
                </section>
              )}

              {newKey && (
                <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-950">
                    <CheckCircle2 className="h-4 w-4" />
                    Save this API key now — you won’t see it again
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 break-all rounded-xl border bg-white px-3 py-2 font-mono text-xs">
                      {newKey}
                    </code>
                    <Button size="sm" className="rounded-full" onClick={() => copyText(newKey, "API key copied")}>
                      <Copy className="mr-1 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-amber-900/80">
                    Store as <code>OPENPAY_CLIENT_SECRET</code> / <code>OPENPAY_PARTNER_API_KEY</code> on your server only.
                  </p>
                  <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewKey(null)}>
                    Dismiss
                  </Button>
                </section>
              )}

              {!loading && !selectedApp && !showCreate ? (
                <section className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center shadow-sm">
                  <img src="/openpay-auth-logo.png" alt="" className="mx-auto mb-4 h-16 w-16 object-contain" />
                  <h3 className="text-xl font-black">Set up your developer app</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                    Create a partner app to unlock Client ID, API key, and Connect with OpenPay redirect URIs.
                  </p>
                  <Button
                    className="mt-5 rounded-full bg-[#1652f0] hover:bg-[#1246d0]"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Register partner app
                  </Button>
                </section>
              ) : null}

              {selectedApp ? (
                <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black">{selectedApp.name}</h3>
                        {selectedApp.is_active ? (
                          <Badge className="bg-emerald-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Revoked</Badge>
                        )}
                      </div>
                      {selectedApp.description ? (
                        <p className="mt-1 text-sm text-slate-600">{selectedApp.description}</p>
                      ) : null}
                      {selectedApp.website ? (
                        <a
                          href={selectedApp.website}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#1652f0] hover:underline"
                        >
                          {selectedApp.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => toggleActive(selectedApp)}>
                        <Power
                          className={cn(
                            "mr-1 h-3.5 w-3.5",
                            selectedApp.is_active ? "text-amber-600" : "text-emerald-600",
                          )}
                        />
                        {selectedApp.is_active ? "Revoke" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full text-red-600 hover:bg-red-50"
                        onClick={() => remove(selectedApp)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <CredentialRow
                      label="Client ID"
                      value={selectedApp.id}
                      hint="Use as OAuth client_id in authorize + token exchange"
                    />
                    <CredentialRow
                      label="API key (prefix)"
                      value={`${selectedApp.key_prefix}••••••••`}
                      hint="Full opk_live_… is client_secret — only shown once at creation"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border px-3 py-2">
                      <FieldLabel>Created</FieldLabel>
                      <p className="text-sm font-semibold">{new Date(selectedApp.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="rounded-xl border px-3 py-2">
                      <FieldLabel>Last used</FieldLabel>
                      <p className="text-sm font-semibold">
                        {selectedApp.last_used_at
                          ? new Date(selectedApp.last_used_at).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    <div className="rounded-xl border px-3 py-2">
                      <FieldLabel>Auth redirects</FieldLabel>
                      <p className="text-sm font-semibold">{(selectedApp.redirect_uris || []).length}</p>
                    </div>
                  </div>

                  <RedirectUrisEditor app={selectedApp} onSaved={load} />

                  <div className="rounded-2xl border border-dashed bg-slate-50 p-4">
                    <p className="text-sm font-bold">Quick authorize URL (openpy.space)</p>
                    <CodeBlock>{authorizeUrl}</CodeBlock>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setTab("auth")}>
                        Auth tutorial
                      </Button>
                      <Button asChild size="sm" className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]">
                        <a href={AUTH_DOCS} target="_blank" rel="noreferrer">
                          Open {AUTH_DOCS.replace("https://", "")}
                        </a>
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        )}

        {tab === "auth" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <img src="/openpay-auth-logo.png" alt="" className="h-8 w-8 object-contain" />
                  Connect with OpenPay · Sign in
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  OAuth 2.0 Authorization Code on <strong>openpy.space</strong>. Public docs:{" "}
                  <a href={AUTH_DOCS} className="font-semibold text-[#1652f0] hover:underline" target="_blank" rel="noreferrer">
                    {AUTH_DOCS}
                  </a>
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { t: "1. Client ID + redirects", d: "Register app, add exact callback URLs on Apps & keys." },
                { t: "2. Authorize on openpy.space", d: "Button → /connect with client_id, redirect_uri, scope, state." },
                { t: "3. Token + /user/me", d: "Backend swaps code for opa_ token, then loads the user." },
              ].map((c) => (
                <div key={c.t} className="rounded-2xl border bg-slate-50 p-4">
                  <p className="font-bold">{c.t}</p>
                  <p className="mt-1 text-sm text-slate-600">{c.d}</p>
                </div>
              ))}
            </div>

            <div>
              <FieldLabel>Credentials you need</FieldLabel>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <CredentialRow label="Client ID" value={clientId} />
                <CredentialRow
                  label="API key (client_secret)"
                  value="opk_live_YOUR_KEY"
                  hint="From app creation — server only"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Authorize URL</p>
              <CodeBlock>{`${SITE}/connect
  ?client_id=${clientId}
  &redirect_uri=https://yourapp.com/auth/openpay/callback
  &scope=profile
  &state=RANDOM_CSRF_TOKEN
  &response_type=code`}</CodeBlock>
              <p className="mt-2 text-xs text-slate-500">
                Aliases: <code>{SITE}/oauth/authorize</code> · <code>{SITE}/oauth2/authorize</code>
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Scopes</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { s: "profile", d: "user_id, username, name, avatar, account number" },
                  { s: "email", d: "account email" },
                  { s: "balance", d: "OUSD balance (read-only)" },
                ].map((row) => (
                  <div key={row.s} className="rounded-xl border px-3 py-2">
                    <code className="text-xs font-bold text-[#1652f0]">{row.s}</code>
                    <p className="mt-1 text-xs text-slate-600">{row.d}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Token exchange (backend)</p>
              <CodeBlock>{`curl -X POST "${API_BASE}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/auth/openpay/callback",
    "client_id": "${clientId}",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</CodeBlock>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">User profile</p>
              <CodeBlock>{`curl -H "Authorization: Bearer opa_live_..." ${API_BASE}/user/me`}</CodeBlock>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Drop-in Sign in button</p>
              <CodeBlock>{`<a href="${SITE}/connect?client_id=${clientId}&redirect_uri=https://yourapp.com/auth/openpay/callback&scope=profile&state=xyz&response_type=code"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:12px;font-weight:600;text-decoration:none;">
  <img src="${SITE}/openpay-auth-logo.png" width="20" height="20" alt="" />
  Sign in with OpenPay
</a>`}</CodeBlock>
            </div>
          </section>
        )}

        {tab === "transfers" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-black">Transfers API</h3>
              <p className="mt-1 text-sm text-slate-600">
                Move OUSD from your partner treasury to any OpenPay user. Auth with{" "}
                <code className="rounded bg-slate-100 px-1">opk_live_…</code>.
              </p>
            </div>
            <CodeBlock>Authorization: Bearer opk_live_YOUR_KEY</CodeBlock>
            <CodeBlock>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${API_BASE}/me
curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${API_BASE}/balance
curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${API_BASE}/accounts/@satoshi`}</CodeBlock>
            <CodeBlock>{`curl -X POST "${API_BASE}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"to":"@username","amount":10.00,"note":"Payout"}'`}</CodeBlock>
          </section>
        )}

        {tab === "paybutton" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-black">PayButton checkout</h3>
              <p className="mt-1 text-sm text-slate-600">
                Create a charge, send buyers to <strong>openpy.space/paybutton/…</strong>, receive OUSD in your partner wallet.
              </p>
            </div>
            <CodeBlock>{`curl -X POST "${API_BASE}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 19.99,
    "currency": "OUSD",
    "description": "Order #1234",
    "success_url": "https://yourapp.com/thanks",
    "cancel_url": "https://yourapp.com/cart"
  }'`}</CodeBlock>
            <p className="text-xs text-slate-500">
              Response includes <code>checkout_url</code> like <code>{SITE}/paybutton/CHARGE_ID</code>
            </p>
            <CodeBlock>{`<a href="${SITE}/paybutton/CHARGE_ID"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:12px;font-weight:600;text-decoration:none;">
  Pay with OpenPay
</a>`}</CodeBlock>
          </section>
        )}

        {tab === "lovable" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  Lovable · Cursor · ChatGPT
                </p>
                <h3 className="text-xl font-black">Copy-paste easy integrate</h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  One markdown prompt covers Sign in with OpenPay, Partner transfers, and PayButton.
                  Copy → paste into Lovable AI. Client ID is filled from your selected app; swap in your{" "}
                  <code className="rounded bg-slate-100 px-1">opk_live_…</code> key on the server.
                </p>
              </div>
              <Button
                size="lg"
                className="shrink-0 rounded-full bg-violet-600 hover:bg-violet-700"
                onClick={() => copyText(lovablePrompt, "Full MD copied — paste into Lovable")}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy full MD
              </Button>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                { n: "1", t: "Copy", d: "Click Copy full MD" },
                { n: "2", t: "Paste", d: "Drop into Lovable chat" },
                { n: "3", t: "Secrets", d: "Add opk_live_… server-side only" },
              ].map((s) => (
                <li key={s.n} className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs font-black text-violet-600">Step {s.n}</p>
                  <p className="mt-1 font-bold">{s.t}</p>
                  <p className="text-xs text-slate-600">{s.d}</p>
                </li>
              ))}
            </ol>

            {selectedApp ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-sm font-bold text-emerald-950">Prefilled in this prompt</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <CredentialRow label="Client ID" value={selectedApp.id} />
                  <CredentialRow
                    label="API key"
                    value={`${selectedApp.key_prefix}••••••••`}
                    hint="Replace opk_live_YOUR_API_KEY in the prompt with your real secret"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                Create an app first so Client ID is prefilled.{" "}
                <button type="button" className="font-semibold text-[#1652f0]" onClick={() => { setTab("apps"); setShowCreate(true); }}>
                  Apps &amp; keys
                </button>
              </div>
            )}

            <div>
              <FieldLabel>Full markdown prompt</FieldLabel>
              <div className="relative">
                <pre className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100 md:text-xs">
                  <code>{lovablePrompt}</code>
                </pre>
                <Button
                  type="button"
                  size="sm"
                  className="absolute right-3 top-3 rounded-full bg-white/15 text-white hover:bg-white/25"
                  onClick={() => copyText(lovablePrompt, "Full MD copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          </section>
        )}

        {tab === "reference" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-black">Reference</h3>
              <p className="mt-1 text-sm text-slate-600">Domains and common errors.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <FieldLabel>Portal</FieldLabel>
                <a href={PORTAL_DOCS} className="font-semibold text-[#1652f0] hover:underline">
                  {PORTAL_DOCS}
                </a>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <FieldLabel>Auth docs</FieldLabel>
                <a href={AUTH_DOCS} className="font-semibold text-[#1652f0] hover:underline">
                  {AUTH_DOCS}
                </a>
              </div>
            </div>
            <CodeBlock>{API_BASE}</CodeBlock>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { code: "401", desc: "Missing / invalid / revoked key or token" },
                { code: "403", desc: "Origin not allowed or insufficient OAuth scope" },
                { code: "404", desc: "Recipient, charge, or resource not found" },
                { code: "400", desc: "Validation error (amount, balance, params)" },
              ].map((row) => (
                <div key={row.code} className="rounded-xl border px-4 py-3">
                  <code className="font-bold text-[#1652f0]">{row.code}</code>
                  <p className="mt-1 text-sm text-slate-600">{row.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function PartnerApiPage() {
  return (
    <ProtectedRoute>
      <PartnerApiPageInner />
    </ProtectedRoute>
  );
}
