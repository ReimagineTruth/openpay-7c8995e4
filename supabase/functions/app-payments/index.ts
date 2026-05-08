import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname.split("/").pop()
    const method = req.method

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Route handling
    if (path === "create-app" && method === "POST") {
      return await handleCreateApp(req, supabase)
    } else if (path === "create-plan" && method === "POST") {
      return await handleCreatePlan(req, supabase)
    } else if (path === "get-apps" && method === "GET") {
      return await handleGetApps(req, supabase)
    } else if (path === "get-plans" && method === "GET") {
      return await handleGetPlans(req, supabase)
    } else if (path === "create-payment-link" && method === "POST") {
      return await handleCreatePaymentLink(req, supabase)
    } else if (path === "get-payment-link" && method === "GET") {
      return await handleGetPaymentLink(req, supabase)
    } else if (path === "process-payment" && method === "POST") {
      return await handleProcessPayment(req, supabase)
    } else if (path === "get-analytics" && method === "GET") {
      return await handleGetAnalytics(req, supabase)
    } else if (path === "get-subscriptions" && method === "GET") {
      return await handleGetSubscriptions(req, supabase)
    } else if (path === "cancel-subscription" && method === "POST") {
      return await handleCancelSubscription(req, supabase)
    } else {
      return new Response(
        JSON.stringify({ error: "Endpoint not found" }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }
  } catch (error) {
    console.error("Error in app-payments function:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})

async function handleCreateApp(req: Request, supabase: any) {
  const { app_name, app_description, app_url, app_logo_url, webhook_url } = await req.json()

  if (!app_name) {
    return new Response(
      JSON.stringify({ error: "App name is required" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const { data, error } = await supabase.rpc("create_app", {
    p_app_name: app_name,
    p_app_description: app_description,
    p_app_url: app_url,
    p_app_logo_url: app_logo_url,
    p_webhook_url: webhook_url
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: Array.isArray(data) ? data[0] : data 
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleCreatePlan(req: Request, supabase: any) {
  const { app_id, plan_name, plan_description, plan_type, amount, currency, trial_days, setup_fee } = await req.json()

  if (!app_id || !plan_name || !plan_type || !amount) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const { data, error } = await supabase.rpc("create_app_payment_plan", {
    p_app_id: app_id,
    p_plan_name: plan_name,
    p_plan_description: plan_description,
    p_plan_type: plan_type,
    p_amount: amount,
    p_currency: currency || "USD",
    p_trial_days: trial_days || 0,
    p_setup_fee: setup_fee || 0
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: Array.isArray(data) ? data[0] : data 
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleGetApps(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const token = authHeader.replace("Bearer ", "")
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const { data, error } = await supabase
    .from("app_registry")
    .select("*")
    .eq("developer_user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleGetPlans(req: Request, supabase: any) {
  const url = new URL(req.url)
  const appId = url.searchParams.get("app_id")

  if (!appId) {
    return new Response(
      JSON.stringify({ error: "app_id parameter required" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const { data, error } = await supabase
    .from("app_payment_plans")
    .select("*")
    .eq("app_id", appId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleCreatePaymentLink(req: Request, supabase: any) {
  const { app_id, plan_id, link_name, link_description, redirect_url, custom_data, expires_at, max_usage } = await req.json()

  if (!app_id || !plan_id || !link_name) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const linkToken = generateRandomToken()
  
  const { data, error } = await supabase
    .from("app_payment_links")
    .insert({
      app_id,
      plan_id,
      link_token: linkToken,
      link_name,
      link_description,
      redirect_url,
      custom_data: custom_data || {},
      expires_at: expires_at || null,
      max_usage: max_usage || null
    })
    .select()
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        ...data,
        payment_url: `${supabaseUrl}/functions/v1/app-payments/checkout?token=${linkToken}`
      }
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleGetPaymentLink(req: Request, supabase: any) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return new Response(
      JSON.stringify({ error: "token parameter required" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const { data, error } = await supabase
    .from("app_payment_links")
    .select(`
      *,
      app_payment_plans(*),
      app_registry(app_name, app_logo_url, developer_user_id)
    `)
    .eq("link_token", token)
    .eq("is_active", true)
    .single()

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: "Payment link not found or inactive" }),
      { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleProcessPayment(req: Request, supabase: any) {
  const { link_token, payer_user_id, payment_method, customer_name, customer_email, customer_phone } = await req.json()

  if (!link_token) {
    return new Response(
      JSON.stringify({ error: "link_token is required" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const { data, error } = await supabase.rpc("process_app_payment", {
    p_link_token: link_token,
    p_payer_user_id: payer_user_id,
    p_payment_method: payment_method || "wallet",
    p_customer_name: customer_name,
    p_customer_email: customer_email,
    p_customer_phone: customer_phone
  })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: Array.isArray(data) ? data[0] : data 
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleGetAnalytics(req: Request, supabase: any) {
  const url = new URL(req.url)
  const appId = url.searchParams.get("app_id")
  const startDate = url.searchParams.get("start_date")
  const endDate = url.searchParams.get("end_date")

  if (!appId) {
    return new Response(
      JSON.stringify({ error: "app_id parameter required" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  let query = supabase
    .from("app_analytics")
    .select("*")
    .eq("app_id", appId)

  if (startDate) {
    query = query.gte("date", startDate)
  }

  if (endDate) {
    query = query.lte("date", endDate)
  }

  const { data, error } = await query.order("date", { ascending: false })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  // Calculate totals
  const totals = data?.reduce((acc: any, row: any) => ({
    total_revenue: acc.total_revenue + parseFloat(row.total_revenue),
    total_transactions: acc.total_transactions + row.total_transactions,
    new_subscriptions: acc.new_subscriptions + row.new_subscriptions,
    canceled_subscriptions: acc.canceled_subscriptions + row.canceled_subscriptions,
    active_subscriptions: row.active_subscriptions, // Latest value
    refunds: acc.refunds + parseFloat(row.refunds),
    refund_count: acc.refund_count + row.refund_count
  }), {
    total_revenue: 0,
    total_transactions: 0,
    new_subscriptions: 0,
    canceled_subscriptions: 0,
    active_subscriptions: 0,
    refunds: 0,
    refund_count: 0
  })

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: {
        daily_analytics: data,
        totals
      }
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleGetSubscriptions(req: Request, supabase: any) {
  const url = new URL(req.url)
  const appId = url.searchParams.get("app_id")
  const userId = url.searchParams.get("user_id")

  let query = supabase
    .from("app_subscriptions")
    .select(`
      *,
      app_payment_plans(*),
      app_registry(app_name, app_logo_url)
    `)

  if (appId) {
    query = query.eq("app_id", appId)
  }

  if (userId) {
    query = query.eq("subscriber_user_id", userId)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleCancelSubscription(req: Request, supabase: any) {
  const { subscription_id } = await req.json()

  if (!subscription_id) {
    return new Response(
      JSON.stringify({ error: "subscription_id is required" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  const { data, error } = await supabase
    .from("app_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString()
    })
    .eq("id", subscription_id)
    .select()
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

function generateRandomToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}
