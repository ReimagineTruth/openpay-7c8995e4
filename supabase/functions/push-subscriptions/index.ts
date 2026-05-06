import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const { method } = req;
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    // Handle different actions
    if (method === "POST" && (action === "subscribe" || action === "save")) {
      const body = await req.json().catch(() => ({}));
      const { endpoint, p256dh, auth, device } = body;

      if (!endpoint || !p256dh || !auth) {
        return json({ 
          success: false, 
          error: "Missing required fields: endpoint, p256dh, auth" 
        }, 400);
      }

      const { data, error } = await supabase.rpc("save_push_subscription", {
        p_user_id: user.id,
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_device: device || null
      });

      if (error) {
        console.error("Save subscription error:", error);
        return json({ success: false, error: error.message }, 500);
      }

      return json(data);
    }

    if (method === "DELETE" && (action === "unsubscribe" || action === "delete")) {
      const body = await req.json().catch(() => ({}));
      const { endpoint } = body;

      if (!endpoint) {
        return json({ 
          success: false, 
          error: "Missing required field: endpoint" 
        }, 400);
      }

      const { data, error } = await supabase.rpc("delete_push_subscription", {
        p_endpoint: endpoint
      });

      if (error) {
        console.error("Delete subscription error:", error);
        return json({ success: false, error: error.message }, 500);
      }

      return json(data);
    }

    if (method === "GET" && (action === "list" || action === "subscriptions")) {
      const { data, error } = await supabase.rpc("get_user_push_subscriptions", {
        p_user_id: user.id
      });

      if (error) {
        console.error("Get subscriptions error:", error);
        return json({ success: false, error: error.message }, 500);
      }

      return json(data);
    }

    if (method === "POST" && action === "check") {
      const body = await req.json().catch(() => ({}));
      const { endpoint } = body;

      if (!endpoint) {
        return json({ 
          success: false, 
          error: "Missing required field: endpoint" 
        }, 400);
      }

      const { data: existing, error: checkError } = await supabase
        .from("push_subscriptions")
        .select("id, user_id, device, created_at")
        .eq("endpoint", endpoint)
        .maybeSingle();

      if (checkError) {
        console.error("Check subscription error:", checkError);
        return json({ success: false, error: checkError.message }, 500);
      }

      return json({
        success: true,
        exists: !!existing,
        subscription: existing
      });
    }

    return json({ 
      success: false, 
      error: "Invalid action or method" 
    }, 400);

  } catch (error) {
    console.error("Push subscriptions API error:", error);
    return json({ 
      success: false, 
      error: "Internal server error" 
    }, 500);
  }
});
