import { supabase } from "@/integrations/supabase/client";

/**
 * OpenPay Partner Transfer API client for the signed-in user session.
 * Docs routes: GET /me, /balance, /accounts/:id, POST /transfers
 * Auth: Bearer <user JWT> (in-app) or Bearer opk_live_… (partner apps — never put opk_ in VITE_*).
 */
const API_BASE =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-transfer-api`;

async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Not signed in. Sign in to OpenPay to send money.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    ...extra,
  };
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { error: text || res.statusText };
  }
  if (!res.ok) {
    const msg =
      (typeof body.error === "string" && body.error) ||
      (typeof body.message === "string" && body.message) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export type PartnerAccount = {
  user_id: string;
  account_number?: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  balance?: number;
  currency?: string;
};

export type PartnerTransferResult = {
  transfer_id?: string;
  transaction_id: string;
  recipient_user_id?: string;
  recipient_username?: string | null;
  sender_balance: number;
  currency: string;
  status: string;
};

/** Normalize recipient to Partner API `to` form: @username | OP… | email */
export function formatPartnerRecipient(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return s;
  if (s.includes("@") && s.includes(".")) return s; // email
  if (/^OP[0-9A-F]+$/i.test(s)) return s.toUpperCase();
  if (s.startsWith("@")) return s;
  return `@${s.replace(/^@/, "")}`;
}

export async function partnerGetMe(): Promise<{
  account: PartnerAccount | null;
}> {
  const res = await fetch(`${API_BASE}/me`, { headers: await authHeaders() });
  const body = await parseJson(res);
  return { account: (body.account as PartnerAccount) || null };
}

export async function partnerGetBalance(): Promise<{
  balance: number;
  currency: string;
}> {
  const res = await fetch(`${API_BASE}/balance`, { headers: await authHeaders() });
  const body = await parseJson(res);
  return {
    balance: Number(body.balance ?? 0),
    currency: String(body.currency || "OUSD"),
  };
}

export async function partnerLookupAccount(
  identifier: string
): Promise<PartnerAccount> {
  const id = encodeURIComponent(formatPartnerRecipient(identifier));
  const res = await fetch(`${API_BASE}/accounts/${id}`, {
    headers: await authHeaders(),
  });
  return (await parseJson(res)) as PartnerAccount;
}

/** POST /transfers — debit signed-in OpenPay balance, credit recipient */
export async function partnerSendTransfer(opts: {
  to: string;
  amount: number;
  note?: string;
  idempotencyKey?: string;
}): Promise<PartnerTransferResult> {
  const idem =
    opts.idempotencyKey ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const res = await fetch(`${API_BASE}/transfers`, {
    method: "POST",
    headers: await authHeaders({ "Idempotency-Key": idem }),
    body: JSON.stringify({
      to: formatPartnerRecipient(opts.to),
      amount: opts.amount,
      note: opts.note || "OpenPay AI transfer",
      idempotency_key: idem,
    }),
  });

  const body = await parseJson(res);
  const txId = String(body.transaction_id || "");
  if (!txId) {
    throw new Error("Transfer succeeded but no transaction_id returned");
  }
  return {
    transfer_id: body.transfer_id ? String(body.transfer_id) : undefined,
    transaction_id: txId,
    recipient_user_id: body.recipient_user_id
      ? String(body.recipient_user_id)
      : undefined,
    recipient_username: (body.recipient_username as string | null) ?? null,
    sender_balance: Number(body.sender_balance ?? 0),
    currency: String(body.currency || "OUSD"),
    status: String(body.status || "completed"),
  };
}
