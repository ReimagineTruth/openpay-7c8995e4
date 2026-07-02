// Manage OpenPay Ledger API keys (list/create/revoke). Returns the raw key ONCE at creation.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (cErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders });
  }
  const uid = claims.claims.sub as string;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (req.method === 'GET') {
      const { data, error } = await admin.from('ledger_api_keys')
        .select('id,name,key_prefix,scopes,last_used_at,revoked_at,created_at')
        .eq('user_id', uid).order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const name = String(body?.name || 'Default key').slice(0, 64);
      const raw = `opk_live_${randomToken(24)}`;
      const hash = await sha256Hex(raw);
      const prefix = raw.slice(0, 16);
      const { data, error } = await admin.from('ledger_api_keys').insert({
        user_id: uid, name, key_prefix: prefix, key_hash: hash,
      }).select('id,name,key_prefix,created_at').single();
      if (error) throw error;
      return new Response(JSON.stringify({ ...data, api_key: raw }), { headers: jsonHeaders, status: 201 });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: jsonHeaders });
      const { error } = await admin.from('ledger_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', uid);
      if (error) throw error;
      return new Response(JSON.stringify({ revoked: true }), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: jsonHeaders });
  }
});
