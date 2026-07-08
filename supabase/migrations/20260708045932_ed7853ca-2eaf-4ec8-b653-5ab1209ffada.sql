CREATE TABLE IF NOT EXISTS public.feature_quest_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_steps TEXT[] NOT NULL DEFAULT '{}',
  claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_quest_progress TO authenticated;
GRANT ALL ON public.feature_quest_progress TO service_role;

ALTER TABLE public.feature_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feature quest progress"
ON public.feature_quest_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_feature_quest_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feature_quest_progress_updated_at ON public.feature_quest_progress;
CREATE TRIGGER trg_feature_quest_progress_updated_at
BEFORE UPDATE ON public.feature_quest_progress
FOR EACH ROW EXECUTE FUNCTION public.update_feature_quest_updated_at();