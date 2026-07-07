// OpenPay Ledger API — public read-only mirror endpoint for external systems.
// Supports both public access (for OpenLedger) and authenticated access (for user-specific data).
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

  const url = new URL(req.url);
  // Strip function base: /functions/v1/ledger-api  or  /ledger-api
  const path = url.pathname.replace(/^.*ledger-api/, '') || '/';
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const cursor = url.searchParams.get('cursor'); // ISO created_at
  const since = url.searchParams.get('since');
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');

  // Check for optional API key authentication (for user-specific data)
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
        version: '1.0',
        endpoints: ['/public', '/transactions', '/transactions/:id', '/events'],
        authentication: 'Optional - API key required for user-specific data, public endpoints available',
      }), { headers: jsonHeaders });
    }

    // GET /public - public OpenLedger data (no auth required)
    if (req.method === 'GET' && (path === '/public' || path === '/public/')) {
      let q = admin.from('ledger_events')
        .select('id,source_table,source_id,event_type,actor_user_id,related_user_id,amount,status,note,payload,occurred_at,recorded_at')
        .order('occurred_at', { ascending: false })
        .limit(limit);
      
      if (cursor) q = q.lt('occurred_at', cursor);
      if (since) q = q.gte('occurred_at', since);
      
      // Filter by category if provided
      if (category) {
        const cat = category.toLowerCase();
        q = q.ilike('event_type', `%${cat}%`);
      }
      
      // Search by username if provided
      if (search) {
        const searchLower = search.toLowerCase();
        q = q.or(`note.ilike.%${searchLower}%`);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      
      // Redact sensitive information for public view
      const publicData = (data || []).map((item: any) => {
        const redactedNote = item.note
          ?.replace(/@[\w.-]+/g, '@hidden')
          .replace(/OpenPay\s+[A-Za-z0-9_.-]+/g, 'OpenPay [hidden]')
          .replace(/\bWallet\s+[A-Za-z0-9-]{6,}\b/g, 'Wallet [hidden]')
          .replace(/\bOPEA[0-9A-Z]{6,}\b/g, 'OPEA****')
          .replace(/\bOP[A-Z0-9]{6,}\b/g, (match: string) => `${match.slice(0, 4)}****`);
        
        return {
          ...item,
          note: redactedNote,
          payload: item.payload ? {
            ...item.payload,
            sender_id: '***',
            receiver_id: '***',
            actor_user_id: '***',
            related_user_id: '***',
          } : null,
        };
      });
      
      const next = publicData && publicData.length === limit ? publicData[publicData.length - 1].occurred_at : null;
      return new Response(JSON.stringify({ data: publicData, next_cursor: next }), { headers: jsonHeaders });
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

    // GET /transactions/:id (requires auth)
    const txMatch = path.match(/^\/transactions\/([0-9a-f-]{36})$/i);
    if (req.method === 'GET' && txMatch) {
      if (!uid) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: jsonHeaders });
      }
      
      const { data, error } = await admin.from('transactions')
        .select('id,sender_id,receiver_id,amount,note,status,created_at')
        .eq('id', txMatch[1]).maybeSingle();
      if (error) throw error;
      if (!data || (data.sender_id !== uid && data.receiver_id !== uid)) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ data }), { headers: jsonHeaders });
    }

    // GET /events (requires auth for user-specific data)
    if (req.method === 'GET' && (path === '/events' || path === '/events/')) {
      if (!uid) {
        return new Response(JSON.stringify({ error: 'Authentication required for user-specific data. Use /public for public ledger data.' }), { status: 401, headers: jsonHeaders });
      }
      
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

    return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: jsonHeaders });
  }
});
