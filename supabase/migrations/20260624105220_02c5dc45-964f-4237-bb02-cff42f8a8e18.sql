ALTER TABLE public.nft_store_profiles ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_nft_store_profiles_category ON public.nft_store_profiles(category);
ALTER TABLE public.nft_items ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_nft_items_category ON public.nft_items(category);