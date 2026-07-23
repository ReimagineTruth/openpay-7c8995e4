// Public KYC metrics API — read-only, no auth, CORS-open.
// For OpenLedger and external integrations to display OpenPay KYC verification stats.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SITE_BASE = (Deno.env.get("OPENPAY_PUBLIC_SITE") || "https://openpay.lovable.app").replace(/\/+$/, "");

const json = (body: unknown, status = 200, cache = 30) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${cache}, stale-while-revalidate=120`,
    },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function count(filter: (q: any) => any): Promise<number> {
  let q: any = supabase.from("kyc_applications").select("id", { count: "exact", head: true });
  q = filter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

const pctChange = (curr: number, prev: number) => {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(2));
};

async function getMetrics() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfPrevDay = new Date(startOfDay); startOfPrevDay.setDate(startOfPrevDay.getDate() - 1);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);

  const [
    totalUsersRes,
    totalApproved,
    pending,
    rejected,
    todayApproved,
    prevDayApproved,
    weekApproved,
    monthApproved,
    prevMonthApproved,
    yearApproved,
    prevYearApproved,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    count((q) => q.eq("status", "approved")),
    count((q) => q.in("status", ["pending", "under_review"])),
    count((q) => q.eq("status", "rejected")),
    count((q) => q.eq("status", "approved").gte("reviewed_at", startOfDay.toISOString())),
    count((q) => q.eq("status", "approved").gte("reviewed_at", startOfPrevDay.toISOString()).lt("reviewed_at", startOfDay.toISOString())),
    count((q) => q.eq("status", "approved").gte("reviewed_at", startOfWeek.toISOString())),
    count((q) => q.eq("status", "approved").gte("reviewed_at", startOfMonth.toISOString())),
    count((q) => q.eq("status", "approved").gte("reviewed_at", startOfPrevMonth.toISOString()).lt("reviewed_at", startOfMonth.toISOString())),
    count((q) => q.eq("status", "approved").gte("reviewed_at", startOfYear.toISOString())),
    count((q) => q.eq("status", "approved").gte("reviewed_at", startOfPrevYear.toISOString()).lt("reviewed_at", startOfYear.toISOString())),
  ]);

  const totalUsers = totalUsersRes.count || 0;
  const totalApplications = totalApproved + pending + rejected;
  const approvalRate = totalApplications > 0 ? Number(((totalApproved / totalApplications) * 100).toFixed(2)) : 0;
  const verificationRate = totalUsers > 0 ? Number(((totalApproved / totalUsers) * 100).toFixed(2)) : 0;

  return {
    generated_at: now.toISOString(),
    source: "openpay",
    site: SITE_BASE,
    users: {
      total: totalUsers,
      verified: totalApproved,
      verification_rate_pct: verificationRate,
    },
    applications: {
      total: totalApplications,
      approved: totalApproved,
      pending,
      rejected,
      approval_rate_pct: approvalRate,
    },
    periods: {
      today: {
        approved: todayApproved,
        previous: prevDayApproved,
        change_pct: pctChange(todayApproved, prevDayApproved),
      },
      last_7_days: {
        approved: weekApproved,
      },
      month: {
        label: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
        approved: monthApproved,
        previous: prevMonthApproved,
        change_pct: pctChange(monthApproved, prevMonthApproved),
      },
      year: {
        label: String(now.getFullYear()),
        approved: yearApproved,
        previous: prevYearApproved,
        change_pct: pctChange(yearApproved, prevYearApproved),
      },
    },
  };
}

async function getTimeseries(days: number) {
  const clamped = Math.min(Math.max(Math.floor(days || 30), 1), 365);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (clamped - 1));

  const { data, error } = await supabase
    .from("kyc_applications")
    .select("reviewed_at")
    .eq("status", "approved")
    .gte("reviewed_at", start.toISOString());
  if (error) throw error;

  const buckets: Record<string, number> = {};
  for (let i = 0; i < clamped; i++) {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  (data || []).forEach((row: any) => {
    if (!row.reviewed_at) return;
    const key = new Date(row.reviewed_at).toISOString().slice(0, 10);
    if (key in buckets) buckets[key] += 1;
  });
  return {
    generated_at: new Date().toISOString(),
    days: clamped,
    series: Object.entries(buckets).map(([date, approved]) => ({ date, approved })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // Strip the function-name prefix
    const idx = parts.indexOf("kyc-metrics-api");
    const path = (idx >= 0 ? parts.slice(idx + 1) : parts).join("/");

    if (!path || path === "" || path === "metrics") {
      return json(await getMetrics());
    }
    if (path === "timeseries") {
      const days = Number(url.searchParams.get("days") || 30);
      return json(await getTimeseries(days), 200, 60);
    }
    if (path === "health") {
      return json({ ok: true, service: "kyc-metrics-api", time: new Date().toISOString() });
    }
    return json({
      service: "kyc-metrics-api",
      endpoints: [
        { path: "/metrics", description: "Aggregate KYC metrics (users, approvals, period breakdowns)" },
        { path: "/timeseries?days=30", description: "Daily approval counts for the last N days (1-365)" },
        { path: "/health", description: "Health check" },
      ],
    }, 404);
  } catch (err) {
    console.error("kyc-metrics-api error", err);
    return json({ error: (err as Error).message || "internal_error" }, 500, 0);
  }
});
