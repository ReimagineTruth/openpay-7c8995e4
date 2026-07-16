
CREATE TABLE public.openpay_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  rating INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  feature TEXT,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','in_progress','resolved','dismissed')),
  admin_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.openpay_feedback TO authenticated;
GRANT ALL ON public.openpay_feedback TO service_role;

ALTER TABLE public.openpay_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback"
  ON public.openpay_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback"
  ON public.openpay_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_openpay_core_admin());

CREATE POLICY "Admins can update feedback"
  ON public.openpay_feedback FOR UPDATE TO authenticated
  USING (public.is_openpay_core_admin())
  WITH CHECK (public.is_openpay_core_admin());

CREATE INDEX openpay_feedback_status_created_idx ON public.openpay_feedback (status, created_at DESC);
CREATE INDEX openpay_feedback_user_idx ON public.openpay_feedback (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_openpay_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER openpay_feedback_updated_at
  BEFORE UPDATE ON public.openpay_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_openpay_feedback_updated_at();
