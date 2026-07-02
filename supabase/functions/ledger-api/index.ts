// OpenPay Ledger API — read-only mirror endpoint for external systems.
// Auth: `Authorization: Bearer opk_live_<random>` (issued from /developers/ledger).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Auth
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing Authorization: Bearer <api_key>' }), { status: 401, headers: jsonHeaders });
  }
  const hash = await sha256Hex(token);
  const { data: keyRow } = await admin.from('ledger_api_keys')
    .select('id,user_id,revoked_at,scopes').eq('key_hash', hash).maybeSingle();
  if (!keyRow || keyRow.revoked_at) {
    return new Response(JSON.stringify({ error: 'Invalid or revoked API key' }), { status: 401, headers: jsonHeaders });
  }
  await admin.from('ledger_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id);

  const url = new URL(req.url);
  // Strip function base: /functions/v1/ledger-api  or  /ledger-api
  const path = url.pathname.replace(/^.*ledger-api/, '') || '/';
  const uid = keyRow.user_id as string;
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const cursor = url.searchParams.get('cursor'); // ISO created_at
  const since = url.searchParams.get('since');

  try {
    // GET /transactions
    if (req.method === 'GET' && (path === '/transactions' || path === '/transactions/')) {
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
      const { data, error } = await admin.from('transactions')
        .select('id,sender_id,receiver_id,amount,note,status,created_at')
        .eq('id', txMatch[1]).maybeSingle();
      if (error) throw error;
      if (!data || (data.sender_id !== uid && data.receiver_id !== uid)) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    // GET /events (ledger_events for this user)
    if (req.method === 'GET' && (path === '/events' || path === '/events/')) {
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

    // GET / — service info
    if (req.method === 'GET' && (path === '/' || path === '')) {
      return new Response(JSON.stringify({
        service: 'OpenPay Ledger API',
        version: '1.0',
        endpoints: ['/transactions', '/transactions/:id', '/events'],
      }), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: jsonHeaders });
  }
});
