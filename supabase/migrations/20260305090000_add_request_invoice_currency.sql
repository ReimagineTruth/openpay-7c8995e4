-- Store original currency details for payment requests and invoices
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_currency_code TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_currency_code TEXT;
