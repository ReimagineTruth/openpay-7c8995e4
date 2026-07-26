import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Power,
  Save,
  ShieldCheck,
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
import { cn } from "@/lib/utils";
import { getOpenPayAuthSite } from "@/lib/openpayAuth";

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

type PortalTab = "apps" | "auth" | "transfers" | "paybutton" | "reference";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-transfer-api`;

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
    <div className="space-y-3 rounded-2xl border border-[#1652f0]/15 bg-[#1652f0]/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Link2 className="h-4 w-4 text-[#1652f0]" />
            Sign in with OpenPay — redirect URIs
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Exact callback URLs only. Required for OAuth / Sign in with OpenPay.
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">One URL per line</p>
        <Button size="sm" className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save URIs"}
        </Button>
      </div>
    </div>
  );
}

function PartnerApiPageInner() {
  const navigate = useNavigate();
  const site = getOpenPayAuthSite();
  const [tab, setTab] = useState<PortalTab>("apps");
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
    { id: "apps", label: "Apps", icon: KeyRound },
    { id: "auth", label: "Sign in Auth", icon: ShieldCheck },
    { id: "transfers", label: "Transfers", icon: Wallet },
    { id: "paybutton", label: "PayButton", icon: CreditCard },
    { id: "reference", label: "Reference", icon: BookOpen },
  ];

  const curlSend = `curl -X POST "${FN_BASE}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"to":"@username","amount":10.00,"note":"Payout"}'`;

  const curlCharge = `curl -X POST "${FN_BASE}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 19.99,
    "currency": "OUSD",
    "description": "Order #1234",
    "reference": "order_1234",
    "success_url": "https://yourapp.com/thanks",
    "cancel_url": "https://yourapp.com/cart"
  }'`;

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
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
          <img src="/openpay-auth-logo.png" alt="OpenPay" className="h-9 w-9 rounded-lg object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/65">Developer Portal</p>
            <h1 className="truncate text-lg font-black tracking-tight">Partner API &amp; App Setup</h1>
          </div>
          <Button
            asChild
            variant="secondary"
            className="hidden rounded-full bg-white/15 text-white hover:bg-white/25 sm:inline-flex"
          >
            <Link to="/openpay-auth">Auth docs</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-20">
        <section className="overflow-hidden rounded-[1.75rem] border border-[#1652f0]/15 bg-gradient-to-br from-[#062a78] via-[#0a53d8] to-[#1652f0] p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                OpenPay for third-party apps
              </p>
              <h2 className="text-2xl font-black tracking-tight md:text-3xl">Build with OpenPay Auth &amp; transfers</h2>
              <p className="mt-2 text-sm text-white/80 md:text-base">
                Register an app, copy your API key, add Sign in redirect URIs, then ship transfers, PayButton, or
                Sign in with OpenPay.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center md:min-w-[280px]">
              {[
                { label: "Apps", value: apps.length },
                { label: "Active", value: apps.filter((a) => a.is_active).length },
                {
                  label: "Auth URIs",
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
              { step: "1", title: "Create app", desc: "Get client_id + opk_ key" },
              { step: "2", title: "Add redirects", desc: "OAuth callback URLs" },
              { step: "3", title: "Sign in / pay", desc: "Auth, transfers, PayButton" },
              { step: "4", title: "Go live", desc: "Keep key on your server" },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/15 bg-white/10 p-3">
                <p className="text-xs font-black text-white/60">Step {item.step}</p>
                <p className="mt-1 text-sm font-bold">{item.title}</p>
                <p className="text-xs text-white/75">{item.desc}</p>
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
                tab === item.id
                  ? "bg-[#1652f0] text-white shadow"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

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
                    <p className="text-sm font-semibold text-slate-700">No apps yet</p>
                    <p className="mt-1 text-xs text-slate-500">Create your first partner app to get an API key.</p>
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
                          selectedApp?.id === app.id ? "bg-[#1652f0]/10 ring-1 ring-[#1652f0]/30" : "hover:bg-slate-50",
                        )}
                      >
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#062a78] text-xs font-black text-white">
                          {app.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold">{app.name}</p>
                            {app.is_active ? (
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-slate-300" />
                            )}
                          </div>
                          <p className="truncate font-mono text-[10px] text-slate-500">{app.key_prefix}…</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-white p-4 text-xs text-slate-600 shadow-sm">
                <p className="font-bold text-slate-900">Base URL</p>
                <button
                  type="button"
                  className="mt-2 break-all text-left font-mono text-[11px] text-[#1652f0] hover:underline"
                  onClick={() => copyText(FN_BASE, "Base URL copied")}
                >
                  {FN_BASE}
                </button>
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
                        You’ll get one API key. Copy it immediately — it can’t be shown again.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        App name
                      </label>
                      <Input
                        placeholder="e.g. OpenPay Pro"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Website (optional)
                      </label>
                      <Input
                        placeholder="https://yourapp.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Description (optional)
                    </label>
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
                    Save this key now — you won’t see it again
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 break-all rounded-xl border bg-white px-3 py-2 font-mono text-xs">
                      {newKey}
                    </code>
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => copyText(newKey, "API key copied")}
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewKey(null)}>
                    Dismiss
                  </Button>
                </section>
              )}

              {!loading && !selectedApp && !showCreate ? (
                <section className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center shadow-sm">
                  <img src="/openpay-auth-logo.png" alt="" className="mx-auto mb-4 h-16 w-16 object-contain" />
                  <h3 className="text-xl font-black">Set up your first developer app</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                    Create a partner app to unlock Sign in with OpenPay, transfers, and PayButton checkout.
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => toggleActive(selectedApp)}
                      >
                        <Power className={cn("mr-1 h-3.5 w-3.5", selectedApp.is_active ? "text-amber-600" : "text-emerald-600")} />
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
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Client ID</p>
                      <div className="mt-2 flex items-start gap-2">
                        <code className="flex-1 break-all font-mono text-xs text-slate-800">{selectedApp.id}</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => copyText(selectedApp.id, "client_id copied")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">Use as OAuth <code>client_id</code></p>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">API key prefix</p>
                      <div className="mt-2 flex items-start gap-2">
                        <code className="flex-1 break-all font-mono text-xs text-slate-800">
                          {selectedApp.key_prefix}••••••••
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => copyText(selectedApp.key_prefix, "Key prefix copied")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Full <code>opk_live_…</code> secret is only shown once at creation
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Created</p>
                      <p className="text-sm font-semibold">
                        {new Date(selectedApp.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="rounded-xl border px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Last used</p>
                      <p className="text-sm font-semibold">
                        {selectedApp.last_used_at
                          ? new Date(selectedApp.last_used_at).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    <div className="rounded-xl border px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Auth redirects</p>
                      <p className="text-sm font-semibold">{(selectedApp.redirect_uris || []).length}</p>
                    </div>
                  </div>

                  <RedirectUrisEditor app={selectedApp} onSaved={load} />

                  <div className="rounded-2xl border border-dashed bg-slate-50 p-4">
                    <p className="text-sm font-bold">Quick authorize URL</p>
                    <CodeBlock>{`${site}/connect?client_id=${selectedApp.id}&redirect_uri=https://yourapp.com/auth/openpay/callback&scope=profile&state=RANDOM&response_type=code`}</CodeBlock>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setTab("auth")}>
                        Auth setup guide
                      </Button>
                      <Button asChild size="sm" className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]">
                        <Link to="/openpay-auth">Open Auth docs</Link>
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        )}

        {tab === "auth" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <img src="/openpay-auth-logo.png" alt="" className="h-8 w-8 object-contain" />
                  Sign in with OpenPay
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  OAuth 2.0 Authorization Code for third-party login. Public docs at{" "}
                  <Link to="/openpay-auth" className="font-semibold text-[#1652f0] hover:underline">
                    /openpay-auth
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: "1. Register redirects", body: "Add exact callback URLs on the Apps tab." },
                { title: "2. Launch authorize", body: "Send users to /connect with client_id + scope." },
                { title: "3. Exchange code", body: "Backend swaps code for opa_ token, then /user/me." },
              ].map((card) => (
                <div key={card.title} className="rounded-2xl border bg-slate-50 p-4">
                  <p className="font-bold">{card.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{card.body}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Authorize URL</p>
              <CodeBlock>{`${site}/connect
  ?client_id=${selectedApp?.id || "YOUR_APP_ID"}
  &redirect_uri=https://yourapp.com/auth/openpay/callback
  &scope=profile
  &state=RANDOM_CSRF_TOKEN
  &response_type=code`}</CodeBlock>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Token exchange</p>
              <CodeBlock>{`curl -X POST "${FN_BASE}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/auth/openpay/callback",
    "client_id": "${selectedApp?.id || "YOUR_APP_ID"}",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</CodeBlock>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">User profile</p>
              <CodeBlock>{`curl -H "Authorization: Bearer opa_live_..." ${FN_BASE}/user/me`}</CodeBlock>
              <p className="mt-2 text-xs text-slate-500">
                Scopes: <code>profile</code>, <code>email</code>, <code>balance</code>. Keep{" "}
                <code>opk_</code> on the server only.
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">Drop-in button</p>
              <CodeBlock>{`<a href="${site}/connect?client_id=${selectedApp?.id || "YOUR_APP_ID"}&redirect_uri=https://yourapp.com/auth/openpay/callback&scope=profile&state=xyz&response_type=code"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;">
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
                Move OUSD from your partner treasury into any OpenPay user with a server-side key.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Authentication</p>
              <CodeBlock>Authorization: Bearer opk_live_YOUR_KEY</CodeBlock>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">GET /me · GET /balance</p>
              <CodeBlock>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${FN_BASE}/me
curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${FN_BASE}/balance`}</CodeBlock>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">GET /accounts/:identifier</p>
              <p className="mb-2 text-xs text-slate-500">Resolve by @username, OP account number, or email.</p>
              <CodeBlock>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  ${FN_BASE}/accounts/@satoshi`}</CodeBlock>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">POST /transfers</p>
              <CodeBlock>{curlSend}</CodeBlock>
              <p className="mt-2 text-xs text-slate-500">
                Body: <code>{`{ "to": "OP...|@username|email", "amount": 10.00, "note": "optional", "idempotency_key": "optional" }`}</code>
              </p>
            </div>
          </section>
        )}

        {tab === "paybutton" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-black">PayButton checkout</h3>
              <p className="mt-1 text-sm text-slate-600">
                Create a charge, send the buyer to <code>checkout_url</code>, and receive OUSD in your partner wallet.
              </p>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Create charge from your backend</li>
              <li>Buyer signs in and pays from OpenPay balance</li>
              <li>Redirect to your success_url — poll charge status if needed</li>
            </ol>
            <div>
              <p className="mb-2 text-sm font-bold">POST /charges</p>
              <CodeBlock>{curlCharge}</CodeBlock>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Drop-in PayButton</p>
              <CodeBlock>{`<a href="${site}/paybutton/CHARGE_ID"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;">
  Pay with OpenPay
</a>`}</CodeBlock>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">GET /charges/:id · POST /charges/:id/cancel</p>
              <CodeBlock>{`curl -H "Authorization: Bearer opk_live_YOUR_KEY" ${FN_BASE}/charges/CHARGE_ID
curl -X POST -H "Authorization: Bearer opk_live_YOUR_KEY" ${FN_BASE}/charges/CHARGE_ID/cancel`}</CodeBlock>
              <p className="mt-2 text-xs text-slate-500">
                Status: <code>created</code>, <code>paid</code>, <code>canceled</code>, <code>expired</code>
              </p>
            </div>
          </section>
        )}

        {tab === "reference" && (
          <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-xl font-black">API reference</h3>
              <p className="mt-1 text-sm text-slate-600">Base URL and common errors.</p>
            </div>
            <CodeBlock>{FN_BASE}</CodeBlock>
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
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/openpay-auth">Sign in with OpenPay docs</Link>
              </Button>
              <Button asChild className="rounded-full bg-[#1652f0] hover:bg-[#1246d0]">
                <a href={FN_BASE} target="_blank" rel="noreferrer">
                  Open API index
                </a>
              </Button>
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
