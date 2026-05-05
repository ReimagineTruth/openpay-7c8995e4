
-- 1) Update staking rates
CREATE OR REPLACE FUNCTION public.create_stake(p_amount numeric, p_lock_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_lock_days INTEGER := COALESCE(p_lock_days, 0);
  v_reward_rate NUMERIC(8,6);
  v_reward_amount NUMERIC(12,2);
  v_wallet_balance NUMERIC(12,2);
  v_position_id UUID;
  v_ends_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_amount < 1 THEN RAISE EXCEPTION 'Minimum stake is 1 OPEN USD'; END IF;
  IF v_lock_days NOT IN (7, 30, 90, 365) THEN RAISE EXCEPTION 'Invalid lock duration'; END IF;

  v_reward_rate := CASE v_lock_days
    WHEN 7 THEN 0.0002
    WHEN 30 THEN 0.01
    WHEN 90 THEN 0.04
    WHEN 365 THEN 0.06
  END;

  v_reward_amount := ROUND(v_amount * v_reward_rate, 2);
  v_ends_at := now() + (v_lock_days || ' days')::INTERVAL;

  SELECT balance INTO v_wallet_balance FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;
  IF v_wallet_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet_balance < v_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.wallets SET balance = v_wallet_balance - v_amount, updated_at = now() WHERE user_id = v_user_id;

  INSERT INTO public.staking_positions (user_id, amount, lock_days, reward_rate, reward_amount, status, ends_at)
  VALUES (v_user_id, v_amount, v_lock_days, v_reward_rate, v_reward_amount, 'active', v_ends_at)
  RETURNING id INTO v_position_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (v_user_id, v_user_id, v_amount, CONCAT('Stake lock | ', v_lock_days, ' days | Reward ', v_reward_amount::TEXT, ' OPEN USD'), 'completed');

  RETURN jsonb_build_object('success', true, 'position_id', v_position_id, 'reward_amount', v_reward_amount, 'ends_at', v_ends_at);
END;
$function$;

-- 2) Affiliate socials
CREATE TABLE IF NOT EXISTS public.affiliate_socials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('x','twitter','instagram','tiktok','youtube','facebook','telegram','threads','linkedin','reddit','other')),
  handle TEXT NOT NULL,
  url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, handle)
);
ALTER TABLE public.affiliate_socials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own socials" ON public.affiliate_socials
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins view socials" ON public.affiliate_socials
  FOR SELECT TO authenticated USING (public.is_openpay_core_admin());

-- 3) Affiliate tasks (catalog)
CREATE TABLE IF NOT EXISTS public.affiliate_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('daily','ugc','social','share')),
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 0.50,
  proof_required BOOLEAN NOT NULL DEFAULT true,
  recurrence TEXT NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once','daily')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks readable" ON public.affiliate_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage tasks" ON public.affiliate_tasks FOR ALL TO authenticated
  USING (public.is_openpay_core_admin()) WITH CHECK (public.is_openpay_core_admin());

-- 4) Submissions
CREATE TABLE IF NOT EXISTS public.affiliate_task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.affiliate_tasks(id) ON DELETE CASCADE,
  proof_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_subs_user ON public.affiliate_task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_aff_subs_status ON public.affiliate_task_submissions(status);
ALTER TABLE public.affiliate_task_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own subs" ON public.affiliate_task_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_openpay_core_admin());
CREATE POLICY "users insert own subs" ON public.affiliate_task_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins update subs" ON public.affiliate_task_submissions FOR UPDATE TO authenticated
  USING (public.is_openpay_core_admin()) WITH CHECK (public.is_openpay_core_admin());

-- 5) Seed default tasks
INSERT INTO public.affiliate_tasks (title, description, task_type, reward_amount, proof_required, recurrence)
SELECT * FROM (VALUES
  ('Tweet about OpenPay', 'Post on X tagging @OpenPay with your referral link. Submit the post URL.', 'daily', 0.25, true, 'daily'),
  ('Share on Instagram Story', 'Share an Instagram story tagging @openpay with your referral link.', 'daily', 0.25, true, 'daily'),
  ('TikTok shoutout', 'Post a short TikTok mentioning OpenPay and tag @openpay.', 'daily', 0.50, true, 'daily'),
  ('Create UGC video (60s+)', 'Create a 60s+ UGC video reviewing OpenPay. Submit the public URL.', 'ugc', 5.00, true, 'once'),
  ('Write a blog/medium post', 'Publish a blog or Medium article about OpenPay with your referral link.', 'ugc', 3.00, true, 'once'),
  ('Join + share Telegram', 'Join the OpenPay Telegram and share your referral link with one community.', 'social', 0.50, true, 'once'),
  ('YouTube Short / Reel', 'Upload a YouTube short or Reel about OpenPay and tag @openpay.', 'ugc', 4.00, true, 'once')
) AS v(title, description, task_type, reward_amount, proof_required, recurrence)
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_tasks);

-- 6) RPC: submit task
CREATE OR REPLACE FUNCTION public.submit_affiliate_task(p_task_id uuid, p_proof_url text, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_task public.affiliate_tasks%ROWTYPE;
  v_sub_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_task FROM public.affiliate_tasks WHERE id = p_task_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF v_task.proof_required AND COALESCE(BTRIM(p_proof_url),'') = '' THEN
    RAISE EXCEPTION 'Proof URL required';
  END IF;

  IF v_task.recurrence = 'daily' THEN
    IF EXISTS (
      SELECT 1 FROM public.affiliate_task_submissions
      WHERE user_id = v_user_id AND task_id = p_task_id
        AND created_at::date = (now() AT TIME ZONE 'UTC')::date
    ) THEN
      RAISE EXCEPTION 'You already submitted this daily task today';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.affiliate_task_submissions
      WHERE user_id = v_user_id AND task_id = p_task_id AND status IN ('pending','approved')
    ) THEN
      RAISE EXCEPTION 'You already submitted this task';
    END IF;
  END IF;

  INSERT INTO public.affiliate_task_submissions (user_id, task_id, proof_url, notes, reward_amount)
  VALUES (v_user_id, p_task_id, p_proof_url, p_notes, v_task.reward_amount)
  RETURNING id INTO v_sub_id;
  RETURN jsonb_build_object('success', true, 'submission_id', v_sub_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_affiliate_task(uuid, text, text) TO authenticated;

-- 7) RPC: review (admin)
CREATE OR REPLACE FUNCTION public.review_affiliate_submission(p_submission_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_sub public.affiliate_task_submissions%ROWTYPE;
BEGIN
  IF NOT public.is_openpay_core_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_sub FROM public.affiliate_task_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF v_sub.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;

  IF p_approve THEN
    UPDATE public.affiliate_task_submissions
    SET status='approved', reviewed_by=v_admin, reviewed_at=now(), review_note=p_note
    WHERE id = p_submission_id;

    INSERT INTO public.wallets (user_id, balance) VALUES (v_sub.user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.wallets SET balance = balance + v_sub.reward_amount, updated_at = now()
    WHERE user_id = v_sub.user_id;
    INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
    VALUES (v_sub.user_id, v_sub.user_id, v_sub.reward_amount, 'Affiliate task reward', 'completed');
  ELSE
    UPDATE public.affiliate_task_submissions
    SET status='rejected', reviewed_by=v_admin, reviewed_at=now(), review_note=p_note
    WHERE id = p_submission_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END; $$;
GRANT EXECUTE ON FUNCTION public.review_affiliate_submission(uuid, boolean, text) TO authenticated;
