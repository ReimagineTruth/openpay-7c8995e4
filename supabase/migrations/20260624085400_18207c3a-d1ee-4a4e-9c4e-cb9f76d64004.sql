
REVOKE EXECUTE ON FUNCTION public.nft_mint_item(uuid,text,text,text,text,text,text,integer,numeric,text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_buy_item(uuid,integer,text,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_gift_item(uuid,uuid,integer,text) FROM PUBLIC, anon;
