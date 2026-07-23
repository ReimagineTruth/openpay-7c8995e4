ALTER TABLE public.nft_transactions DROP CONSTRAINT IF EXISTS nft_transactions_tx_kind_check;
ALTER TABLE public.nft_transactions ADD CONSTRAINT nft_transactions_tx_kind_check
  CHECK (tx_kind = ANY (ARRAY['mint','sale','primary_sale','resale','gift','bid','bid_fee','auction_start','auction_settle']));