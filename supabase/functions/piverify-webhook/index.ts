import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

async function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  
  // Extract the hex signature from the "sha256=" prefix if present
  const expected = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  
  // Import the secret key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw', 
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  );
  
  // Generate HMAC-SHA256 signature of the raw body
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  
  // Convert signature buffer to hex string
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  
  // Compare signatures using constant-time comparison to prevent timing attacks
  if (hex.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-piverify-signature');
    const secret = Deno.env.get('PIVERIFY_WEBHOOK_SECRET');

    // If secret is configured, verify signature
    if (secret) {
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing signature header' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const ok = await verifySignature(rawBody, signature, secret);
      if (!ok) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let event: any;
    try { event = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Received PiVerify webhook event:', event);

    const data = event?.data || {};
    const sessionId = data.session_id;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Missing session_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Supabase environment variables missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    console.log(`Updating piverify session ${sessionId} with status: ${data.status || event.type?.replace('kyc.session.', '') || 'updated'}`);

    const { error: updateError } = await admin.from('piverify_sessions').update({
      status: data.status || event.type?.replace('kyc.session.', '') || 'updated',
      rejection_reason: data.rejection_reason ?? null,
      allowed_action: data.allowed_action ?? null,
      last_event: event,
    }).eq('session_id', sessionId);
    
    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update session', details: updateError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('piverify-webhook error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
