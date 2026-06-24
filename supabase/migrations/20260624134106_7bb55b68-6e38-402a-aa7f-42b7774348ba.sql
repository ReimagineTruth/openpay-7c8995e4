CREATE TABLE IF NOT EXISTS public.nft_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  item_id UUID REFERENCES public.nft_items(id) ON DELETE SET NULL,
  reply_to UUID REFERENCES public.nft_chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.nft_chat_messages TO authenticated;
GRANT ALL ON public.nft_chat_messages TO service_role;

ALTER TABLE public.nft_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read NFT chat"
  ON public.nft_chat_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can post their own messages"
  ON public.nft_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.nft_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nft_chat_created ON public.nft_chat_messages(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.nft_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nft_auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nft_auction_bids;