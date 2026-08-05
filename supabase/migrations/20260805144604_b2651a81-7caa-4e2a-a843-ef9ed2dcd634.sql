
alter table public.qr_payments add column if not exists pro_settlement_to text;

alter table public.qr_payment_transactions
  add column if not exists pro_settlement_to text,
  add column if not exists pro_settlement_status text,
  add column if not exists pro_settlement_error text,
  add column if not exists pro_settled_at timestamptz;

create or replace function public.qr_pay_normalize_pro_destination(p_to text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare v text;
begin
  v := btrim(coalesce(p_to, ''));
  if v = '' then return null; end if;
  if v ~* '^0x[a-f0-9]{40}$' then return lower(v); end if;
  if v ~* '^uid_[a-f0-9-]{8,}$' then return v; end if;
  v := lower(regexp_replace(v, '^@+', ''));
  if v ~ '^[a-z0-9_]{3,32}$' then return '@' || v; end if;
  raise exception 'invalid_pro_destination';
end;
$$;

create or replace function public.qr_pay_set_pro_settlement(p_token text, p_to text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_pay public.qr_payments; v_norm text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select * into v_pay from public.qr_payments where token = p_token;
  if not found then raise exception 'not_found'; end if;
  if v_pay.merchant_user_id <> auth.uid() then raise exception 'forbidden'; end if;

  v_norm := public.qr_pay_normalize_pro_destination(p_to);

  update public.qr_payments set pro_settlement_to = v_norm, updated_at = now() where id = v_pay.id;
  return jsonb_build_object('token', v_pay.token, 'pro_settlement_to', v_norm);
end;
$$;

grant execute on function public.qr_pay_set_pro_settlement(text, text) to authenticated;
grant execute on function public.qr_pay_normalize_pro_destination(text) to authenticated, anon, service_role;

create or replace function public.qr_pay_get_by_token(p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
DECLARE
  v_pay public.qr_payments;
  v_items jsonb;
  v_merchant jsonb;
BEGIN
  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.expires_at IS NOT NULL AND v_pay.expires_at < now() AND v_pay.status = 'active' THEN
    UPDATE public.qr_payments SET status = 'expired' WHERE id = v_pay.id;
    SELECT * INTO v_pay FROM public.qr_payments WHERE id = v_pay.id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'description', description, 'image_url', image_url,
    'quantity', quantity, 'unit_price', unit_price, 'line_total', line_total
  ) ORDER BY position)
  INTO v_items FROM public.qr_payment_items WHERE qr_payment_id = v_pay.id;

  SELECT jsonb_build_object('id', id, 'full_name', full_name, 'username', username, 'avatar_url', avatar_url)
  INTO v_merchant FROM public.profiles WHERE id = v_pay.merchant_user_id;

  RETURN jsonb_build_object(
    'id', v_pay.id, 'token', v_pay.token, 'title', v_pay.title, 'description', v_pay.description,
    'currency', v_pay.currency, 'subtotal', v_pay.subtotal, 'total', v_pay.total, 'status', v_pay.status,
    'allow_pi', v_pay.allow_pi, 'allow_wallet', v_pay.allow_wallet,
    'allow_virtual_card', v_pay.allow_virtual_card, 'allow_guest', v_pay.allow_guest,
    'reusable', v_pay.reusable, 'expires_at', v_pay.expires_at,
    'payment_type', v_pay.payment_type, 'after_payment_action', v_pay.after_payment_action,
    'download_url', v_pay.download_url, 'redirect_url', v_pay.redirect_url,
    'suggested_amount', v_pay.suggested_amount, 'min_amount', v_pay.min_amount,
    'allow_custom_amount', v_pay.allow_custom_amount, 'cover_image_url', v_pay.cover_image_url,
    'collect_delivery', v_pay.collect_delivery, 'delivery_fields', v_pay.delivery_fields,
    'pro_settlement_to', v_pay.pro_settlement_to,
    'merchant', v_merchant, 'items', COALESCE(v_items,'[]'::jsonb)
  );
END;
$function$;
