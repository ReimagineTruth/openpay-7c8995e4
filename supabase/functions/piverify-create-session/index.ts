import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const apiKey = Deno.env.get('PIVERIFY_API_KEY');
    const baseUrl = Deno.env.get('PIVERIFY_BASE_URL') ||
      'https://backend.piverify-czgzri81fq2lioqn.staging.piappengine.com';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'PiVerify not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const idempotencyKey = `${userId}-${Date.now()}`;

    const piRes = await fetch(`${baseUrl}/api/v1/kyc_sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_user_id: userId,
        idempotency_key: idempotencyKey,
      }),
    });

    const piText = await piRes.text();
    let piData: any = {};
    try { piData = JSON.parse(piText); } catch { piData = { raw: piText }; }
    if (!piRes.ok) {
      const msg = piRes.status === 401
        ? 'PiVerify rejected the API key (401). Update PIVERIFY_API_KEY with a currently active key from the PiVerify portal.'
        : (piData?.error || piData?.message || 'PiVerify error');
      return new Response(JSON.stringify({ error: msg, upstream_status: piRes.status, upstream: piData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    await admin.from('piverify_sessions').upsert({
      user_id: userId,
      session_id: piData.id,
      external_user_id: piData.external_user_id,
      status: piData.status || 'created',
      hosted_flow_url: piData.hosted_flow_url,
      rejection_reason: piData.rejection_reason,
    }, { onConflict: 'session_id' });

    return new Response(JSON.stringify({
      session_id: piData.id,
      hosted_flow_url: piData.hosted_flow_url,
      status: piData.status,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
