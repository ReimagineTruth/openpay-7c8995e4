
ALTER TABLE public.nft_items ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_nft_items_creator_pinned ON public.nft_items(creator_id, pinned DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.nft_toggle_pin(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.nft_items
    SET pinned = NOT COALESCE(pinned,false), updated_at = now()
    WHERE id = p_item_id AND creator_id = v_uid
    RETURNING pinned INTO v_new;
  IF v_new IS NULL THEN RAISE EXCEPTION 'Not authorized or item not found'; END IF;
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.nft_delete_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.nft_items%ROWTYPE;
  v_sold int;
  v_other_owners int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF v_item.creator_id <> v_uid THEN RAISE EXCEPTION 'Only the creator can delete this item'; END IF;

  SELECT COALESCE(SUM(quantity),0) INTO v_other_owners
    FROM public.nft_ownership WHERE item_id = p_item_id AND owner_id <> v_uid AND quantity > 0;
  SELECT COUNT(*) INTO v_sold FROM public.nft_transactions
    WHERE item_id = p_item_id AND tx_kind IN ('sale','primary_sale','resale','auction_settle');

  IF v_other_owners > 0 OR v_sold > 0 THEN
    -- soft-delete: hide from marketplace / stores
    UPDATE public.nft_items SET is_active = false, pinned = false, updated_at = now() WHERE id = p_item_id;
    -- cancel any active listings / auctions by this creator
    UPDATE public.nft_listings SET status = 'cancelled' WHERE item_id = p_item_id AND seller_id = v_uid AND status = 'active';
    UPDATE public.nft_auctions SET status = 'cancelled' WHERE item_id = p_item_id AND seller_id = v_uid AND status = 'active';
    RETURN jsonb_build_object('deleted', false, 'hidden', true);
  END IF;

  DELETE FROM public.nft_listings WHERE item_id = p_item_id;
  DELETE FROM public.nft_auctions WHERE item_id = p_item_id;
  DELETE FROM public.nft_ownership WHERE item_id = p_item_id;
  DELETE FROM public.nft_transactions WHERE item_id = p_item_id;
  DELETE FROM public.nft_items WHERE id = p_item_id;
  RETURN jsonb_build_object('deleted', true, 'hidden', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.nft_toggle_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_delete_item(uuid) TO authenticated;
