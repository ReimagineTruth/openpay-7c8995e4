-- QR Pay: full payment-purpose catalog + persistence
-- Expands beyond product/digital/donation/tip with searchable goods & services purposes.

-- ═══════════════════════════════════════════════════════════
-- 1) Purpose catalog
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.qr_pay_purposes (
  id text PRIMARY KEY,
  category_id text NOT NULL,
  category_label text NOT NULL,
  label text NOT NULL,
  hint text NOT NULL DEFAULT '',
  api_type text NOT NULL CHECK (api_type IN ('product', 'digital', 'donation', 'tip')),
  is_flexible boolean NOT NULL DEFAULT false,
  default_title text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_pay_purposes_category
  ON public.qr_pay_purposes (category_id, sort_order);

ALTER TABLE public.qr_pay_purposes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read qr_pay_purposes" ON public.qr_pay_purposes;
CREATE POLICY "Anyone can read qr_pay_purposes"
  ON public.qr_pay_purposes FOR SELECT
  TO anon, authenticated
  USING (active = true);

GRANT SELECT ON public.qr_pay_purposes TO anon, authenticated;
GRANT ALL ON public.qr_pay_purposes TO service_role;

-- Seed / upsert catalog (idempotent)
INSERT INTO public.qr_pay_purposes
  (id, category_id, category_label, label, hint, api_type, is_flexible, default_title, sort_order)
VALUES
  -- Commerce
  ('product', 'commerce', 'Commerce', 'Product', 'Physical goods', 'product', false, 'Product', 10),
  ('service', 'commerce', 'Commerce', 'Service', 'Work or labor', 'product', false, 'Service', 20),
  ('subscription', 'commerce', 'Commerce', 'Subscription', 'Recurring plan', 'product', false, 'Subscription', 30),
  ('membership', 'commerce', 'Commerce', 'Membership', 'Club or access', 'product', false, 'Membership', 40),
  ('invoice', 'commerce', 'Commerce', 'Invoice', 'Bill for work done', 'product', false, 'Invoice', 50),
  ('quote', 'commerce', 'Commerce', 'Quote / Estimate', 'Proposed price', 'product', false, 'Quote', 60),
  ('preorder', 'commerce', 'Commerce', 'Pre-order', 'Pay before release', 'product', false, 'Pre-order', 70),
  -- Digital
  ('digital_product', 'digital', 'Digital', 'Digital Product', 'Files & apps', 'digital', false, 'Digital product', 110),
  ('software_license', 'digital', 'Digital', 'Software License', 'Keys & seats', 'digital', false, 'Software license', 120),
  ('ebook', 'digital', 'Digital', 'eBook', 'Digital book', 'digital', false, 'eBook', 130),
  ('online_course', 'digital', 'Digital', 'Online Course', 'Lessons & training', 'digital', false, 'Online course', 140),
  ('music', 'digital', 'Digital', 'Music', 'Audio & tracks', 'digital', false, 'Music', 150),
  ('video', 'digital', 'Digital', 'Video', 'Films & clips', 'digital', false, 'Video', 160),
  ('download', 'digital', 'Digital', 'Download', 'File delivery', 'digital', false, 'Download', 170),
  ('api_access', 'digital', 'Digital', 'API Access', 'Developer access', 'digital', false, 'API access', 180),
  -- Donations (flexible)
  ('donation', 'donations', 'Donations', 'Donation', 'Any amount', 'donation', true, 'Support our project', 210),
  ('tip', 'donations', 'Donations', 'Tip', 'Say thanks', 'tip', true, 'Leave a tip', 220),
  ('crowdfunding', 'donations', 'Donations', 'Crowdfunding', 'Campaign goal', 'donation', true, 'Crowdfunding', 230),
  ('charity', 'donations', 'Donations', 'Charity', 'Nonprofit cause', 'donation', true, 'Charity donation', 240),
  ('fundraising', 'donations', 'Donations', 'Fundraising', 'Raise funds', 'donation', true, 'Fundraising', 250),
  -- Booking
  ('appointment', 'booking', 'Booking', 'Appointment', 'Scheduled visit', 'product', false, 'Appointment', 310),
  ('event_ticket', 'booking', 'Booking', 'Event Ticket', 'Entry pass', 'product', false, 'Event ticket', 320),
  ('reservation', 'booking', 'Booking', 'Reservation', 'Hold a spot', 'product', false, 'Reservation', 330),
  ('consultation', 'booking', 'Booking', 'Consultation', 'Advice session', 'product', false, 'Consultation', 340),
  ('hotel_booking', 'booking', 'Booking', 'Hotel Booking', 'Stay payment', 'product', false, 'Hotel booking', 350),
  ('travel_booking', 'booking', 'Booking', 'Travel Booking', 'Trip payment', 'product', false, 'Travel booking', 360),
  -- Bills
  ('electricity_bill', 'bills', 'Bills', 'Electricity Bill', 'Power utility', 'product', false, 'Electricity bill', 410),
  ('water_bill', 'bills', 'Bills', 'Water Bill', 'Water utility', 'product', false, 'Water bill', 420),
  ('internet_bill', 'bills', 'Bills', 'Internet Bill', 'ISP payment', 'product', false, 'Internet bill', 430),
  ('mobile_bill', 'bills', 'Bills', 'Mobile Bill', 'Phone plan', 'product', false, 'Mobile bill', 440),
  ('cable_tv_bill', 'bills', 'Bills', 'Cable TV Bill', 'TV service', 'product', false, 'Cable TV bill', 450),
  ('gas_bill', 'bills', 'Bills', 'Gas Bill', 'Gas utility', 'product', false, 'Gas bill', 460),
  ('insurance_bill', 'bills', 'Bills', 'Insurance Bill', 'Policy payment', 'product', false, 'Insurance', 470),
  ('credit_card_bill', 'bills', 'Bills', 'Credit Card Bill', 'Card payoff', 'product', false, 'Credit card bill', 480),
  ('mortgage', 'bills', 'Bills', 'Mortgage Payment', 'Home loan', 'product', false, 'Mortgage payment', 490),
  ('property_tax', 'bills', 'Bills', 'Property Tax', 'Local tax', 'product', false, 'Property tax', 500),
  ('government_fees', 'bills', 'Bills', 'Government Fees', 'Official fees', 'product', false, 'Government fees', 510),
  ('tuition', 'bills', 'Bills', 'Tuition Fees', 'School payment', 'product', false, 'Tuition', 520),
  -- Finance
  ('payment_request', 'finance', 'Finance', 'Payment Request', 'Ask to be paid', 'product', false, 'Payment request', 610),
  ('installment', 'finance', 'Finance', 'Installment Payment', 'Part of a plan', 'product', false, 'Installment', 620),
  ('deposit', 'finance', 'Finance', 'Deposit', 'Down payment', 'product', false, 'Deposit', 630),
  ('balance_payment', 'finance', 'Finance', 'Balance Payment', 'Remaining due', 'product', false, 'Balance payment', 640),
  ('loan_repayment', 'finance', 'Finance', 'Loan Repayment', 'Pay back a loan', 'product', false, 'Loan repayment', 650),
  -- Business
  ('business_payment', 'business', 'Business', 'Business Payment', 'B2B transfer', 'product', false, 'Business payment', 710),
  ('freelancer', 'business', 'Business', 'Freelancer Payment', 'Independent work', 'product', false, 'Freelancer payment', 720),
  ('contractor', 'business', 'Business', 'Contractor Payment', 'Contract work', 'product', false, 'Contractor payment', 730),
  ('vendor', 'business', 'Business', 'Vendor Payment', 'Supplier invoice', 'product', false, 'Vendor payment', 740),
  ('payroll', 'business', 'Business', 'Payroll', 'Staff wages', 'product', false, 'Payroll', 750),
  -- Personal
  ('gift', 'personal', 'Personal', 'Gift', 'Send money as a gift', 'donation', true, 'Gift', 810),
  ('split_bill', 'personal', 'Personal', 'Split Bill', 'Share a cost', 'tip', true, 'Split bill', 820),
  ('rent', 'personal', 'Personal', 'Rent', 'Housing payment', 'product', false, 'Rent', 830),
  ('utilities', 'personal', 'Personal', 'Utilities', 'Home utilities', 'product', false, 'Utilities', 840),
  ('school_fees', 'personal', 'Personal', 'School Fees', 'Education', 'product', false, 'School fees', 850),
  ('medical', 'personal', 'Personal', 'Medical Payment', 'Health costs', 'product', false, 'Medical payment', 860),
  -- Crypto
  ('crypto_payment', 'crypto', 'Crypto', 'Crypto Payment', 'Pay with crypto', 'product', false, 'Crypto payment', 910),
  ('token_purchase', 'crypto', 'Crypto', 'Token Purchase', 'Buy tokens', 'product', false, 'Token purchase', 920),
  ('nft_purchase', 'crypto', 'Crypto', 'NFT Purchase', 'Collectible buy', 'digital', false, 'NFT purchase', 930),
  ('p2p_trade', 'crypto', 'Crypto', 'P2P Trade', 'Peer exchange', 'product', false, 'P2P trade', 940),
  ('token_swap', 'crypto', 'Crypto', 'Token Swap', 'Exchange tokens', 'product', false, 'Token swap', 950),
  ('staking', 'crypto', 'Crypto', 'Staking', 'Stake deposit', 'product', false, 'Staking', 960),
  ('trading_deposit', 'crypto', 'Crypto', 'Trading Deposit', 'Fund trading', 'product', false, 'Trading deposit', 970),
  -- Legacy aliases so old payment_type values resolve as purposes
  ('digital', 'digital', 'Digital', 'Digital', 'Files & downloads', 'digital', false, 'Digital product', 100)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  category_label = EXCLUDED.category_label,
  label = EXCLUDED.label,
  hint = EXCLUDED.hint,
  api_type = EXCLUDED.api_type,
  is_flexible = EXCLUDED.is_flexible,
  default_title = EXCLUDED.default_title,
  sort_order = EXCLUDED.sort_order,
  active = true;

-- ═══════════════════════════════════════════════════════════
-- 2) Column on qr_payments
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.qr_payments
  ADD COLUMN IF NOT EXISTS payment_purpose text;

-- Backfill purpose from legacy payment_type
UPDATE public.qr_payments
SET payment_purpose = payment_type
WHERE payment_purpose IS NULL AND payment_type IS NOT NULL;

-- Ensure payment_type stays the 4 checkout modes
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'qr_payments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%payment_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.qr_payments DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.qr_payments
  DROP CONSTRAINT IF EXISTS qr_payments_payment_type_check;

ALTER TABLE public.qr_payments
  ADD CONSTRAINT qr_payments_payment_type_check
  CHECK (payment_type IN ('product', 'digital', 'donation', 'tip'));

-- Soft FK: only set when purpose exists (avoid breaking legacy junk)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qr_payments_payment_purpose_fkey'
  ) THEN
    -- Null out orphan purposes before adding FK
    UPDATE public.qr_payments p
    SET payment_purpose = COALESCE(
      (SELECT id FROM public.qr_pay_purposes x WHERE x.id = p.payment_purpose),
      p.payment_type,
      'product'
    )
    WHERE payment_purpose IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.qr_pay_purposes x WHERE x.id = p.payment_purpose);

    ALTER TABLE public.qr_payments
      ADD CONSTRAINT qr_payments_payment_purpose_fkey
      FOREIGN KEY (payment_purpose) REFERENCES public.qr_pay_purposes(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qr_payments_payment_purpose
  ON public.qr_payments (payment_purpose);

-- ═══════════════════════════════════════════════════════════
-- 3) Helpers
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.qr_pay_resolve_api_type(
  p_purpose text,
  p_payment_type text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_api text;
BEGIN
  IF p_purpose IS NOT NULL THEN
    SELECT api_type INTO v_api FROM public.qr_pay_purposes WHERE id = p_purpose AND active;
    IF v_api IS NOT NULL THEN RETURN v_api; END IF;
  END IF;
  IF p_payment_type IN ('product', 'digital', 'donation', 'tip') THEN
    RETURN p_payment_type;
  END IF;
  RETURN 'product';
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_pay_is_flexible_payment(p_pay public.qr_payments)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_flex boolean;
BEGIN
  IF COALESCE(p_pay.allow_custom_amount, false) THEN
    RETURN true;
  END IF;
  IF p_pay.payment_type IN ('donation', 'tip') THEN
    RETURN true;
  END IF;
  IF p_pay.payment_purpose IS NOT NULL THEN
    SELECT is_flexible INTO v_flex
    FROM public.qr_pay_purposes
    WHERE id = p_pay.payment_purpose;
    IF COALESCE(v_flex, false) THEN
      RETURN true;
    END IF;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_pay_calc_charge_amount(
  p_payment public.qr_payments,
  p_amount numeric
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_amount numeric(14,2);
BEGIN
  IF public.qr_pay_is_flexible_payment(p_payment) THEN
    v_amount := round(COALESCE(p_amount, p_payment.suggested_amount, p_payment.total, 0)::numeric, 2);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'amount_required';
    END IF;
    IF p_payment.min_amount IS NOT NULL AND v_amount < p_payment.min_amount THEN
      RAISE EXCEPTION 'amount_below_minimum';
    END IF;
    RETURN v_amount;
  END IF;

  v_amount := round(COALESCE(p_payment.total, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_payment_total';
  END IF;
  RETURN v_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_resolve_api_type(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qr_pay_is_flexible_payment(public.qr_payments) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qr_pay_calc_charge_amount(public.qr_payments, numeric) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════
-- 4) qr_pay_create — accepts purpose, derives api type
-- ═══════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.qr_pay_create(
  text, text, text, jsonb, boolean, boolean, boolean, boolean, boolean, integer,
  text, text, text, text, numeric, numeric, boolean, text, boolean, jsonb
);
DROP FUNCTION IF EXISTS public.qr_pay_create(
  text, text, text, jsonb, boolean, boolean, boolean, boolean, boolean, integer,
  text, text, text, text, numeric, numeric, boolean, text
);

CREATE OR REPLACE FUNCTION public.qr_pay_create(
  p_title text,
  p_description text,
  p_currency text,
  p_items jsonb,
  p_allow_pi boolean,
  p_allow_wallet boolean,
  p_allow_virtual_card boolean,
  p_allow_guest boolean,
  p_reusable boolean,
  p_expires_minutes integer,
  p_payment_type text DEFAULT 'product',
  p_after_payment_action text DEFAULT 'receipt',
  p_download_url text DEFAULT NULL,
  p_redirect_url text DEFAULT NULL,
  p_suggested_amount numeric DEFAULT NULL,
  p_min_amount numeric DEFAULT NULL,
  p_allow_custom_amount boolean DEFAULT false,
  p_cover_image_url text DEFAULT NULL,
  p_collect_delivery boolean DEFAULT false,
  p_delivery_fields jsonb DEFAULT '["name","email","address"]'::jsonb,
  p_payment_purpose text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_token text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_item jsonb;
  v_pos int := 0;
  v_expires timestamptz;
  v_purpose text;
  v_api_type text;
  v_flexible boolean := false;
  v_default_title text;
  v_title text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  -- Allow 2-char codes like PI (ISO-4217 is usually 3, but OpenPay uses PI)
  IF p_currency IS NULL OR length(btrim(p_currency)) < 2 THEN RAISE EXCEPTION 'currency_required'; END IF;

  -- Resolve purpose (prefer explicit purpose, else treat payment_type as purpose id)
  v_purpose := NULLIF(btrim(COALESCE(p_payment_purpose, '')), '');
  IF v_purpose IS NULL THEN
    v_purpose := NULLIF(btrim(COALESCE(p_payment_type, '')), '');
  END IF;
  IF v_purpose IS NULL THEN
    v_purpose := 'product';
  END IF;

  SELECT api_type, is_flexible, COALESCE(default_title, label)
    INTO v_api_type, v_flexible, v_default_title
  FROM public.qr_pay_purposes
  WHERE id = v_purpose AND active;

  IF NOT FOUND THEN
    -- Fall back: payment_type may already be one of the 4 api types
    IF p_payment_type IN ('product', 'digital', 'donation', 'tip') THEN
      v_api_type := p_payment_type;
      v_purpose := p_payment_type;
      v_flexible := (p_payment_type IN ('donation', 'tip')) OR COALESCE(p_allow_custom_amount, false);
      v_default_title := 'QR Payment';
    ELSE
      RAISE EXCEPTION 'invalid_payment_purpose';
    END IF;
  ELSE
    v_flexible := COALESCE(v_flexible, false) OR COALESCE(p_allow_custom_amount, false);
  END IF;

  IF v_api_type NOT IN ('product', 'digital', 'donation', 'tip') THEN
    RAISE EXCEPTION 'invalid_payment_type';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF v_title IS NULL THEN
    v_title := COALESCE(v_default_title, 'QR Payment');
  END IF;

  IF v_flexible THEN
    v_total := COALESCE(p_suggested_amount, 0);
    v_subtotal := v_total;
  ELSE
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'items_required';
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_subtotal := v_subtotal + (COALESCE((v_item->>'quantity')::int, 1) * COALESCE((v_item->>'unit_price')::numeric, 0));
    END LOOP;
    v_total := v_subtotal;
    IF v_total <= 0 THEN RAISE EXCEPTION 'total_zero'; END IF;
  END IF;

  IF p_expires_minutes IS NOT NULL AND p_expires_minutes > 0 THEN
    v_expires := now() + (p_expires_minutes || ' minutes')::interval;
  END IF;

  v_token := public.qr_pay_gen_token();
  v_id := gen_random_uuid();

  INSERT INTO public.qr_payments(
    id, merchant_user_id, token, title, description, currency, subtotal, total, status,
    allow_pi, allow_wallet, allow_virtual_card, allow_guest, reusable, expires_at,
    payment_type, payment_purpose, after_payment_action, download_url, redirect_url,
    suggested_amount, min_amount, allow_custom_amount, cover_image_url,
    collect_delivery, delivery_fields
  ) VALUES (
    v_id, v_user, v_token, v_title, p_description, upper(p_currency),
    v_subtotal, v_total, 'active',
    COALESCE(p_allow_pi, true), COALESCE(p_allow_wallet, true), COALESCE(p_allow_virtual_card, true),
    COALESCE(p_allow_guest, true),
    CASE WHEN v_flexible THEN true ELSE COALESCE(p_reusable, false) END,
    v_expires,
    v_api_type, v_purpose, COALESCE(p_after_payment_action, 'receipt'),
    p_download_url, p_redirect_url,
    p_suggested_amount, p_min_amount, v_flexible, p_cover_image_url,
    COALESCE(p_collect_delivery, false),
    COALESCE(p_delivery_fields, '["name","email","address"]'::jsonb)
  );

  IF NOT v_flexible THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      INSERT INTO public.qr_payment_items(
        qr_payment_id, name, description, image_url, quantity, unit_price, line_total, position
      ) VALUES (
        v_id,
        COALESCE(v_item->>'name', 'Item'),
        v_item->>'description',
        v_item->>'image_url',
        COALESCE((v_item->>'quantity')::int, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0),
        COALESCE((v_item->>'quantity')::int, 1) * COALESCE((v_item->>'unit_price')::numeric, 0),
        v_pos
      );
      v_pos := v_pos + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'total', v_total,
    'payment_type', v_api_type,
    'payment_purpose', v_purpose,
    'allow_custom_amount', v_flexible
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_create(
  text, text, text, jsonb, boolean, boolean, boolean, boolean, boolean, integer,
  text, text, text, text, numeric, numeric, boolean, text, boolean, jsonb, text
) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 5) qr_pay_get_by_token — return purpose metadata
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.qr_pay_get_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay public.qr_payments;
  v_items jsonb;
  v_merchant jsonb;
  v_purpose public.qr_pay_purposes%ROWTYPE;
  v_flexible boolean;
BEGIN
  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.expires_at IS NOT NULL AND v_pay.expires_at < now() AND v_pay.status = 'active' THEN
    UPDATE public.qr_payments SET status = 'expired' WHERE id = v_pay.id;
    SELECT * INTO v_pay FROM public.qr_payments WHERE id = v_pay.id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'description', description, 'image_url', image_url,
    'quantity', quantity, 'unit_price', unit_price, 'line_total', line_total
  ) ORDER BY position)
  INTO v_items FROM public.qr_payment_items WHERE qr_payment_id = v_pay.id;

  SELECT jsonb_build_object('id', id, 'full_name', full_name, 'username', username, 'avatar_url', avatar_url)
  INTO v_merchant FROM public.profiles WHERE id = v_pay.merchant_user_id;

  SELECT * INTO v_purpose FROM public.qr_pay_purposes WHERE id = COALESCE(v_pay.payment_purpose, v_pay.payment_type);
  v_flexible := public.qr_pay_is_flexible_payment(v_pay);

  RETURN jsonb_build_object(
    'id', v_pay.id, 'token', v_pay.token, 'title', v_pay.title, 'description', v_pay.description,
    'currency', v_pay.currency, 'subtotal', v_pay.subtotal, 'total', v_pay.total, 'status', v_pay.status,
    'allow_pi', v_pay.allow_pi, 'allow_wallet', v_pay.allow_wallet,
    'allow_virtual_card', v_pay.allow_virtual_card, 'allow_guest', v_pay.allow_guest,
    'reusable', v_pay.reusable, 'expires_at', v_pay.expires_at,
    'payment_type', v_pay.payment_type,
    'payment_purpose', COALESCE(v_pay.payment_purpose, v_pay.payment_type),
    'payment_purpose_label', v_purpose.label,
    'payment_category', v_purpose.category_label,
    'payment_category_id', v_purpose.category_id,
    'is_flexible', v_flexible,
    'after_payment_action', v_pay.after_payment_action,
    'download_url', v_pay.download_url, 'redirect_url', v_pay.redirect_url,
    'suggested_amount', v_pay.suggested_amount, 'min_amount', v_pay.min_amount,
    'allow_custom_amount', v_pay.allow_custom_amount, 'cover_image_url', v_pay.cover_image_url,
    'collect_delivery', v_pay.collect_delivery, 'delivery_fields', v_pay.delivery_fields,
    'pro_settlement_to', v_pay.pro_settlement_to,
    'merchant', v_merchant, 'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_get_by_token(text) TO anon, authenticated;

-- List purposes for clients that want DB-driven catalogs
CREATE OR REPLACE FUNCTION public.qr_pay_list_purposes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'category_id', category_id,
      'category_label', category_label,
      'label', label,
      'hint', hint,
      'api_type', api_type,
      'is_flexible', is_flexible,
      'default_title', default_title,
      'sort_order', sort_order
    )
    ORDER BY sort_order, label
  ), '[]'::jsonb)
  FROM public.qr_pay_purposes
  WHERE active = true;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_list_purposes() TO anon, authenticated, service_role;
