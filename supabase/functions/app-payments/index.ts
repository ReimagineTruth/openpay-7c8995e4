import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!

function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

function createUserClient(authHeader: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: errorResponse("Authorization required", 401) }
  }

  const supabase = createUserClient(authHeader)
  const token = authHeader.replace("Bearer ", "")
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { error: errorResponse("Invalid token", 401) }
  }

  return { supabase, user }
}

function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  )
}

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
    const supabase = createAdminClient()

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
    } else if (path === "get-payment-links" && method === "GET") {
      return await handleGetPaymentLinks(req, supabase)
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
    const message = error instanceof Error ? error.message : "Unexpected error"
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})

async function handleCreateApp(req: Request, supabase: any) {
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const body = await req.json()
  const appName = body.app_name ?? body.name
  const appDescription = body.app_description ?? body.description ?? null
  const appUrl = body.app_url ?? body.url ?? null
  const appLogoUrl = body.app_logo_url ?? body.logo_url ?? null
  const webhookUrl = body.webhook_url ?? null

  if (!appName || !String(appName).trim()) {
    return errorResponse("App name is required")
  }

  const { data, error } = await supabase
    .from("app_registry")
    .insert({
      app_name: String(appName).trim(),
      app_description: typeof appDescription === "string" && appDescription.trim() ? appDescription.trim() : null,
      app_url: typeof appUrl === "string" && appUrl.trim() ? appUrl.trim() : null,
      app_logo_url: typeof appLogoUrl === "string" && appLogoUrl.trim() ? appLogoUrl.trim() : null,
      webhook_url: typeof webhookUrl === "string" && webhookUrl.trim() ? webhookUrl.trim() : null,
      developer_user_id: auth.user.id,
    })
    .select("id, app_secret_key, app_public_key")
    .single()

  if (error) {
    return errorResponse(error.message)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: data
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleCreatePlan(req: Request, supabase: any) {
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const body = await req.json()
  const appId = body.app_id
  const planName = body.plan_name ?? body.name
  const planDescription = body.plan_description ?? body.description ?? null
  const planType = body.plan_type ?? body.type
  const amount = body.amount
  const currency = body.currency
  const trialDays = body.trial_days
  const setupFee = body.setup_fee

  if (!appId || !planName || !planType || !amount) {
    return errorResponse("Missing required fields")
  }

  const { data, error } = await auth.supabase.rpc("create_app_payment_plan", {
    p_app_id: appId,
    p_plan_name: planName,
    p_plan_description: planDescription,
    p_plan_type: planType,
    p_amount: amount,
    p_currency: currency || "USD",
    p_trial_days: trialDays || 0,
    p_setup_fee: setupFee || 0
  })

  if (error) {
    return errorResponse(error.message)
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
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const { data, error } = await auth.supabase
    .from("app_registry")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return errorResponse(error.message)
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
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const url = new URL(req.url)
  const appId = url.searchParams.get("app_id")

  if (!appId) {
    return errorResponse("app_id parameter required")
  }

  const { data, error } = await auth.supabase
    .from("app_payment_plans")
    .select("*")
    .eq("app_id", appId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    return errorResponse(error.message)
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
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const { app_id, plan_id, link_name, link_description, redirect_url, custom_data, expires_at, max_usage } = await req.json()

  if (!app_id || !plan_id || !link_name) {
    return errorResponse("Missing required fields")
  }

  const linkToken = generateRandomToken()
  
  const { data, error } = await auth.supabase
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
    return errorResponse(error.message)
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
    return errorResponse("token parameter required")
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
    return errorResponse("Payment link not found or inactive", 404)
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
  const body = await req.json()
  const {
    link_token,
    payer_account,
    payer_pin,
    payment_method,
    customer_name,
    customer_email,
    customer_phone,
  } = body

  if (!link_token) {
    return new Response(
      JSON.stringify({ error: "link_token is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
  if (!payer_account) {
    return new Response(
      JSON.stringify({ error: "Account number or email is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { data, error } = await supabase.rpc("process_app_payment_public", {
    p_link_token: link_token,
    p_payer_account: payer_account,
    p_payer_pin: payer_pin ?? null,
    p_payment_method: payment_method || "wallet",
    p_customer_name: customer_name ?? null,
    p_customer_email: customer_email ?? null,
    p_customer_phone: customer_phone ?? null,
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
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const url = new URL(req.url)
  const appId = url.searchParams.get("app_id")
  const startDate = url.searchParams.get("start_date")
  const endDate = url.searchParams.get("end_date")

  if (!appId) {
    return errorResponse("app_id parameter required")
  }

  let query = auth.supabase
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
    return errorResponse(error.message)
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
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const url = new URL(req.url)
  const appId = url.searchParams.get("app_id")
  const userId = url.searchParams.get("user_id")

  let query = auth.supabase
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
    return errorResponse(error.message)
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleGetPaymentLinks(req: Request, supabase: any) {
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const url = new URL(req.url)
  const appId = url.searchParams.get("app_id")

  if (!appId) {
    return errorResponse("app_id parameter required")
  }

  const { data, error } = await auth.supabase
    .from("app_payment_links")
    .select(`
      *,
      app_payment_plans(plan_name, amount, currency)
    `)
    .eq("app_id", appId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    return errorResponse(error.message)
  }

  // Add payment URLs to the response
  const paymentLinksWithUrls = data?.map((link: any) => ({
    ...link,
    payment_url: `${supabaseUrl}/functions/v1/app-payments/checkout?token=${link.link_token}`
  }))

  return new Response(
    JSON.stringify({ success: true, data: paymentLinksWithUrls }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  )
}

async function handleCancelSubscription(req: Request, supabase: any) {
  const auth = await requireUser(req)
  if (auth.error) {
    return auth.error
  }

  const { subscription_id } = await req.json()

  if (!subscription_id) {
    return errorResponse("subscription_id is required")
  }

  const { data, error } = await auth.supabase
    .from("app_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString()
    })
    .eq("id", subscription_id)
    .select()
    .single()

  if (error) {
    return errorResponse(error.message)
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
