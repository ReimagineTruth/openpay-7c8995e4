CREATE TABLE IF NOT EXISTS public.feature_maintenance (
  feature_key text PRIMARY KEY,
  label text NOT NULL,
  feature_group text NOT NULL DEFAULT 'General',
  maintenance boolean NOT NULL DEFAULT false,
  message text NOT NULL DEFAULT 'This feature is temporarily under maintenance. Please try again later.',
  sort_order int NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.feature_maintenance TO anon;
GRANT SELECT ON public.feature_maintenance TO authenticated;
GRANT ALL ON public.feature_maintenance TO service_role;

ALTER TABLE public.feature_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feature maintenance" ON public.feature_maintenance;
CREATE POLICY "Anyone can read feature maintenance"
ON public.feature_maintenance FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Core admins manage feature maintenance" ON public.feature_maintenance;
CREATE POLICY "Core admins manage feature maintenance"
ON public.feature_maintenance FOR ALL
TO authenticated
USING (public.is_openpay_core_admin())
WITH CHECK (public.is_openpay_core_admin());

CREATE OR REPLACE FUNCTION public.feature_maintenance_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feature_maintenance_touch ON public.feature_maintenance;
CREATE TRIGGER trg_feature_maintenance_touch
BEFORE UPDATE ON public.feature_maintenance
FOR EACH ROW EXECUTE FUNCTION public.feature_maintenance_touch();

INSERT INTO public.feature_maintenance (feature_key, label, feature_group, sort_order) VALUES
  ('send', 'Send Money', 'Payments', 10),
  ('request', 'Request Money', 'Payments', 20),
  ('receive', 'Receive / My QR', 'Payments', 30),
  ('scan', 'Scan to Pay', 'Payments', 40),
  ('contacts', 'Contacts', 'Payments', 50),
  ('invoices', 'Invoices', 'Payments', 60),
  ('topup', 'Top Up / Buy OUSD', 'Wallet', 110),
  ('swap_withdraw', 'Withdraw / Swap', 'Wallet', 120),
  ('savings', 'Savings', 'Wallet', 130),
  ('staking', 'Staking', 'Wallet', 140),
  ('virtual_cards', 'Virtual Cards', 'Wallet', 150),
  ('transactions', 'Transaction History', 'Wallet', 160),
  ('qr_pay', 'QR Pay', 'Merchant', 210),
  ('merchant_pos', 'Merchant POS', 'Merchant', 220),
  ('merchant_links', 'Merchant Payment Links', 'Merchant', 230),
  ('merchant_products', 'Merchant Products', 'Merchant', 240),
  ('remittance', 'Remittance Center', 'Merchant', 250),
  ('partner_api', 'Partner / Developer API', 'Merchant', 260),
  ('nft_marketplace', 'OpenNFT Marketplace', 'Web3', 310),
  ('nft_mint', 'NFT Minting', 'Web3', 320),
  ('nft_auction', 'NFT Auctions', 'Web3', 330),
  ('nft_store', 'NFT Stores', 'Web3', 340),
  ('mining', 'Mining', 'Rewards', 410),
  ('affiliate', 'Affiliate Program', 'Rewards', 420),
  ('referrals', 'Referrals', 'Rewards', 430),
  ('loans', 'Loans', 'Finance', 510),
  ('kyc', 'KYC Verification', 'Finance', 520),
  ('disputes', 'Dispute Resolution', 'Finance', 530),
  ('openpay_ai', 'OpenPay AI', 'Platform', 610),
  ('public_ledger', 'OpenLedger', 'Platform', 620),
  ('support', 'Support Center', 'Platform', 630),
  ('notifications', 'Notifications', 'Platform', 640),
  ('feedback', 'Feedback', 'Platform', 650)
ON CONFLICT (feature_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_feature_maintenance()
RETURNS SETOF public.feature_maintenance
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.feature_maintenance ORDER BY sort_order, label;
$$;

GRANT EXECUTE ON FUNCTION public.get_feature_maintenance() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_feature_maintenance(
  p_feature_key text,
  p_maintenance boolean,
  p_message text DEFAULT NULL
)
RETURNS public.feature_maintenance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.feature_maintenance;
BEGIN
  IF NOT public.is_openpay_core_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.feature_maintenance
     SET maintenance = p_maintenance,
         message = COALESCE(NULLIF(p_message, ''), message),
         updated_by = auth.uid()
   WHERE feature_key = p_feature_key
  RETURNING * INTO v_row;

  IF v_row.feature_key IS NULL THEN
    RAISE EXCEPTION 'Unknown feature %', p_feature_key;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_feature_maintenance(text, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_all_feature_maintenance(p_maintenance boolean)
RETURNS SETOF public.feature_maintenance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_openpay_core_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  UPDATE public.feature_maintenance
     SET maintenance = p_maintenance, updated_by = auth.uid()
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_all_feature_maintenance(boolean) TO authenticated, service_role;