
-- ============================================================
-- 1. Rebuild create_app_notification for the current schema
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_app_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_enabled BOOLEAN := true;
  v_norm_type TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT np.in_app_enabled
  INTO v_enabled
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;

  IF v_enabled IS FALSE THEN
    RETURN NULL;
  END IF;

  -- Normalize legacy semantic types to the CHECK constraint set
  v_norm_type := CASE
    WHEN p_type IN ('info','success','warning','error') THEN p_type
    WHEN p_type ILIKE '%fail%' OR p_type ILIKE '%error%' OR p_type ILIKE '%dispute%' THEN 'warning'
    ELSE 'success'
  END;

  INSERT INTO public.app_notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id,
    v_norm_type,
    p_title,
    p_body,
    COALESCE(p_data, '{}'::jsonb) || jsonb_build_object('event', p_type)
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_app_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role, authenticated;

-- ============================================================
-- 2. Push notifications outbox
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_notifications_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NULL REFERENCES public.app_notifications(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_outbox_status_created
  ON public.push_notifications_outbox (status, created_at);

ALTER TABLE public.push_notifications_outbox ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_notifications_outbox' AND policyname='Service role manages push outbox') THEN
    CREATE POLICY "Service role manages push outbox"
      ON public.push_notifications_outbox FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_push_outbox_updated_at ON public.push_notifications_outbox;
CREATE TRIGGER trg_push_outbox_updated_at
BEFORE UPDATE ON public.push_notifications_outbox
FOR EACH ROW EXECUTE FUNCTION public.set_common_updated_at();

-- Auto-queue a push when an in-app notification is created (if user has push enabled)
CREATE OR REPLACE FUNCTION public.queue_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_push_enabled BOOLEAN := true;
  v_has_sub BOOLEAN := false;
BEGIN
  SELECT COALESCE(np.push_enabled, true) INTO v_push_enabled
  FROM public.notification_preferences np
  WHERE np.user_id = NEW.user_id;

  IF v_push_enabled IS FALSE THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id)
  INTO v_has_sub;

  IF NOT v_has_sub THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.push_notifications_outbox (user_id, notification_id, title, body, payload)
  VALUES (
    NEW.user_id,
    NEW.id,
    NEW.title,
    NEW.message,
    COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('notification_id', NEW.id::TEXT, 'type', NEW.type)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_push_for_notification ON public.app_notifications;
CREATE TRIGGER trg_queue_push_for_notification
AFTER INSERT ON public.app_notifications
FOR EACH ROW EXECUTE FUNCTION public.queue_push_for_notification();

-- ============================================================
-- 3. Transaction notification trigger (sender + receiver)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_tx_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount TEXT := to_char(COALESCE(NEW.amount, 0), 'FM999999999990D00');
  v_sender_name TEXT;
  v_receiver_name TEXT;
  v_note TEXT := COALESCE(NEW.note, '');
  v_is_topup BOOLEAN := (NEW.sender_id = NEW.receiver_id);
  v_is_card BOOLEAN := (v_note ILIKE 'Virtual card payment%' OR v_note ILIKE '%| Card ****%');
BEGIN
  SELECT COALESCE(NULLIF(TRIM(p.full_name),''), p.username, 'OpenPay user')
  INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.sender_id;

  SELECT COALESCE(NULLIF(TRIM(p.full_name),''), p.username, 'OpenPay user')
  INTO v_receiver_name FROM public.profiles p WHERE p.id = NEW.receiver_id;

  IF v_is_topup THEN
    PERFORM public.create_app_notification(
      NEW.receiver_id, 'top_up_success',
      'Top up successful',
      format('$%s was added to your OpenPay balance.', v_amount),
      jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount)
    );
    RETURN NEW;
  END IF;

  -- Receiver notification
  PERFORM public.create_app_notification(
    NEW.receiver_id, 'payment_received',
    'Payment received',
    format('You received $%s from %s.', v_amount, COALESCE(v_sender_name,'OpenPay user')),
    jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'sender_id', NEW.sender_id)
  );

  -- Sender notification
  IF v_is_card THEN
    PERFORM public.create_app_notification(
      NEW.sender_id, 'virtual_card_payment_sent',
      'Virtual card payment sent',
      format('$%s was paid to %s using your OpenPay virtual card.', v_amount, COALESCE(v_receiver_name,'OpenPay user')),
      jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'receiver_id', NEW.receiver_id)
    );
  ELSE
    PERFORM public.create_app_notification(
      NEW.sender_id, 'payment_sent',
      'Payment sent',
      format('You sent $%s to %s.', v_amount, COALESCE(v_receiver_name,'OpenPay user')),
      jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'receiver_id', NEW.receiver_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_tx_insert ON public.transactions;
DROP TRIGGER IF EXISTS trg_app_notifications_virtual_card_tx_insert ON public.transactions;
CREATE TRIGGER trg_app_notifications_tx_insert
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_tx_notification();

-- ============================================================
-- 4. Payment request notifications (insert + update)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_request_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount TEXT := to_char(COALESCE(NEW.amount, 0), 'FM999999999990D00');
  v_requester_name TEXT;
  v_payer_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(p.full_name),''), p.username, 'OpenPay user')
  INTO v_requester_name FROM public.profiles p WHERE p.id = NEW.requester_id;
  SELECT COALESCE(NULLIF(TRIM(p.full_name),''), p.username, 'OpenPay user')
  INTO v_payer_name FROM public.profiles p WHERE p.id = NEW.payer_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_app_notification(
      NEW.payer_id, 'money_request_received',
      'Money request',
      format('%s requested $%s from you.', COALESCE(v_requester_name,'Someone'), v_amount),
      jsonb_build_object('request_id', NEW.id, 'amount', NEW.amount, 'requester_id', NEW.requester_id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' THEN
      PERFORM public.create_app_notification(
        NEW.requester_id, 'money_request_paid',
        'Request paid',
        format('%s paid your $%s request.', COALESCE(v_payer_name,'Someone'), v_amount),
        jsonb_build_object('request_id', NEW.id, 'amount', NEW.amount, 'payer_id', NEW.payer_id)
      );
    ELSIF NEW.status = 'declined' THEN
      PERFORM public.create_app_notification(
        NEW.requester_id, 'money_request_declined',
        'Request declined',
        format('%s declined your $%s request.', COALESCE(v_payer_name,'Someone'), v_amount),
        jsonb_build_object('request_id', NEW.id, 'amount', NEW.amount, 'payer_id', NEW.payer_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_request_insert ON public.payment_requests;
DROP TRIGGER IF EXISTS trg_app_notifications_request_update ON public.payment_requests;
CREATE TRIGGER trg_app_notifications_request_insert
AFTER INSERT ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.handle_request_notification();
CREATE TRIGGER trg_app_notifications_request_update
AFTER UPDATE ON public.payment_requests FOR EACH ROW EXECUTE FUNCTION public.handle_request_notification();

-- ============================================================
-- 5. Invoice notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_invoice_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount TEXT := to_char(COALESCE(NEW.amount, 0), 'FM999999999990D00');
  v_sender_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(p.full_name),''), p.username, 'OpenPay merchant')
  INTO v_sender_name FROM public.profiles p WHERE p.id = NEW.sender_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_app_notification(
      NEW.recipient_id, 'invoice_received',
      'Invoice received',
      format('%s sent you an invoice for $%s.', COALESCE(v_sender_name,'A merchant'), v_amount),
      jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount, 'sender_id', NEW.sender_id)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'paid' THEN
    PERFORM public.create_app_notification(
      NEW.sender_id, 'invoice_paid',
      'Invoice paid',
      format('Your invoice for $%s was paid.', v_amount),
      jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount, 'recipient_id', NEW.recipient_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_invoice_insert ON public.invoices;
DROP TRIGGER IF EXISTS trg_app_notifications_invoice_update ON public.invoices;
CREATE TRIGGER trg_app_notifications_invoice_insert
AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_invoice_notification();
CREATE TRIGGER trg_app_notifications_invoice_update
AFTER UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_invoice_notification();

-- ============================================================
-- 6. Dispute notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_dispute_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_app_notification(
      NEW.user_id, 'dispute_opened',
      'Dispute opened',
      format('Your dispute "%s" has been received and is under review.', COALESCE(NULLIF(TRIM(NEW.reason),''),'Transaction issue')),
      jsonb_build_object('dispute_id', NEW.id, 'transaction_id', NEW.transaction_id, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.create_app_notification(
      NEW.user_id, 'dispute_status_update',
      'Dispute update',
      format('Your dispute is now %s.', replace(NEW.status,'_',' ')),
      jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_dispute_insert ON public.disputes;
DROP TRIGGER IF EXISTS trg_app_notifications_dispute_update ON public.disputes;
CREATE TRIGGER trg_app_notifications_dispute_insert
AFTER INSERT ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.handle_dispute_notification();
CREATE TRIGGER trg_app_notifications_dispute_update
AFTER UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.handle_dispute_notification();

-- ============================================================
-- 7. Mining reward notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_mining_reward_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount TEXT := to_char(COALESCE(NEW.amount, 0), 'FM999999999990D0000');
BEGIN
  PERFORM public.create_app_notification(
    NEW.user_id, 'mining_reward',
    CASE WHEN NEW.reward_type = 'referral_bonus' THEN 'Referral mining bonus' ELSE 'Mining reward earned' END,
    format('You earned %s OPEN from mining.', v_amount),
    jsonb_build_object('reward_id', NEW.id, 'amount', NEW.amount, 'reward_type', NEW.reward_type)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_mining_reward ON public.mining_rewards;
CREATE TRIGGER trg_app_notifications_mining_reward
AFTER INSERT ON public.mining_rewards FOR EACH ROW EXECUTE FUNCTION public.handle_mining_reward_notification();

-- ============================================================
-- 8. Staking notifications (created + matured/claimed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_staking_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount TEXT := to_char(COALESCE(NEW.amount, 0), 'FM999999999990D0000');
  v_reward TEXT := to_char(COALESCE(NEW.reward_amount, 0), 'FM999999999990D0000');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_app_notification(
      NEW.user_id, 'stake_created',
      'Stake activated',
      format('You staked %s OPEN for %s days.', v_amount, NEW.lock_days),
      jsonb_build_object('stake_id', NEW.id, 'amount', NEW.amount, 'lock_days', NEW.lock_days)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'matured' THEN
      PERFORM public.create_app_notification(
        NEW.user_id, 'stake_matured',
        'Stake matured',
        format('Your stake of %s OPEN has matured. Reward: %s OPEN.', v_amount, v_reward),
        jsonb_build_object('stake_id', NEW.id, 'amount', NEW.amount, 'reward_amount', NEW.reward_amount)
      );
    ELSIF NEW.status = 'claimed' THEN
      PERFORM public.create_app_notification(
        NEW.user_id, 'stake_claimed',
        'Stake claimed',
        format('You claimed %s OPEN (%s + %s reward).',
          to_char(COALESCE(NEW.amount,0)+COALESCE(NEW.reward_amount,0),'FM999999999990D0000'),
          v_amount, v_reward),
        jsonb_build_object('stake_id', NEW.id, 'reward_amount', NEW.reward_amount)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_staking_insert ON public.staking_positions;
DROP TRIGGER IF EXISTS trg_app_notifications_staking_update ON public.staking_positions;
CREATE TRIGGER trg_app_notifications_staking_insert
AFTER INSERT ON public.staking_positions FOR EACH ROW EXECUTE FUNCTION public.handle_staking_notification();
CREATE TRIGGER trg_app_notifications_staking_update
AFTER UPDATE ON public.staking_positions FOR EACH ROW EXECUTE FUNCTION public.handle_staking_notification();

-- ============================================================
-- 9. Merchant payment notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_merchant_payment_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount TEXT := to_char(COALESCE(NEW.amount, 0), 'FM999999999990D00');
  v_buyer_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(p.full_name),''), p.username, 'A customer')
  INTO v_buyer_name FROM public.profiles p WHERE p.id = NEW.buyer_user_id;

  PERFORM public.create_app_notification(
    NEW.merchant_user_id, 'merchant_payment_received',
    'New merchant payment',
    format('%s paid %s %s.', COALESCE(v_buyer_name,'A customer'), NEW.currency, v_amount),
    jsonb_build_object('merchant_payment_id', NEW.id, 'transaction_id', NEW.transaction_id, 'amount', NEW.amount, 'currency', NEW.currency)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_notifications_merchant_payment ON public.merchant_payments;
CREATE TRIGGER trg_app_notifications_merchant_payment
AFTER INSERT ON public.merchant_payments FOR EACH ROW EXECUTE FUNCTION public.handle_merchant_payment_notification();
