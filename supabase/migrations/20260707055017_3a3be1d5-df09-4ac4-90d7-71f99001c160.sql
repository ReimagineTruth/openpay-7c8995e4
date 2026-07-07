ALTER TABLE public.nft_listings DROP CONSTRAINT IF EXISTS nft_listings_quantity_check;
ALTER TABLE public.nft_listings ADD CONSTRAINT nft_listings_quantity_check CHECK (quantity >= 0);