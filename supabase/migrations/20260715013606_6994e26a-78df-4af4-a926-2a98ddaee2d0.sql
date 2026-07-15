-- Marketplace: is_active + hidden + created_at DESC
CREATE INDEX IF NOT EXISTS idx_nft_items_active_created
  ON public.nft_items (created_at DESC)
  WHERE is_active = true AND hidden = false;

-- Marketplace: creator aggregations over active items
CREATE INDEX IF NOT EXISTS idx_nft_items_creator_active
  ON public.nft_items (creator_id)
  WHERE is_active = true AND hidden = false;

-- Activity feeds: recent transactions with ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_nft_transactions_created
  ON public.nft_transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nft_transactions_seller_created
  ON public.nft_transactions (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nft_transactions_buyer_created
  ON public.nft_transactions (buyer_id, created_at DESC);

-- Filter by tx_kind for sales aggregations
CREATE INDEX IF NOT EXISTS idx_nft_transactions_item_kind
  ON public.nft_transactions (item_id, tx_kind);

-- My Collection: owner + quantity > 0
CREATE INDEX IF NOT EXISTS idx_nft_ownership_owner_qty
  ON public.nft_ownership (owner_id)
  WHERE quantity > 0;

-- Active auctions lookup by item
CREATE INDEX IF NOT EXISTS idx_nft_auctions_item_status
  ON public.nft_auctions (item_id, status);

-- Active listings lookup by item
CREATE INDEX IF NOT EXISTS idx_nft_listings_item_status
  ON public.nft_listings (item_id, status);
