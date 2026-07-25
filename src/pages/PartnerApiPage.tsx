import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, KeyRound, Plus, Trash2, Power, Link2, Save } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

function RedirectUrisEditor({ app, onSaved }: { app: PartnerApp; onSaved: () => void }) {
  const [value, setValue] = useState((app.redirect_uris || []).join("\n"));
  const [saving, setSaving] = useState(false);
  async function save() {
    const uris = value.split(/\s+/).map(s => s.trim()).filter(Boolean);
    for (const u of uris) {
      try { new URL(u); } catch { return toast.error(`Invalid URL: ${u}`); }
    }
    setSaving(true);
    const { error } = await supabase.from("partner_apps").update({ redirect_uris: uris }).eq("id", app.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Redirect URIs saved");
    onSaved();
  }
  return (
    <div className="rounded-md bg-muted/40 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <Link2 className="h-3.5 w-3.5" /> Connect with OpenPay — redirect URIs
      </div>
      <Textarea
        rows={2}
        placeholder="https://yourapp.com/openpay/callback&#10;https://staging.yourapp.com/openpay/callback"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs font-mono"
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">One per line. Users are only redirected to URIs listed here.</p>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

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

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-transfer-api`;

function PartnerApiPageInner() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<PartnerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_apps")
      .select("id,name,description,website,key_prefix,is_active,last_used_at,created_at,redirect_uris")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setApps((data as PartnerApp[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createApp() {
    if (!name.trim()) return toast.error("Give your app a name");
    setCreating(true);
    // Generate opaque key client-side then hash it server-side via RPC-less flow:
    // Use crypto to make the key, hash it, and insert row with hash.
    const rand = crypto.getRandomValues(new Uint8Array(24));
    const rawSecret = Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("");
    const rawKey = `opk_live_${rawSecret}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    const prefix = rawKey.slice(0, 16);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) { setCreating(false); return toast.error("Not signed in"); }
    const { error } = await supabase.from("partner_apps").insert({
      owner_user_id: uid,
      name: name.trim(),
      description: description.trim(),
      website: website.trim(),
      key_prefix: prefix,
      key_hash: hash,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    setNewKey(rawKey);
    setName(""); setDescription(""); setWebsite("");
    load();
  }

  async function toggleActive(app: PartnerApp) {
    const { error } = await supabase.from("partner_apps").update({ is_active: !app.is_active }).eq("id", app.id);
    if (error) return toast.error(error.message);
    load();
  }
  async function remove(app: PartnerApp) {
    if (!confirm(`Delete "${app.name}"? External integrations using this key will stop working.`)) return;
    const { error } = await supabase.from("partner_apps").delete().eq("id", app.id);
    if (error) return toast.error(error.message);
    load();
  }

  const curlSend = useMemo(() => `curl -X POST "${FN_BASE}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"to":"@username","amount":10.00,"note":"Payout"}'`, []);

  const curlCharge = useMemo(() => `curl -X POST "${FN_BASE}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 19.99,
    "currency": "OUSD",
    "description": "Order #1234",
    "reference": "order_1234",
    "success_url": "https://yourapp.com/thanks",
    "cancel_url": "https://yourapp.com/cart"
  }'`, []);

  const paybuttonHtml = `<a href="https://openpay.lovable.app/paybutton/CHARGE_ID"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;">
  Pay with OpenPay
</a>`;


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-lg font-bold">Partner Transfer API</h1>
            <p className="text-xs text-muted-foreground">Let any wallet or finance app move balance in/out of OpenPay</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Create key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" /> Register a partner app</CardTitle>
            <CardDescription>You will get one API key. Copy it now — it can't be shown again.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input placeholder="App name (e.g. MyWallet)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <Textarea placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <Button onClick={createApp} disabled={creating} className="bg-blue-600 hover:bg-blue-700">
              {creating ? "Creating…" : "Create API key"}
            </Button>
            {newKey && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Save this key now — you won't see it again:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs break-all bg-background rounded px-2 py-2 border">{newKey}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Dismiss</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keys list */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Your partner apps</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              apps.length === 0 ? <p className="text-sm text-muted-foreground">No API keys yet.</p> :
              <div className="space-y-2">
                {apps.map(app => (
                  <div key={app.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{app.name}</span>
                          {app.is_active ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="secondary">Revoked</Badge>}
                        </div>
                        <code className="text-xs text-muted-foreground">client_id: {app.id}</code>
                        <div><code className="text-xs text-muted-foreground">{app.key_prefix}••••••••</code></div>
                        {app.website && <p className="text-xs text-muted-foreground truncate">{app.website}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" title={app.is_active ? "Revoke" : "Activate"} onClick={() => toggleActive(app)}>
                          <Power className={`h-4 w-4 ${app.is_active ? "text-amber-600" : "text-green-600"}`} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(app)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <RedirectUrisEditor app={app} onSaved={load} />
                  </div>
                ))}
              </div>
            }
          </CardContent>
        </Card>

        {/* Docs */}
        <Card>
          <CardHeader>
            <CardTitle>API documentation</CardTitle>
            <CardDescription>Base URL: <code className="text-xs">{FN_BASE}</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold mb-1">Authentication</h3>
              <p className="text-muted-foreground">Send your key in the <code>Authorization</code> header:</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">Authorization: Bearer opk_live_YOUR_KEY</pre>
            </section>

            <section>
              <h3 className="font-semibold mb-1">GET /me</h3>
              <p className="text-muted-foreground">Returns the OpenPay account (name, username, account number, balance) that owns this key.</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">curl -H "Authorization: Bearer opk_live_YOUR_KEY" {FN_BASE}/me</pre>
            </section>

            <section>
              <h3 className="font-semibold mb-1">GET /balance</h3>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">curl -H "Authorization: Bearer opk_live_YOUR_KEY" {FN_BASE}/balance</pre>
            </section>

            <section>
              <h3 className="font-semibold mb-1">GET /accounts/:identifier</h3>
              <p className="text-muted-foreground">Resolve any OpenPay user by <code>@username</code>, account number (<code>OP…</code>), or email.</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">curl -H "Authorization: Bearer opk_live_YOUR_KEY" \
  {FN_BASE}/accounts/@satoshi</pre>
            </section>

            <section>
              <h3 className="font-semibold mb-1">POST /transfers — Send balance</h3>
              <p className="text-muted-foreground">
                Debits the key owner's OpenPay balance and credits the recipient. Use <code>Idempotency-Key</code> to safely retry.
              </p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{curlSend}</pre>
              <div className="text-xs text-muted-foreground mt-2">
                Body: <code>{`{ "to": "OP...|@username|email", "amount": 10.00, "note": "optional", "idempotency_key": "optional" }`}</code>
              </div>
            </section>

            <section className="border-t pt-4">
              <h3 className="font-semibold mb-1 text-blue-700 dark:text-blue-300">💳 PayButton — Accept OpenPay balance on your platform</h3>
              <p className="text-muted-foreground">
                Let your customers pay from their OpenPay balance without ever leaving the flow. Create a charge from your backend,
                redirect the buyer to the returned <code>checkout_url</code>, and OpenPay handles sign-in, balance check and payment.
                Funds land in <em>your</em> partner-app owner's OpenPay wallet in real time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">POST /charges — Create a checkout</h3>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{curlCharge}</pre>
              <div className="text-xs text-muted-foreground mt-2">
                Returns <code>{`{ id, amount, currency, status, checkout_url, expires_at }`}</code>. Charges expire in 2 hours.
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Redirect the buyer</h3>
              <p className="text-muted-foreground">Send the customer to the returned <code>checkout_url</code>. They will:</p>
              <ol className="list-decimal pl-5 text-muted-foreground text-sm space-y-1 mt-1">
                <li>See your app name, amount and description on a secure OpenPay page</li>
                <li>Sign in to OpenPay (Email, Google, Apple, or Pi)</li>
                <li>Confirm payment from their OpenPay balance</li>
                <li>Get redirected back to your <code>success_url</code></li>
              </ol>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Drop-in PayButton</h3>
              <p className="text-muted-foreground">After creating a charge, render this button anywhere in your site:</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{paybuttonHtml}</pre>
            </section>

            <section>
              <h3 className="font-semibold mb-1">GET /charges/:id — Check status</h3>
              <p className="text-muted-foreground">Poll after the buyer returns, or list charges with <code>GET /charges?status=paid</code>.</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">curl -H "Authorization: Bearer opk_live_YOUR_KEY" {FN_BASE}/charges/CHARGE_ID</pre>
              <div className="text-xs text-muted-foreground mt-2">
                Status values: <code>created</code>, <code>paid</code>, <code>canceled</code>, <code>expired</code>.
              </div>
            </section>

            <section>
              <h3 className="font-semibold mb-1">POST /charges/:id/cancel</h3>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">curl -X POST -H "Authorization: Bearer opk_live_YOUR_KEY" {FN_BASE}/charges/CHARGE_ID/cancel</pre>
            </section>

            <section className="border-t pt-4">
              <h3 className="font-semibold mb-1">Receiving into OpenPay (server-to-server)</h3>
              <p className="text-muted-foreground">
                Prefer server-to-server? Call <code>POST /transfers</code> from your OpenPay-funded partner account
                to push balance directly into any OpenPay user by <code>@username</code>, account number or email.
              </p>
            </section>


            <section className="border-t pt-4">
              <h3 className="font-semibold mb-1 text-blue-700 dark:text-blue-300">🔐 Connect with OpenPay — OAuth 2.0 sign-in for third-party apps</h3>
              <p className="text-muted-foreground">
                Add a <strong>"Connect with OpenPay"</strong> button to your app. Users click it, are sent to OpenPay to sign in and
                confirm, and are then redirected back to your app with an authorization <code>code</code>. Exchange the code for an
                access token and read the user's OpenPay profile/balance on their behalf. Standard OAuth 2.0 Authorization Code flow.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">1. Register a redirect URI</h3>
              <p className="text-muted-foreground">In the list above, expand your app and add the exact URLs OpenPay may redirect users back to (e.g. <code>https://yourapp.com/openpay/callback</code>). Only URIs in this list are accepted.</p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">2. Send the user to OpenPay</h3>
              <p className="text-muted-foreground">From your app, open this URL in the browser:</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{`https://openpay.lovable.app/connect
  ?client_id=YOUR_APP_ID
  &redirect_uri=https://yourapp.com/openpay/callback
  &scope=profile%20balance
  &state=RANDOM_CSRF_TOKEN`}</pre>
              <p className="text-xs text-muted-foreground mt-1">
                <code>client_id</code> is the <code>client_id</code> shown next to your app above. Supported scopes:
                <code> profile</code>, <code>balance</code>.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">3. Handle the callback</h3>
              <p className="text-muted-foreground">If the user approves, OpenPay redirects to:</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{`https://yourapp.com/openpay/callback?code=opc_...&state=RANDOM_CSRF_TOKEN`}</pre>
              <p className="text-muted-foreground">If they cancel, you receive <code>?error=access_denied</code>. Verify <code>state</code> matches what you sent.</p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">4. Exchange the code for an access token</h3>
              <p className="text-muted-foreground">From your <strong>backend</strong> (never expose your API key to the browser):</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{`curl -X POST "${FN_BASE}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/openpay/callback",
    "client_id": "YOUR_APP_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</pre>
              <p className="text-xs text-muted-foreground mt-1">
                Response: <code>{`{ access_token: "opa_live_...", token_type: "Bearer", expires_in: 2592000, scope, user_id }`}</code>.
                Codes expire in 10 minutes and are single-use. Access tokens last 30 days.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">5. Call OpenPay on behalf of the user</h3>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{`curl -H "Authorization: Bearer opa_live_..." ${FN_BASE}/user/me
curl -H "Authorization: Bearer opa_live_..." ${FN_BASE}/user/balance`}</pre>
              <p className="text-xs text-muted-foreground mt-1">
                <code>GET /user/me</code> returns <code>{`{ user_id, account_number, full_name, username, avatar_url, balance, currency, scope }`}</code>.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-1">Drop-in button</h3>
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">{`<a href="https://openpay.lovable.app/connect?client_id=YOUR_APP_ID&redirect_uri=https://yourapp.com/openpay/callback&scope=profile%20balance&state=xyz"
   style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:10px;font-weight:600;text-decoration:none;">
  Connect with OpenPay
</a>`}</pre>
            </section>

              <h3 className="font-semibold mb-1">Errors</h3>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><code>401</code> — missing / invalid / revoked key</li>
                <li><code>403</code> — origin not whitelisted</li>
                <li><code>404</code> — recipient not found</li>
                <li><code>400</code> — validation error (amount, insufficient balance…)</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function PartnerApiPage() {
  return <ProtectedRoute><PartnerApiPageInner /></ProtectedRoute>;
}
