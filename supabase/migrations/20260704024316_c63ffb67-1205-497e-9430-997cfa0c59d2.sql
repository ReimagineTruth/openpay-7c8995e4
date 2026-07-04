-- Owner-controlled visibility for their own NFT items
ALTER TABLE public.nft_items ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.nft_toggle_hidden(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_creator uuid;
  v_new boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT creator_id INTO v_creator FROM public.nft_items WHERE id = p_item_id;
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF v_creator <> v_uid THEN
    RAISE EXCEPTION 'Only the creator can change visibility';
  END IF;
  UPDATE public.nft_items
    SET hidden = NOT COALESCE(hidden, false), updated_at = now()
    WHERE id = p_item_id
    RETURNING hidden INTO v_new;
  RETURN jsonb_build_object('hidden', v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.nft_toggle_hidden(uuid) TO authenticated;