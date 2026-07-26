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
  <div className="group relative max-w-full">
    <pre className="max-w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100 sm:p-4 sm:text-xs">
      <code className="break-all whitespace-pre-wrap sm:break-normal sm:whitespace-pre">{children}</code>
    </pre>
    <button
      type="button"
      onClick={() => copyText(children)}
      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white opacity-100 transition hover:bg-white/20 sm:opacity-0 sm:group-hover:opacity-100"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  </div>
);

const FieldLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{children}</p>
);

/** Standard OpenPay Auth callbacks — beginners only need to supply their app domain. */
const OPENPAY_CALLBACK_PATHS = ["/auth/openpay/callback", "/openpay/connect/callback"] as const;

function normalizeAppOrigin(input: string): string | null {
  const raw = input.trim().replace(/\/+$/, "");
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname) return null;
    return u.origin;
  } catch {
    return null;
  }
}

function buildDefaultRedirectUris(domainInput: string): string[] {
  const origin = normalizeAppOrigin(domainInput);
  if (!origin) return [];
  return OPENPAY_CALLBACK_PATHS.map((path) => `${origin}${path}`);
}

function guessDomainFromUris(uris: string[]): string {
  for (const uri of uris) {
    try {
      return new URL(uri).host;
    } catch {
      /* skip */
    }
  }
  return "";
}

function RedirectUrisEditor({ app, onSaved }: { app: PartnerApp; onSaved: () => void }) {
  const savedUris = app.redirect_uris || [];
  const [domain, setDomain] = useState(() => guessDomainFromUris(savedUris));
  const [value, setValue] = useState(savedUris.join("\n"));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const uris = app.redirect_uris || [];
    setValue(uris.join("\n"));
    setDomain(guessDomainFromUris(uris));
  }, [app.id, app.redirect_uris]);

  const previewUris = useMemo(() => buildDefaultRedirectUris(domain), [domain]);

  function applyDomainFill() {
    const uris = buildDefaultRedirectUris(domain);
    if (!uris.length) {
      toast.error("Enter your app domain, e.g. www.yourapp.com");
      return;
    }
    setValue(uris.join("\n"));
    toast.success("Callback URLs filled — click Save URIs");
  }

  async function save(urisOverride?: string[]) {
    const uris = (urisOverride ?? value.split(/\n+/))
      .map((s) => s.trim())
      .filter(Boolean);
    if (!uris.length) {
      const filled = buildDefaultRedirectUris(domain);
      if (!filled.length) return toast.error("Enter your app domain first");
      uris.push(...filled);
      setValue(filled.join("\n"));
    }
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

  async function saveFromDomain() {
    const uris = buildDefaultRedirectUris(domain);
    if (!uris.length) return toast.error("Enter your app domain, e.g. www.yourapp.com");
    setValue(uris.join("\n"));
    await save(uris);
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
            Beginners: only enter your <strong>app domain</strong>. We fill the OpenPay callback paths for you.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {(app.redirect_uris || []).length} URI{(app.redirect_uris || []).length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="space-y-2 rounded-xl border bg-white p-3">
        <FieldLabel>Your app domain</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveFromDomain();
              }
            }}
            placeholder="www.yourapp.com"
            className="font-mono text-sm"
            autoComplete="off"
          />
          <Button
            type="button"
            className="w-full shrink-0 rounded-full bg-[#1652f0] hover:bg-[#1246d0] sm:w-auto"
            onClick={() => void saveFromDomain()}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Auto-fill & save"}
          </Button>
        </div>
        <p className="text-[11px] text-slate-500">
          Example: <code className="rounded bg-slate-100 px-1">www.openappdev.space</code> — no path needed.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-[#1652f0]/30 bg-white/70 p-3">
        <FieldLabel>Will register these callbacks</FieldLabel>
        {previewUris.length ? (
          <ul className="space-y-1.5">
            {previewUris.map((uri) => (
              <li key={uri} className="break-all font-mono text-[11px] text-slate-800 md:text-xs">
                {uri}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">Type your domain above to preview callback URLs.</p>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Paths used: <code className="rounded bg-slate-100 px-1">/auth/openpay/callback</code> and{" "}
          <code className="rounded bg-slate-100 px-1">/openpay/connect/callback</code>
        </p>
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-[#1652f0] hover:underline"
          onClick={applyDomainFill}
        >
          Preview only (fill box without saving)
        </button>
      </div>

      <button
        type="button"
        className="text-xs font-semibold text-slate-600 hover:text-[#1652f0] hover:underline"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Hide advanced (edit URLs manually)" : "Advanced: edit full callback URLs"}
      </button>

      {showAdvanced ? (
        <>
          <Textarea
            rows={3}
            placeholder={"https://yourapp.com/auth/openpay/callback\nhttps://yourapp.com/openpay/connect/callback"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">One URL per line · must match your app callback exactly</p>
            <Button size="sm" className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save URIs"}
            </Button>
          </div>
        </>
      ) : null}
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

type EnvSecret = {
  name: string;
  value: string;
  hint: string;
  sensitive?: boolean;
};

function EnvSecretsPanel({
  clientId,
  apiKey,
  redirectUri = "https://YOUR_APP_DOMAIN/auth/openpay/callback",
}: {
  clientId: string;
  /** Full opk_live_… when just created; otherwise null (shows placeholder). */
  apiKey: string | null;
  redirectUri?: string;
}) {
  const secretValue = apiKey || "opk_live_PASTE_YOUR_FULL_KEY_HERE";
  const hasRealKey = Boolean(apiKey);

  const secrets: EnvSecret[] = [
    {
      name: "OPENPAY_CLIENT_ID",
      value: clientId,
      hint: "OAuth client_id — safe to put in Lovable Secrets / .env",
    },
    {
      name: "OPENPAY_CLIENT_SECRET",
      value: secretValue,
      hint: hasRealKey
        ? "Full API key (opk_live_…) — server / Lovable Secrets only"
        : "Paste the full key from when you created the app (shown once)",
      sensitive: true,
    },
    {
      name: "OPENPAY_API_KEY",
      value: secretValue,
      hint: "Same as CLIENT_SECRET — use this name if your docs say API key",
      sensitive: true,
    },
    {
      name: "OPENPAY_REDIRECT_URI",
      value: redirectUri,
      hint: "Must match a saved Connect with OpenPay redirect URI",
    },
  ];

  const envFile = secrets.map((s) => `${s.name}=${s.value}`).join("\n");

  const lovableSecretsText = secrets
    .map((s) => `Name: ${s.name}\nValue: ${s.value}`)
    .join("\n\n");

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-emerald-950">Env &amp; Lovable Secrets</p>
          <p className="mt-1 text-xs text-emerald-900/80">
            Copy <strong>name</strong> + <strong>value</strong> into Lovable → Secrets, or paste the{" "}
            <code className="rounded bg-white px-1">.env</code> block into your project.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="rounded-full bg-emerald-700 hover:bg-emerald-800"
            onClick={() => copyText(envFile, ".env block copied")}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy .env
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full border-emerald-300 bg-white"
            onClick={() => copyText(lovableSecretsText, "Lovable secret names + values copied")}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            Copy for Lovable
          </Button>
        </div>
      </div>

      {!hasRealKey ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          Full <code className="rounded bg-white px-1">opk_live_…</code> was only shown at app creation.
          Replace the placeholder after you paste, or create a new app key if you lost it.
        </p>
      ) : (
        <p className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-[11px] text-emerald-950">
          Full API key included below — save it now in Secrets / .env. It won’t be shown again.
        </p>
      )}

      <div className="space-y-2">
        {secrets.map((s) => (
          <div
            key={s.name}
            className="rounded-xl border border-emerald-100 bg-white p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel>{s.sensitive ? "Secret name" : "Env name"}</FieldLabel>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-full px-2 text-[11px]"
                onClick={() => copyText(s.name, `${s.name} name copied`)}
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy name
              </Button>
            </div>
            <code className="mt-0.5 block break-all font-mono text-xs font-bold text-[#1652f0]">
              {s.name}
            </code>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <FieldLabel>Value</FieldLabel>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-full px-2 text-[11px]"
                onClick={() => copyText(s.value, `${s.name} value copied`)}
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy value
              </Button>
            </div>
            <code className="mt-0.5 block break-all font-mono text-[11px] text-slate-800 sm:text-xs">
              {s.value}
            </code>
            <p className="mt-1.5 text-[11px] text-slate-500">{s.hint}</p>
          </div>
        ))}
      </div>

      <div>
        <FieldLabel>Ready-to-paste .env</FieldLabel>
        <CodeBlock>{envFile}</CodeBlock>
      </div>
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
  const [newKeyAppId, setNewKeyAppId] = useState<string | null>(null);
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
    setNewKeyAppId(data?.id || null);
    setName("");
    setDescription("");
    setWebsite("");
    setShowCreate(false);
    if (data?.id) setSelectedAppId(data.id);
    await load();
    setTab("apps");
    toast.success("App created — copy your API key into Secrets / .env now");
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

  const tabs: { id: PortalTab; label: string; short: string; icon: typeof KeyRound }[] = [
    { id: "setup", label: "Setup guide", short: "Setup", icon: Rocket },
    { id: "apps", label: "Apps & keys", short: "Apps", icon: KeyRound },
    { id: "auth", label: "Sign in Auth", short: "Auth", icon: ShieldCheck },
    { id: "transfers", label: "Transfers", short: "Send", icon: Wallet },
    { id: "paybutton", label: "PayButton", short: "Pay", icon: CreditCard },
    { id: "lovable", label: "Copy-paste", short: "Paste", icon: ClipboardPaste },
    { id: "reference", label: "Reference", short: "Docs", icon: BookOpen },
  ];

  const redirectUri = useMemo(() => {
    const uris = selectedApp?.redirect_uris || [];
    const preferred =
      uris.find((u) => /\/auth\/openpay\/callback\/?$/i.test(u)) ||
      uris.find((u) => /\/openpay\/connect\/callback\/?$/i.test(u)) ||
      uris[0];
    return preferred || "https://YOUR_APP_DOMAIN/auth/openpay/callback";
  }, [selectedApp?.redirect_uris]);

  const authorizeUrl = useMemo(() => {
    const url = new URL(`${SITE}/connect`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "profile");
    url.searchParams.set("state", "RANDOM_STATE");
    url.searchParams.set("response_type", "code");
    return url.toString();
  }, [clientId, redirectUri]);

  const signInButtonHtml = useMemo(
    () => `<a href="${authorizeUrl}"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:12px;font-weight:600;text-decoration:none;">
  <img src="${SITE}/openpay-auth-logo.png" width="20" height="20" alt="" />
  Sign in with OpenPay
</a>`,
    [authorizeUrl],
  );

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
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#f3f6fb] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#062a78]/95 text-white backdrop-blur supports-[backdrop-filter]:bg-[#062a78]/85">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-white hover:bg-white/10"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img
            src="/openpay-auth-logo.png"
            alt="OpenPay"
            className="h-8 w-8 shrink-0 rounded-lg bg-black/20 object-contain p-0.5 sm:h-9 sm:w-9"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/65 sm:text-[10px] sm:tracking-[0.22em]">
              Developer Portal
            </p>
            <h1 className="truncate text-base font-black tracking-tight sm:text-lg">
              Partner API
              <span className="hidden text-white/70 sm:inline"> · openpy.space</span>
            </h1>
          </div>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="hidden rounded-full bg-white/15 text-white hover:bg-white/25 sm:inline-flex"
          >
            <a href={AUTH_DOCS} target="_blank" rel="noreferrer">
              Auth docs
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-white hover:bg-white/10 sm:hidden"
            aria-label="Auth docs"
          >
            <a href={AUTH_DOCS} target="_blank" rel="noreferrer">
              <BookOpen className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:space-y-6 sm:px-4 sm:py-6 sm:pb-24">
        <section className="overflow-hidden rounded-2xl border border-[#1652f0]/15 bg-gradient-to-br from-[#062a78] via-[#0a53d8] to-[#1652f0] p-4 text-white shadow-xl sm:rounded-[1.75rem] sm:p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Third-party · openpy.space</span>
              </p>
              <h2 className="text-xl font-black tracking-tight sm:text-2xl md:text-3xl">
                Connect your app to OpenPay
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">
                Create an app, copy <strong>Client ID</strong> + <strong>API key</strong>, set your domain for redirects, then ship Sign in, transfers, or PayButton.
              </p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 text-center lg:w-auto lg:min-w-[280px]">
              {[
                { label: "Apps", value: apps.length },
                { label: "Active", value: apps.filter((a) => a.is_active).length },
                {
                  label: "Redirects",
                  value: apps.reduce((n, a) => n + (a.redirect_uris?.length || 0), 0),
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/10 px-2 py-2.5 backdrop-blur sm:rounded-2xl sm:px-3 sm:py-3">
                  <p className="text-lg font-black sm:text-xl">{loading ? "…" : stat.value}</p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-white/70 sm:text-[10px]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4">
            {[
              { n: "1", t: "Register app", d: "Client ID + opk_ key" },
              { n: "2", t: "Add domain", d: "Auto-fill callbacks" },
              { n: "3", t: "Sign in / pay", d: "Auth · PayButton" },
              { n: "4", t: "Go live", d: "Secrets on server" },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-white/15 bg-white/10 p-2.5 sm:rounded-2xl sm:p-3">
                <p className="text-[10px] font-black text-white/60 sm:text-xs">Step {s.n}</p>
                <p className="mt-0.5 text-xs font-bold sm:mt-1 sm:text-sm">{s.t}</p>
                <p className="text-[10px] leading-snug text-white/75 sm:text-xs">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Desktop / tablet top tabs */}
        <nav className="hidden gap-2 overflow-x-auto rounded-2xl border bg-white p-2 shadow-sm sm:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition md:px-4",
                tab === item.id ? "bg-[#1652f0] text-white shadow" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden md:inline">{item.label}</span>
              <span className="md:hidden">{item.short}</span>
            </button>
          ))}
        </nav>

        {/* Mobile section title for current tab */}
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <h2 className="text-lg font-black tracking-tight">
            {tabs.find((t) => t.id === tab)?.label}
          </h2>
          {tab === "apps" ? (
            <Button
              size="sm"
              className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          ) : null}
        </div>

        {tab === "setup" && (
          <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:space-y-5 sm:p-6 md:p-8">
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
                  On your app card, enter only your domain (e.g.{" "}
                  <code className="rounded bg-slate-100 px-1">www.yourapp.com</code>) and click{" "}
                  <strong>Auto-fill &amp; save</strong>. OpenPay registers{" "}
                  <code className="rounded bg-slate-100 px-1">/auth/openpay/callback</code> and{" "}
                  <code className="rounded bg-slate-100 px-1">/openpay/connect/callback</code> for you.
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
    "redirect_uri": "${redirectUri}",
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
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
            {/* Mobile: horizontal app picker */}
            <div className="lg:hidden">
              {!loading && apps.length > 0 ? (
                <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {apps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedAppId(app.id)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition",
                        selectedApp?.id === app.id
                          ? "border-[#1652f0] bg-[#1652f0]/10 shadow-sm"
                          : "border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#062a78] text-xs font-black text-white">
                        {app.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[7.5rem] truncate text-sm font-bold">{app.name}</p>
                        <p className="font-mono text-[10px] text-slate-500">{app.key_prefix.slice(0, 12)}…</p>
                      </div>
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          app.is_active ? "bg-emerald-500" : "bg-slate-300",
                        )}
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="hidden space-y-3 lg:block">
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

            <div className="min-w-0 space-y-4">
              {showCreate && (
                <section className="rounded-2xl border border-[#1652f0]/20 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 text-base font-black sm:text-lg">
                        <Plus className="h-5 w-5 shrink-0 text-[#1652f0]" />
                        Register a partner app
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        You get one API key. Copy it now — it can’t be shown again.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    className="mt-4 w-full rounded-full bg-[#1652f0] hover:bg-[#1246d0] sm:w-auto"
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
                <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="flex items-start gap-2 text-sm font-bold text-amber-950">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      App created — copy secrets into Lovable / .env now (key shown once)
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => {
                        setNewKey(null);
                        setNewKeyAppId(null);
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                  <EnvSecretsPanel
                    clientId={newKeyAppId || selectedApp?.id || "YOUR_CLIENT_ID"}
                    apiKey={newKey}
                    redirectUri={
                      selectedApp?.redirect_uris?.[0] ||
                      "https://YOUR_APP_DOMAIN/auth/openpay/callback"
                    }
                  />
                </section>
              )}

              {!loading && !selectedApp && !showCreate ? (
                <section className="rounded-2xl border border-dashed bg-white px-4 py-12 text-center shadow-sm sm:px-6 sm:py-16">
                  <img src="/openpay-auth-logo.png" alt="" className="mx-auto mb-4 h-14 w-14 object-contain sm:h-16 sm:w-16" />
                  <h3 className="text-lg font-black sm:text-xl">Set up your developer app</h3>
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
                <section className="min-w-0 space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black sm:text-xl">{selectedApp.name}</h3>
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
                          className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-[#1652f0] hover:underline"
                        >
                          <span className="truncate">{selectedApp.website}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
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

                  <div className="grid gap-3 sm:grid-cols-2">
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

                  <EnvSecretsPanel
                    clientId={selectedApp.id}
                    apiKey={newKeyAppId === selectedApp.id ? newKey : null}
                    redirectUri={redirectUri}
                  />

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl border px-2 py-2 sm:px-3">
                      <FieldLabel>Created</FieldLabel>
                      <p className="text-xs font-semibold sm:text-sm">
                        {new Date(selectedApp.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="rounded-xl border px-2 py-2 sm:px-3">
                      <FieldLabel>Last used</FieldLabel>
                      <p className="text-xs font-semibold sm:text-sm">
                        {selectedApp.last_used_at
                          ? new Date(selectedApp.last_used_at).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    <div className="rounded-xl border px-2 py-2 sm:px-3">
                      <FieldLabel>Redirects</FieldLabel>
                      <p className="text-xs font-semibold sm:text-sm">
                        {(selectedApp.redirect_uris || []).length}
                      </p>
                    </div>
                  </div>

                  <RedirectUrisEditor app={selectedApp} onSaved={load} />

                  <div className="rounded-2xl border border-dashed bg-slate-50 p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold">Quick authorize URL (openpy.space)</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Auto-filled from your Client ID + saved redirect domain
                          {(selectedApp.redirect_uris || []).length === 0
                            ? " — save a domain above first"
                            : ""}
                          .
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => copyText(authorizeUrl, "Authorize URL copied")}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy URL
                        </Button>
                        <Button asChild size="sm" className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]">
                          <a href={authorizeUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Open
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <FieldLabel>client_id</FieldLabel>
                        <p className="break-all font-mono text-[11px]">{clientId}</p>
                      </div>
                      <div className="rounded-xl border bg-white px-3 py-2">
                        <FieldLabel>redirect_uri</FieldLabel>
                        <p className="break-all font-mono text-[11px]">{redirectUri}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <CodeBlock>{authorizeUrl}</CodeBlock>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button size="sm" variant="outline" className="w-full rounded-full sm:w-auto" onClick={() => setTab("auth")}>
                        Auth tutorial
                      </Button>
                      <Button asChild size="sm" className="w-full rounded-full bg-[#1652f0] hover:bg-[#1246d0] sm:w-auto">
                        <a href={AUTH_DOCS} target="_blank" rel="noreferrer">
                          Open auth docs
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
          <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:space-y-5 sm:p-6 md:p-8">
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
  &redirect_uri=${redirectUri}
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
    "redirect_uri": "${redirectUri}",
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
              <CodeBlock>{signInButtonHtml}</CodeBlock>
            </div>
          </section>
        )}

        {tab === "transfers" && (
          <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:space-y-5 sm:p-6">
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
          <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:space-y-5 sm:p-6">
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
          <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:space-y-5 sm:p-6 md:p-8">
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
                className="w-full shrink-0 rounded-full bg-violet-600 hover:bg-violet-700 sm:w-auto"
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
              <div className="relative max-w-full">
                <pre className="max-h-[min(28rem,55vh)] max-w-full overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100 sm:p-4 sm:text-[11px] md:text-xs">
                  <code className="break-all whitespace-pre-wrap">{lovablePrompt}</code>
                </pre>
                <Button
                  type="button"
                  size="sm"
                  className="absolute right-2 top-2 rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-3 sm:top-3"
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
          <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm sm:space-y-5 sm:p-6">
            <div>
              <h3 className="text-xl font-black">Reference</h3>
              <p className="mt-1 text-sm text-slate-600">Domains and common errors.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <FieldLabel>Portal</FieldLabel>
                <a href={PORTAL_DOCS} className="break-all font-semibold text-[#1652f0] hover:underline">
                  {PORTAL_DOCS}
                </a>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <FieldLabel>Auth docs</FieldLabel>
                <a href={AUTH_DOCS} className="break-all font-semibold text-[#1652f0] hover:underline">
                  {AUTH_DOCS}
                </a>
              </div>
            </div>
            <CodeBlock>{API_BASE}</CodeBlock>
            <div className="grid gap-3 sm:grid-cols-2">
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

      {/* Mobile app-style bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-7 gap-0.5 px-1 pt-1.5 pb-1">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition",
                  active ? "text-[#1652f0]" : "text-slate-500",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl",
                    active ? "bg-[#1652f0]/12" : "",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="w-full truncate text-center text-[9px] font-bold leading-tight">
                  {item.short}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
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
