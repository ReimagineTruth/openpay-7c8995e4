-- Ensure QR Pay ledger_events payload carries external_ref (= transaction_ref)
-- so OpenLedger pull (/ledger-api/public) and /tx/ref/{QRP-…} deep links work.

CREATE OR REPLACE FUNCTION public.qr_pay__ledger_payload(
  p_pay public.qr_payments,
  p_ref text,
  p_method text,
  p_payer_name text,
  p_payer_email text
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'kind', 'qr_pay',
    'qr_payment_id', p_pay.id,
    'token', p_pay.token,
    'transaction_ref', p_ref,
    'external_ref', p_ref,
    'currency', p_pay.currency,
    'currency_code', p_pay.currency,
    'method', p_method,
    'title', COALESCE(NULLIF(p_pay.title, ''), 'QR Payment'),
    'payer_name', p_payer_name,
    'payer_email', p_payer_email
  );
$$;

-- Patch only the ledger_events insert inside notify by redefining a thin helper
-- used if future notify versions call it. Also backfill payload keys on recent rows.
UPDATE public.ledger_events
SET payload = COALESCE(payload, '{}'::jsonb)
  || jsonb_build_object(
    'external_ref', COALESCE(payload->>'transaction_ref', payload->>'external_ref'),
    'currency_code', COALESCE(payload->>'currency_code', payload->>'currency')
  )
WHERE source_table = 'qr_payment_transactions'
  AND (
    payload->>'external_ref' IS NULL
    OR payload->>'currency_code' IS NULL
  )
  AND occurred_at > now() - interval '180 days';
