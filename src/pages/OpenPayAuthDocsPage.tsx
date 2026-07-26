import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, KeyRound, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";

import AuthMark from "@/components/AuthMark";
import OpenPayAuthButton from "@/components/OpenPayAuthButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OPENPAY_AUTH_API_BASE,
  OPENPAY_AUTH_SCOPE_META,
  buildOpenPayAuthorizeUrl,
  getOpenPayAuthSite,
} from "@/lib/openpayAuth";

const copy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
};

const Code = ({ children }: { children: string }) => (
  <div className="group relative">
    <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-100 md:text-sm">
      <code>{children}</code>
    </pre>
    <button
      type="button"
      onClick={() => copy(children)}
      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white opacity-0 transition hover:bg-white/20 group-hover:opacity-100"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  </div>
);

const OpenPayAuthDocsPage = () => {
  const site = getOpenPayAuthSite();
  const [clientId, setClientId] = useState("YOUR_APP_ID");
  const [redirectUri, setRedirectUri] = useState("https://yourapp.com/auth/openpay/callback");
  const [scope, setScope] = useState("profile");

  const authorizeUrl = useMemo(
    () =>
      buildOpenPayAuthorizeUrl({
        clientId: clientId.trim() || "YOUR_APP_ID",
        redirectUri: redirectUri.trim() || "https://yourapp.com/auth/openpay/callback",
        scope: scope.trim() || "profile",
        state: "RANDOM_STATE",
      }),
    [clientId, redirectUri, scope],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#062a78] via-[#0a53d8] to-[#e8f1ff] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-3 text-white">
            <AuthMark className="h-10 w-10" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">OpenPay Auth</p>
              <p className="text-lg font-black">Sign in with OpenPay</p>
            </div>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="secondary"
              className="rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <Link to="/partner-api">
                <KeyRound className="mr-2 h-4 w-4" />
                Get API keys
              </Link>
            </Button>
            <Button asChild className="rounded-full bg-white text-[#1652f0] hover:bg-white/95">
              <a href={`${site}/connect?client_id=demo&redirect_uri=${encodeURIComponent(`${site}/`)}`}>
                Try consent UI
              </a>
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-6 text-white shadow-2xl backdrop-blur md:p-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> OAuth 2.0 · Authorization Code
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Sign in with OpenPay
          </h1>
          <p className="mt-3 max-w-2xl text-white/85">
            Let third-party apps authenticate OpenPay users with a familiar button. Users approve on OpenPay,
            your backend exchanges a one-time code for an access token, then you read profile (and optional
            balance / email) via the Partner API.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#quickstart"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1652f0]"
            >
              <Zap className="h-4 w-4" /> Quickstart
            </a>
            <a
              href="#button"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white"
            >
              Drop-in button
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "1. Register app",
              body: "Create a Partner app on OpenPay, save your client_id + opk_ secret, add redirect URIs.",
            },
            {
              title: "2. Sign in button",
              body: "Send users to /connect (or /oauth/authorize) with client_id, redirect_uri, scope, state.",
            },
            {
              title: "3. Token + /user/me",
              body: "Exchange code on your server, then call GET /user/me with the opa_ access token.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="font-bold text-slate-900">{card.title}</p>
              <p className="mt-1 text-sm text-slate-600">{card.body}</p>
            </div>
          ))}
        </div>

        <div id="quickstart" className="mt-8 space-y-6 rounded-[1.75rem] border bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-black">Quickstart</h2>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Authorize URL</p>
            <Code>{`${site}/connect
  ?client_id=YOUR_APP_ID
  &redirect_uri=https://yourapp.com/auth/openpay/callback
  &scope=profile
  &state=RANDOM_CSRF_TOKEN
  &response_type=code`}</Code>
            <p className="mt-2 text-xs text-slate-500">
              Aliases: <code className="rounded bg-slate-100 px-1">{site}/oauth/authorize</code> and{" "}
              <code className="rounded bg-slate-100 px-1">{site}/oauth2/authorize</code>
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Scopes</p>
            <div className="divide-y overflow-hidden rounded-xl border">
              {Object.entries(OPENPAY_AUTH_SCOPE_META).map(([key, meta]) => (
                <div key={key} className="flex items-start gap-3 p-3">
                  <code className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-[#1652f0]">{key}</code>
                  <div>
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="text-xs text-slate-500">{meta.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Space-separated. Example: <code className="rounded bg-slate-100 px-1">profile email</code> or{" "}
              <code className="rounded bg-slate-100 px-1">profile balance</code>
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Token exchange (backend only)</p>
            <Code>{`curl -X POST "${OPENPAY_AUTH_API_BASE}/oauth/token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "code": "opc_...",
    "redirect_uri": "https://yourapp.com/auth/openpay/callback",
    "client_id": "YOUR_APP_ID",
    "client_secret": "opk_live_YOUR_KEY"
  }'`}</Code>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">User profile</p>
            <Code>{`curl -H "Authorization: Bearer opa_live_..." \\
  ${OPENPAY_AUTH_API_BASE}/user/me`}</Code>
            <Code>{`{
  "user_id": "uuid",
  "account_number": "OP…",
  "full_name": "Alice",
  "username": "alice",
  "avatar_url": "https://…",
  "email": "alice@example.com",
  "balance": 12.5,
  "currency": "OUSD",
  "scope": "profile balance email"
}`}</Code>
            <p className="mt-2 text-xs text-slate-500">
              <code className="rounded bg-slate-100 px-1">email</code> only when scope includes{" "}
              <code className="rounded bg-slate-100 px-1">email</code>.{" "}
              <code className="rounded bg-slate-100 px-1">balance</code> only when scope includes{" "}
              <code className="rounded bg-slate-100 px-1">balance</code>.
            </p>
          </div>
        </div>

        <div id="button" className="mt-8 space-y-5 rounded-[1.75rem] border bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-black">Drop-in button</h2>
          <p className="text-sm text-slate-600">
            Preview with your app id. Register the exact redirect URI on{" "}
            <Link to="/partner-api" className="font-semibold text-[#1652f0] hover:underline">
              Partner API
            </Link>
            .
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="client_id" />
            <Input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} placeholder="redirect_uri" />
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="scope" />
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
            <OpenPayAuthButton
              clientId={clientId.trim() || "YOUR_APP_ID"}
              redirectUri={redirectUri.trim() || "https://yourapp.com/auth/openpay/callback"}
              scope={scope.trim() || "profile"}
            />
          </div>
          <Code>{`<!-- HTML -->
<a href="${authorizeUrl}"
   style="display:inline-flex;align-items:center;gap:10px;background:#1652f0;color:#fff;
   padding:12px 20px;border-radius:12px;font-weight:600;text-decoration:none;">
  <img src="${site}/openpay-o-white.svg" width="20" height="20" alt="" />
  Sign in with OpenPay
</a>`}</Code>
          <Code>{`// React
import { OpenPayAuthButton } from "@/components/OpenPayAuthButton";

<OpenPayAuthButton
  clientId="${clientId.trim() || "YOUR_APP_ID"}"
  redirectUri="${redirectUri.trim() || "https://yourapp.com/auth/openpay/callback"}"
  scope="${scope.trim() || "profile"}"
/>`}</Code>
        </div>

        <div className="mt-8 space-y-4 rounded-[1.75rem] border bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-black">Node.js callback example</h2>
          <Code>{`// POST /auth/openpay/callback  (your backend)
import express from "express";

const API = "${OPENPAY_AUTH_API_BASE}";

app.get("/auth/openpay/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(String(error));
  // TODO: verify state matches what you stored

  const tokenRes = await fetch(\`\${API}/oauth/token\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://yourapp.com/auth/openpay/callback",
      client_id: process.env.OPENPAY_CLIENT_ID,
      client_secret: process.env.OPENPAY_CLIENT_SECRET, // opk_live_…
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) return res.status(400).json(token);

  const meRes = await fetch(\`\${API}/user/me\`, {
    headers: { Authorization: \`Bearer \${token.access_token}\` },
  });
  const me = await meRes.json();

  // Create/link your local session from me.user_id / me.username
  res.json({ token, me });
});`}</Code>
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-black text-slate-900">Security checklist</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Keep <code className="rounded bg-white px-1">opk_live_…</code> on the server only (client_secret).</li>
            <li>Validate <code className="rounded bg-white px-1">state</code> on callback (CSRF).</li>
            <li>Register exact redirect URIs — no wildcards.</li>
            <li>Request only the scopes you need (<code className="rounded bg-white px-1">profile</code> is enough for sign-in).</li>
            <li>Codes expire in ~10 minutes and are single-use; access tokens last 30 days.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/partner-api"
              className="inline-flex items-center gap-2 rounded-full bg-[#1652f0] px-4 py-2 text-sm font-semibold text-white"
            >
              <KeyRound className="h-4 w-4" /> Create Partner app
            </Link>
            <a
              href={OPENPAY_AUTH_API_BASE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#1652f0]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1652f0]"
            >
              <ExternalLink className="h-4 w-4" /> API index
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenPayAuthDocsPage;
