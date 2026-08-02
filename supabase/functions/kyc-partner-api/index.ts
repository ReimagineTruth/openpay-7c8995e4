// OpenPay Partner KYC API
// Lets connected platforms (e.g. OpenPay Pro) submit KYC applications into
// OpenPay, poll their status, and receive decision webhooks.
// Auth: `Authorization: Bearer opk_live_...` (partner API key from /partner-api).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const BUCKET = "kyc-documents";
const VERSION = "1.0.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const err = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ error: message, ...extra }), { status, headers: jsonHeaders });

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PUBLIC_FIELDS =
  "id, status, source, external_user_id, external_ref, user_id, full_name, date_of_birth, nationality, residential_address, phone_number, email, occupation, employer_name, source_of_funds, annual_income_range, political_exposure, id_document_type, id_document_number, id_document_issue_date, id_document_expiry_date, id_document_front_url, id_document_back_url, selfie_url, proof_of_address_url, rejection_reason, admin_notes, partner_metadata, callback_url, submitted_at, reviewed_at, updated_at";

function shape(row: any) {
  if (!row) return null;
  return {
    application_id: row.id,
    status: row.status,
    source: row.source,
    external_user_id: row.external_user_id,
    external_ref: row.external_ref,
    openpay_user_id: row.user_id,
    applicant: {
      full_name: row.full_name,
      date_of_birth: row.date_of_birth,
      nationality: row.nationality,
      residential_address: row.residential_address,
      phone_number: row.phone_number,
      email: row.email,
      occupation: row.occupation,
      employer_name: row.employer_name,
    },
    financial: {
      source_of_funds: row.source_of_funds,
      annual_income_range: row.annual_income_range,
      political_exposure: row.political_exposure,
    },
    document: {
      type: row.id_document_type,
      number: row.id_document_number,
      issue_date: row.id_document_issue_date,
      expiry_date: row.id_document_expiry_date,
      has_front: Boolean(row.id_document_front_url),
      has_back: Boolean(row.id_document_back_url),
      has_selfie: Boolean(row.selfie_url),
      has_proof_of_address: Boolean(row.proof_of_address_url),
    },
    review: {
      rejection_reason: row.rejection_reason,
      admin_notes: row.admin_notes,
      reviewed_at: row.reviewed_at,
    },
    metadata: row.partner_metadata || {},
    callback_url: row.callback_url,
    submitted_at: row.submitted_at,
    updated_at: row.updated_at,
  };
}

/** Store a base64 or remote document into the private kyc-documents bucket. */
async function storeDocument(
  appId: string,
  slot: string,
  doc: any,
): Promise<string | null> {
  if (!doc) return null;
  if (typeof doc === "string") return doc; // already a URL
  if (doc.url) return String(doc.url);
  if (!doc.data_base64) return null;

  const contentType = String(doc.content_type || "image/jpeg");
  const ext = contentType.includes("png") ? "png" : contentType.includes("pdf") ? "pdf" : "jpg";
  const raw = String(doc.data_base64).replace(/^data:[^;]+;base64,/, "");
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const path = `partner/${appId}/${slot}-${Date.now()}.${ext}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Failed to store ${slot}: ${error.message}`);
  return path;
}

async function deliverWebhook(appRow: any, apiKeyHash: string, eventType: string) {
  const url = appRow?.callback_url;
  if (!url) return { delivered: false, skipped: "no_callback_url" };

  const payload = {
    id: crypto.randomUUID(),
    type: eventType,
    created_at: new Date().toISOString(),
    data: shape(appRow),
  };
  const body = JSON.stringify(payload);
  const signature = await hmacHex(apiKeyHash, body);

  let status = 0;
  let text = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenPay-Event": eventType,
        "X-OpenPay-Signature": `sha256=${signature}`,
      },
      body,
    });
    status = res.status;
    text = (await res.text()).slice(0, 500);
  } catch (e) {
    text = String((e as Error).message).slice(0, 500);
  }

  await admin.from("kyc_partner_events").insert({
    application_id: appRow.id,
    partner_app_id: appRow.partner_app_id,
    event_type: eventType,
    payload,
    delivered: status >= 200 && status < 300,
    response_status: status || null,
    response_body: text || null,
  });
  await admin.from("kyc_applications").update({
    webhook_last_status: status || null,
    webhook_last_at: new Date().toISOString(),
  }).eq("id", appRow.id);

  return { delivered: status >= 200 && status < 300, response_status: status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*kyc-partner-api/, "") || "/";

  if (req.method === "GET" && (path === "/" || path === "/health")) {
    return ok({
      service: "OpenPay Partner KYC API",
      version: VERSION,
      auth: "Authorization: Bearer opk_live_… (partner API key from /partner-api)",
      endpoints: [
        "GET  /health",
        "POST /applications                       — submit a KYC application",
        "GET  /applications?limit=&status=&external_user_id=",
        "GET  /applications/:application_id",
        "GET  /users/:external_user_id            — latest status for one of your users",
        "POST /applications/:id/resubmit          — replace a rejected / more-info application",
        "GET  /events/:application_id             — webhook delivery log",
        "POST /internal/notify                    — (OpenPay admin only) resend decision webhook",
      ],
      webhook: {
        header: "X-OpenPay-Signature: sha256=<hmac>",
        secret: "sha256_hex(your_api_key)",
        events: ["kyc.approved", "kyc.rejected", "kyc.additional_info_required", "kyc.under_review"],
      },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  // ---- OpenPay admin: resend / fire a decision webhook ----
  if (req.method === "POST" && path === "/internal/notify") {
    if (!token) return err("Unauthorized", 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return err("Unauthorized", 401);
    const { data: isAdmin } = await userClient.rpc("is_openpay_core_admin");
    if (!isAdmin) return err("Admin only", 403);

    const body = await req.json().catch(() => ({}));
    const appId = String(body?.application_id || "");
    if (!appId) return err("application_id is required", 400);

    const { data: appRow } = await admin
      .from("kyc_applications")
      .select(`${PUBLIC_FIELDS}, partner_app_id, webhook_last_status`)
      .eq("id", appId)
      .maybeSingle();
    if (!appRow) return err("Application not found", 404);
    if (!appRow.partner_app_id) return ok({ skipped: "not_a_partner_application" });

    const { data: partner } = await admin
      .from("partner_apps").select("key_hash").eq("id", appRow.partner_app_id).maybeSingle();
    if (!partner?.key_hash) return err("Partner app not found", 404);

    const result = await deliverWebhook(appRow, partner.key_hash, `kyc.${appRow.status}`);
    return ok({ ok: true, ...result });
  }

  // ---- Partner API key auth ----
  if (!token.startsWith("opk_")) {
    return err("Missing or invalid API key. Use `Authorization: Bearer opk_live_...`", 401);
  }
  const keyHash = await sha256Hex(token);
  const { data: appRow } = await admin
    .from("partner_apps")
    .select("id, name, owner_user_id, is_active, key_hash")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!appRow || !appRow.is_active) return err("API key not recognized or revoked", 401);
  await admin.from("partner_apps").update({ last_used_at: new Date().toISOString() }).eq("id", appRow.id);

  try {
    // ---- Submit / resubmit ----
    const resubmitMatch = path.match(/^\/applications\/([^/]+)\/resubmit$/);
    if (req.method === "POST" && (path === "/applications" || resubmitMatch)) {
      const body = await req.json().catch(() => ({}));
      const required = [
        "external_user_id", "full_name", "date_of_birth", "nationality",
        "residential_address", "phone_number", "email", "occupation",
        "source_of_funds", "annual_income_range",
        "id_document_type", "id_document_number",
        "id_document_issue_date", "id_document_expiry_date",
      ];
      const missing = required.filter((f) => !String(body?.[f] ?? "").trim());
      if (missing.length) return err("Missing required fields", 422, { missing });

      const externalRef = String(body.external_ref || body.external_user_id);

      // Idempotency on (partner_app_id, external_ref)
      if (!resubmitMatch) {
        const { data: existing } = await admin
          .from("kyc_applications")
          .select(PUBLIC_FIELDS)
          .eq("partner_app_id", appRow.id)
          .eq("external_ref", externalRef)
          .maybeSingle();
        if (existing) {
          return ok({ ...shape(existing), idempotent: true }, 200);
        }
      }

      const docs = body.documents || {};
      const [front, back, selfie, poa] = await Promise.all([
        storeDocument(appRow.id, "id-front", docs.id_front),
        storeDocument(appRow.id, "id-back", docs.id_back),
        storeDocument(appRow.id, "selfie", docs.selfie),
        storeDocument(appRow.id, "proof-of-address", docs.proof_of_address),
      ]);

      const record: Record<string, unknown> = {
        user_id: body.openpay_user_id || null,
        source: "partner",
        partner_app_id: appRow.id,
        external_user_id: String(body.external_user_id),
        external_ref: externalRef,
        partner_metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
        callback_url: body.callback_url ? String(body.callback_url) : null,
        full_name: String(body.full_name),
        date_of_birth: String(body.date_of_birth),
        nationality: String(body.nationality),
        residential_address: String(body.residential_address),
        phone_number: String(body.phone_number),
        email: String(body.email),
        occupation: String(body.occupation),
        employer_name: body.employer_name ? String(body.employer_name) : null,
        source_of_funds: String(body.source_of_funds),
        annual_income_range: String(body.annual_income_range),
        political_exposure: Boolean(body.political_exposure),
        id_document_type: String(body.id_document_type),
        id_document_number: String(body.id_document_number),
        id_document_issue_date: String(body.id_document_issue_date),
        id_document_expiry_date: String(body.id_document_expiry_date),
        id_document_front_url: front,
        id_document_back_url: back,
        selfie_url: selfie,
        proof_of_address_url: poa,
        liveness_passed: Boolean(body.liveness_passed),
        liveness_score: body.liveness_score != null ? Number(body.liveness_score) : null,
        status: "pending",
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        submitted_at: new Date().toISOString(),
      };

      if (resubmitMatch) {
        const { data: updated, error: upErr } = await admin
          .from("kyc_applications")
          .update(record)
          .eq("id", resubmitMatch[1])
          .eq("partner_app_id", appRow.id)
          .select(PUBLIC_FIELDS)
          .maybeSingle();
        if (upErr) return err(upErr.message, 400);
        if (!updated) return err("Application not found", 404);
        return ok(shape(updated), 200);
      }

      const { data: inserted, error: insErr } = await admin
        .from("kyc_applications")
        .insert(record)
        .select(PUBLIC_FIELDS)
        .maybeSingle();
      if (insErr) return err(insErr.message, 400);
      return ok(shape(inserted), 201);
    }

    // ---- List ----
    if (req.method === "GET" && path === "/applications") {
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25), 1), 100);
      const status = url.searchParams.get("status");
      const externalUserId = url.searchParams.get("external_user_id");
      let q = admin.from("kyc_applications").select(PUBLIC_FIELDS)
        .eq("partner_app_id", appRow.id)
        .order("submitted_at", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status);
      if (externalUserId) q = q.eq("external_user_id", externalUserId);
      const { data, error } = await q;
      if (error) return err(error.message, 400);
      return ok({ count: (data || []).length, applications: (data || []).map(shape) });
    }

    // ---- Single application ----
    const oneMatch = path.match(/^\/applications\/([^/]+)$/);
    if (req.method === "GET" && oneMatch) {
      const { data } = await admin.from("kyc_applications").select(PUBLIC_FIELDS)
        .eq("id", oneMatch[1]).eq("partner_app_id", appRow.id).maybeSingle();
      if (!data) return err("Application not found", 404);
      return ok(shape(data));
    }

    // ---- Latest status for one external user ----
    const userMatch = path.match(/^\/users\/([^/]+)$/);
    if (req.method === "GET" && userMatch) {
      const { data } = await admin.from("kyc_applications").select(PUBLIC_FIELDS)
        .eq("partner_app_id", appRow.id)
        .eq("external_user_id", decodeURIComponent(userMatch[1]))
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) {
        return ok({
          external_user_id: decodeURIComponent(userMatch[1]),
          status: "not_submitted",
          verified: false,
        });
      }
      return ok({ ...shape(data), verified: data.status === "approved" });
    }

    // ---- Webhook delivery log ----
    const eventsMatch = path.match(/^\/events\/([^/]+)$/);
    if (req.method === "GET" && eventsMatch) {
      const { data: owned } = await admin.from("kyc_applications").select("id")
        .eq("id", eventsMatch[1]).eq("partner_app_id", appRow.id).maybeSingle();
      if (!owned) return err("Application not found", 404);
      const { data } = await admin.from("kyc_partner_events")
        .select("id, event_type, delivered, response_status, created_at")
        .eq("application_id", eventsMatch[1])
        .order("created_at", { ascending: false })
        .limit(50);
      return ok({ events: data || [] });
    }

    return err("Not found", 404);
  } catch (e) {
    console.error("kyc-partner-api error", e);
    return err(String((e as Error)?.message || e), 500);
  }
});
