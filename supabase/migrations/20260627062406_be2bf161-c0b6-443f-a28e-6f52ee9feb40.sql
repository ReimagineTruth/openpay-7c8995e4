REVOKE EXECUTE ON FUNCTION public.nft_admin_list_items(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_admin_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_admin_recent_activity(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_admin_remove_item(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_admin_restore_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_admin_set_platform_fee(boolean, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_get_platform_fee() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_get_mint_fee() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_get_bid_fee() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.nft_admin_list_items(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_recent_activity(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_remove_item(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_restore_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_set_platform_fee(boolean, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_get_platform_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_get_mint_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_get_bid_fee() TO authenticated;

NOTIFY pgrst, 'reload schema';