import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, KeyRound, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const FN_BASE = `https://araojncyittkahvvpdrn.supabase.co/functions/v1`;

const DeveloperLedgerPage = () => {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("OpenLedger mirror");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("ledger-api-keys", { method: "GET" as any });
    if (error) toast.error(error.message);
    setKeys((data as any)?.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createKey = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("ledger-api-keys", { body: { name: newName } });
    setCreating(false);
    if (error) return toast.error(error.message);
    setFreshKey((data as any)?.api_key || null);
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? Integrations using it will stop working.")) return;
    const { error } = await supabase.functions.invoke(`ledger-api-keys?id=${id}`, { method: "DELETE" as any });
    if (error) return toast.error(error.message);
    toast.success("Key revoked");
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-16">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-paypal-dark">OpenPay Ledger API</h1>
          <p className="text-xs text-muted-foreground">Mirror your OpenPay transactions to OpenLedger or any external system</p>
        </div>
      </div>

      {/* Keys */}
      <section className="paypal-surface mb-6 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold">API keys</h2>
        </div>

        <div className="mb-4 flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            className="h-10 flex-1 rounded-xl border border-border px-3 text-sm" placeholder="Key name" />
          <Button onClick={createKey} disabled={creating} className="h-10 rounded-xl bg-paypal-blue text-white">
            <Plus className="h-4 w-4 mr-1" />{creating ? "Creating…" : "Create key"}
          </Button>
        </div>

        {freshKey && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-800">Save this key now — you won't see it again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1 text-xs">{freshKey}</code>
              <button onClick={() => copy(freshKey)} className="rounded-lg bg-emerald-600 p-2 text-white"><Copy className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keys yet.</p>
        ) : (
          <ul className="space-y-2">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{k.name} {k.revoked_at && <span className="ml-1 text-xs text-red-600">(revoked)</span>}</p>
                  <p className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</p>
                  <p className="text-[10px] text-muted-foreground">Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</p>
                </div>
                {!k.revoked_at && (
                  <button onClick={() => revoke(k.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Docs */}
      <section className="paypal-surface rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-paypal-blue" />
          <h2 className="font-semibold">Integration guide</h2>
        </div>

        <div>
          <p className="text-sm font-semibold">Base URL</p>
          <code className="mt-1 block break-all rounded bg-secondary px-2 py-1 text-xs">{FN_BASE}/ledger-api</code>
        </div>

        <div>
          <p className="text-sm font-semibold">Authentication</p>
          <p className="text-xs text-muted-foreground mb-1">Send your key as a Bearer token on every request.</p>
          <pre className="overflow-x-auto rounded bg-secondary p-3 text-xs"><code>{`Authorization: Bearer opk_live_XXXXXXXXXXXX`}</code></pre>
        </div>

        <div>
          <p className="text-sm font-semibold">Endpoints</p>
          <ul className="mt-1 space-y-1 text-xs">
            <li><code className="rounded bg-secondary px-1.5 py-0.5">GET /transactions</code> — list your transactions (query: <code>limit</code>, <code>cursor</code>, <code>since</code>)</li>
            <li><code className="rounded bg-secondary px-1.5 py-0.5">GET /transactions/:id</code> — fetch one</li>
            <li><code className="rounded bg-secondary px-1.5 py-0.5">GET /events</code> — normalized ledger events feed</li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">Example — mirror to OpenLedger (Node)</p>
          <pre className="overflow-x-auto rounded bg-secondary p-3 text-xs"><code>{`const KEY = process.env.OPENPAY_LEDGER_KEY;
const BASE = "${FN_BASE}/ledger-api";

async function sync(since) {
  const res = await fetch(\`\${BASE}/transactions?since=\${since}&limit=200\`, {
    headers: { Authorization: \`Bearer \${KEY}\` }
  });
  const { data, next_cursor } = await res.json();
  for (const tx of data) {
    await openledger.upsert({
      external_id: tx.id,
      from: tx.sender_id, to: tx.receiver_id,
      amount: tx.amount, status: tx.status,
      note: tx.note, occurred_at: tx.created_at
    });
  }
  return next_cursor;
}`}</code></pre>
        </div>

        <div>
          <p className="text-sm font-semibold">Example — curl</p>
          <pre className="overflow-x-auto rounded bg-secondary p-3 text-xs"><code>{`curl -H "Authorization: Bearer opk_live_XXXX" \\
  "${FN_BASE}/ledger-api/transactions?limit=50"`}</code></pre>
        </div>

        <div>
          <p className="text-sm font-semibold">Pagination</p>
          <p className="text-xs text-muted-foreground">Responses include <code>next_cursor</code>. Pass it back as <code>?cursor=</code> to fetch older records. Use <code>?since=ISO_DATE</code> for incremental sync.</p>
        </div>

        <div>
          <p className="text-sm font-semibold">Rate limits & scope</p>
          <p className="text-xs text-muted-foreground">Each key is scoped to <code>ledger:read</code> and only returns transactions where the key owner is sender or receiver. Revoke immediately if leaked.</p>
        </div>
      </section>
    </div>
  );
};

export default DeveloperLedgerPage;
