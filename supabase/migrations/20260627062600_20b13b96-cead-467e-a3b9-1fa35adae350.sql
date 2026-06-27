ALTER TABLE public.nft_store_profiles
  ADD COLUMN IF NOT EXISTS telegram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text;

NOTIFY pgrst, 'reload schema';