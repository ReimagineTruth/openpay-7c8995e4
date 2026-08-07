// OpenPay Ledger API — public read-only mirror endpoint for external systems.
// Supports both public access (for OpenLedger) and authenticated access (for user-specific data).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const CATEGORY_ALIASES: Record<string, string> = {
  all: 'all',
  topup: 'topup',
  'top-up': 'topup',
  deposit: 'topup',
  withdraw: 'withdraw',
  withdrawal: 'withdraw',
  payout: 'withdraw',
  swap: 'swap',
  exchange: 'swap',
  convert: 'swap',
  nft: 'nft',
  mint: 'nft',
  auction: 'nft',
  staking: 'staking',
  stake: 'staking',
  loan: 'loan',
  borrow: 'loan',
  affiliate: 'affiliate',
  referral: 'affiliate',
  mining: 'mining',
  reward: 'mining',
  other: 'other',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*ledger-api/, '') || '/';
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
  const cursor = url.searchParams.get('cursor'); // ISO occurred_at
  const since = url.searchParams.get('since');
  const rawCategory = (url.searchParams.get('category') || '').toLowerCase().trim();
  const category = rawCategory && rawCategory !== 'all' ? (CATEGORY_ALIASES[rawCategory] || rawCategory) : null;
  const search = url.searchParams.get('search');

  // Optional API key auth (for user-specific data + webhook registration)
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  let uid: string | null = null;

  if (token) {
    const hash = await sha256Hex(token);
    const { data: keyRow } = await admin.from('ledger_api_keys')
      .select('id,user_id,revoked_at,scopes').eq('key_hash', hash).maybeSingle();
    if (keyRow && !keyRow.revoked_at) {
      uid = keyRow.user_id as string;
      await admin.from('ledger_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id);
    }
  }

  try {
    // GET / — service info
    if (req.method === 'GET' && (path === '/' || path === '')) {
      return new Response(JSON.stringify({
        service: 'OpenPay Ledger API',
        version: '2.0',
        base_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ledger-api`,
        endpoints: {
          public: [
            { method: 'GET', path: '/public', params: ['limit', 'offset', 'cursor', 'since', 'category', 'search'] },
            { method: 'GET', path: '/stats' },
          ],
          authenticated: [
            { method: 'GET', path: '/transactions' },
            { method: 'GET', path: '/transactions/:id' },
            { method: 'GET', path: '/events' },
            { method: 'GET', path: '/webhooks' },
            { method: 'POST', path: '/webhooks', body: { url: 'string', event_types: 'string[] (optional)' } },
            { method: 'DELETE', path: '/webhooks/:id' },
          ],
        },
        categories: ['topup', 'withdraw', 'swap', 'nft', 'staking', 'loan', 'affiliate', 'mining', 'other'],
      }, null, 2), { headers: jsonHeaders });
    }

    // GET /stats — aggregate counters (public)
    if (req.method === 'GET' && (path === '/stats' || path === '/stats/')) {
      const { data, error } = await admin.rpc('get_public_ledger_stats');
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    // GET /public — full OpenLedger stream (public, no auth)
    if (req.method === 'GET' && (path === '/public' || path === '/public/')) {
      const { data, error } = await admin.rpc('get_public_ledger_v2', {
        p_limit: limit,
        p_offset: offset,
        p_category: category,
        p_search: search,
      });
      if (error) throw error;

      let rows = (data || []) as Array<Record<string, unknown>>;

      // Optional cursor/since post-filter (RPC already sorts desc by occurred_at)
      if (cursor) rows = rows.filter((r) => String(r.occurred_at) < cursor);
      if (since) rows = rows.filter((r) => String(r.occurred_at) >= since);

      const shaped = rows.map((r) => {
        const payload = (r.payload && typeof r.payload === 'object') ? r.payload as Record<string, unknown> : {};
        const externalRef =
          String(payload.transaction_ref || payload.order_id || payload.external_ref || r.id || '');
        const currency =
          String(payload.currency || payload.currency_code || r.currency_code || 'OUSD').toUpperCase();
        const fromUser = r.sender_username ? `@${r.sender_username}` : (r.sender_name || null);
        const toUser = r.receiver_username ? `@${r.receiver_username}` : (r.receiver_name || null);
        const isQr = String(r.source_table || '') === 'qr_payment_transactions' ||
          String(r.event_type || '').startsWith('qr_pay_');
        return {
          // OpenLedger pull-model: stable id → external_ref for /tx/ref/{id}
          id: externalRef || r.id,
          external_ref: externalRef || r.id,
          source: 'openpay',
          type: isQr ? 'merchant_payment' : 'payment',
          from_address: fromUser,
          to_address: toUser,
          amount: r.amount,
          currency,
          network_fee: 0,
          status: String(r.status || 'completed') === 'succeeded' ? 'confirmed' : (r.status || 'confirmed'),
          merchant_id: payload.token || payload.merchant_id || null,
          timestamp: r.occurred_at,
          created_at: r.occurred_at,
          metadata: {
            ...payload,
            event_type: r.event_type,
            source_table: r.source_table,
            category: r.category,
            note: r.note,
            openpay_ledger_event_id: r.id,
          },
          // Keep original OpenPay fields for dashboards
          source_table: r.source_table,
          event_type: r.event_type,
          category: r.category,
          currency_code: currency,
          note: r.note,
          sender: {
            name: r.sender_name || null,
            username: r.sender_username || null,
            avatar: r.sender_avatar || null,
          },
          receiver: {
            name: r.receiver_name || null,
            username: r.receiver_username || null,
            avatar: r.receiver_avatar || null,
          },
          sender_amount: r.sender_amount,
          sender_currency_code: r.sender_currency_code,
          receiver_amount: r.receiver_amount,
          receiver_currency_code: r.receiver_currency_code,
          occurred_at: r.occurred_at,
        };
      });

      const next_cursor = shaped.length === limit ? String(shaped[shaped.length - 1].occurred_at) : null;
      const next_offset = shaped.length === limit ? offset + limit : null;
      return new Response(JSON.stringify({ data: shaped, next_cursor, next_offset, count: shaped.length }), { headers: jsonHeaders });
    }

    // GET /transactions (requires auth for user-specific data)
    if (req.method === 'GET' && (path === '/transactions' || path === '/transactions/')) {
      if (!uid) {
        return new Response(JSON.stringify({ error: 'Authentication required for user-specific data. Use /public for public ledger data.' }), { status: 401, headers: jsonHeaders });
      }

      let q = admin.from('transactions')
        .select('id,sender_id,receiver_id,amount,note,status,created_at')
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (cursor) q = q.lt('created_at', cursor);
      if (since) q = q.gte('created_at', since);
      const { data, error } = await q;
      if (error) throw error;
      const next = data && data.length === limit ? data[data.length - 1].created_at : null;
      return new Response(JSON.stringify({ data, next_cursor: next }), { headers: jsonHeaders });
    }

    // GET /transactions/:id
    const txMatch = path.match(/^\/transactions\/([0-9a-f-]{36})$/i);
    if (req.method === 'GET' && txMatch) {
      if (!uid) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: jsonHeaders });
      const { data, error } = await admin.from('transactions')
        .select('id,sender_id,receiver_id,amount,note,status,created_at')
        .eq('id', txMatch[1]).maybeSingle();
      if (error) throw error;
      if (!data || (data.sender_id !== uid && data.receiver_id !== uid)) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    // GET /events (requires auth)
    if (req.method === 'GET' && (path === '/events' || path === '/events/')) {
      if (!uid) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: jsonHeaders });
      let q = admin.from('ledger_events')
        .select('id,source_table,source_id,event_type,actor_user_id,related_user_id,amount,status,note,payload,occurred_at,recorded_at')
        .or(`actor_user_id.eq.${uid},related_user_id.eq.${uid}`)
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (cursor) q = q.lt('occurred_at', cursor);
      if (since) q = q.gte('occurred_at', since);
      const { data, error } = await q;
      if (error) throw error;
      const next = data && data.length === limit ? data[data.length - 1].occurred_at : null;
      return new Response(JSON.stringify({ data, next_cursor: next }), { headers: jsonHeaders });
    }

    // Webhook registrations (requires auth)
    if (path === '/webhooks' || path === '/webhooks/') {
      if (!uid) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: jsonHeaders });

      if (req.method === 'GET') {
        const { data, error } = await admin.from('ledger_webhook_endpoints')
          .select('id,url,event_types,is_active,last_delivered_at,last_error,created_at')
          .eq('user_id', uid).order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
      }

      if (req.method === 'POST') {
        let body: { url?: string; event_types?: string[]; secret?: string } = {};
        try { body = await req.json(); } catch { /* ignore */ }
        if (!body.url || !/^https?:\/\//i.test(body.url)) {
          return new Response(JSON.stringify({ error: 'Missing or invalid url' }), { status: 400, headers: jsonHeaders });
        }
        const secret = body.secret || crypto.randomUUID().replace(/-/g, '');
        const { data, error } = await admin.from('ledger_webhook_endpoints').insert({
          user_id: uid,
          url: body.url,
          event_types: Array.isArray(body.event_types) ? body.event_types : [],
          secret,
          is_active: true,
        }).select('id,url,event_types,is_active,created_at').maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ data, secret }), { headers: jsonHeaders });
      }
    }

    const whMatch = path.match(/^\/webhooks\/([0-9a-f-]{36})$/i);
    if (whMatch && req.method === 'DELETE') {
      if (!uid) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: jsonHeaders });
      const { error } = await admin.from('ledger_webhook_endpoints')
        .delete().eq('id', whMatch[1]).eq('user_id', uid);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: jsonHeaders });
  }
});
