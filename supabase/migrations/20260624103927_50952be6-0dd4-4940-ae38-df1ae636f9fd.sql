
-- NFT Store profiles: OpenSea-style customizable storefront per user
CREATE TABLE IF NOT EXISTS public.nft_store_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  website_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  discord_url TEXT,
  email_public TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  feature_nfts BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nft_store_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_store_profiles TO authenticated;
GRANT ALL ON public.nft_store_profiles TO service_role;

ALTER TABLE public.nft_store_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store profiles are publicly viewable"
  ON public.nft_store_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own store profile"
  ON public.nft_store_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own store profile"
  ON public.nft_store_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own store profile"
  ON public.nft_store_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nft_store_profiles_handle ON public.nft_store_profiles(handle);

CREATE OR REPLACE FUNCTION public.update_nft_store_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_nft_store_profiles_updated_at ON public.nft_store_profiles;
CREATE TRIGGER trg_nft_store_profiles_updated_at
  BEFORE UPDATE ON public.nft_store_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_nft_store_profiles_updated_at();

-- Followers (OpenSea-style follow)
CREATE TABLE IF NOT EXISTS public.nft_store_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followed_id)
);

GRANT SELECT ON public.nft_store_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.nft_store_follows TO authenticated;
GRANT ALL ON public.nft_store_follows TO service_role;

ALTER TABLE public.nft_store_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are publicly viewable"
  ON public.nft_store_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow"
  ON public.nft_store_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow"
  ON public.nft_store_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);
