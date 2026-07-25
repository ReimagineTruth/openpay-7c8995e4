// OpenPay Partner Transfer API
// Public REST API for external wallets/apps to look up accounts and move
// balance in/out of OpenPay. Authenticates via `Authorization: Bearer opk_...`
// (partner API key) issued from /partner-api.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function err(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: jsonHeaders });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*partner-transfer-api/, '') || '/';

  // Public health/info
  if (req.method === 'GET' && (path === '/' || path === '/health')) {
    return ok({
      service: 'OpenPay Partner Transfer API',
      version: '1.1.0',
      docs: 'https://openpay.lovable.app/partner-api',
      endpoints: [
        'GET  /health',
        'GET  /me',
        'GET  /accounts/:identifier',
        'GET  /balance',
        'POST /transfers',
        'GET  /transfers?limit=&direction=',
        'POST /charges                         — create a PayButton checkout',
        'GET  /charges/:id                     — check charge status',
        'GET  /charges?limit=&status=          — list charges',
        'POST /charges/:id/cancel              — cancel unpaid charge',
      ],
    });
  }


  // Auth: partner API key
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token || !token.startsWith('opk_')) {
    return err('Missing or invalid API key. Use `Authorization: Bearer opk_...`', 401);
  }
  const hash = await sha256Hex(token);
  const { data: appRow } = await admin
    .from('partner_apps')
    .select('id, owner_user_id, name, is_active, allowed_origins')
    .eq('key_hash', hash)
    .maybeSingle();
  if (!appRow || !appRow.is_active) return err('API key not recognized or revoked', 401);

  // Optional origin check
  const origin = req.headers.get('origin') || '';
  if (appRow.allowed_origins?.length && origin && !appRow.allowed_origins.includes(origin)) {
    return err('Origin not allowed for this partner app', 403);
  }

  await admin.from('partner_apps').update({ last_used_at: new Date().toISOString() }).eq('id', appRow.id);
  const ownerId = appRow.owner_user_id as string;

  try {
    // /me
    if (req.method === 'GET' && path === '/me') {
      const { data: profile } = await admin
        .from('profiles').select('id, full_name, username, avatar_url').eq('id', ownerId).maybeSingle();
      const { data: wallet } = await admin.from('wallets').select('balance').eq('user_id', ownerId).maybeSingle();
      return ok({
        partner_app: { id: appRow.id, name: appRow.name },
        account: profile ? {
          user_id: profile.id,
          account_number: 'OP' + String(profile.id).replace(/-/g, '').toUpperCase(),
          full_name: profile.full_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          balance: Number(wallet?.balance ?? 0),
          currency: 'OUSD',
        } : null,
      });
    }

    // /balance
    if (req.method === 'GET' && path === '/balance') {
      const { data: wallet } = await admin.from('wallets').select('balance, updated_at').eq('user_id', ownerId).maybeSingle();
      return ok({ balance: Number(wallet?.balance ?? 0), currency: 'OUSD', updated_at: wallet?.updated_at ?? null });
    }

    // /accounts/:identifier
    const accountMatch = path.match(/^\/accounts\/(.+)$/);
    if (req.method === 'GET' && accountMatch) {
      const identifier = decodeURIComponent(accountMatch[1]);
      const { data, error } = await admin.rpc('partner_lookup_account', { p_identifier: identifier });
      if (error) return err(error.message, 500);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return err('Account not found', 404);
      return ok({
        user_id: row.user_id,
        account_number: row.account_number,
        full_name: row.full_name,
        username: row.username,
        avatar_url: row.avatar_url,
        currency: row.currency,
      });
    }

    // /transfers
    if (req.method === 'GET' && path === '/transfers') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
      const direction = url.searchParams.get('direction');
      let q = admin.from('partner_transfers')
        .select('id, direction, counterparty_user_id, counterparty_identifier, amount, currency, note, status, transaction_id, created_at')
        .eq('partner_app_id', appRow.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (direction === 'debit' || direction === 'credit') q = q.eq('direction', direction);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ data });
    }

    if (req.method === 'POST' && path === '/transfers') {
      const body = await req.json().catch(() => ({}));
      const to = String(body?.to ?? body?.recipient ?? '').trim();
      const amount = Number(body?.amount);
      const note = String(body?.note ?? '').slice(0, 200);
      const idem = req.headers.get('Idempotency-Key') || body?.idempotency_key || null;
      if (!to) return err('`to` (account_number | @username | email) is required');
      if (!Number.isFinite(amount) || amount <= 0) return err('`amount` must be > 0');

      const { data, error } = await admin.rpc('partner_transfer_send', {
        p_sender_user_id: ownerId,
        p_partner_app_id: appRow.id,
        p_recipient_identifier: to,
        p_amount: amount,
        p_note: note,
        p_idempotency_key: idem,
      });
      if (error) return err(error.message, 400);
      const row = Array.isArray(data) ? data[0] : data;
      return ok({
        transfer_id: row?.transfer_id,
        transaction_id: row?.transaction_id,
        recipient_user_id: row?.recipient_user_id,
        sender_balance: Number(row?.sender_balance ?? 0),
        currency: 'OUSD',
        status: row?.status,
      }, 201);
    }

    return err('Not found', 404);
  } catch (e) {
    return err((e as Error).message || 'Internal error', 500);
  }
});
