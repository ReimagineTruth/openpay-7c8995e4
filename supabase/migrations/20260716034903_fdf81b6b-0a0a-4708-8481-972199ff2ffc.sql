-- Allow anonymous (logged-out) visitors to view basic profile info so public NFT store pages work without an account.
CREATE POLICY "Profiles are publicly viewable"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON public.profiles TO anon;