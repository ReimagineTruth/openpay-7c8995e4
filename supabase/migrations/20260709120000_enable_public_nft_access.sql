-- Enable public access for NFT marketplace
-- This allows unauthenticated users to view NFT items and store profiles

-- Grant SELECT access to public (anonymous) users
GRANT SELECT ON public.nft_items TO anon;
GRANT SELECT ON public.nft_store_profiles TO anon;
GRANT SELECT ON public.nft_ownership TO anon;
GRANT SELECT ON public.nft_transactions TO anon;
GRANT SELECT ON public.nft_auctions TO anon;

-- Create public policies for anonymous users
CREATE POLICY "nft_items_select_public" ON public.nft_items FOR SELECT TO anon 
USING (is_active = true AND hidden = false);

CREATE POLICY "nft_store_profiles_select_public" ON public.nft_store_profiles FOR SELECT TO anon 
USING (true);

CREATE POLICY "nft_ownership_select_public" ON public.nft_ownership FOR SELECT TO anon 
USING (true);

CREATE POLICY "nft_transactions_select_public" ON public.nft_transactions FOR SELECT TO anon 
USING (true);

CREATE POLICY "nft_auctions_select_public" ON public.nft_auctions FOR SELECT TO anon 
USING (status = 'active');