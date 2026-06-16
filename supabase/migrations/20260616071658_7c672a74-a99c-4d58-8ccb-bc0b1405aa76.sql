-- Help / Wiki articles editable by OpenPay core admins
CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Basics',
  icon_name text NOT NULL DEFAULT 'BookOpen',
  short text NOT NULL DEFAULT '',
  overview text NOT NULL DEFAULT '',
  steps text[] NOT NULL DEFAULT '{}',
  demo_path text,
  demo_label text,
  youtube_id text,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 100,
  published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.help_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "help_articles read published"
  ON public.help_articles FOR SELECT
  USING (published = true OR public.is_openpay_core_admin() = true);

CREATE POLICY "help_articles admin insert"
  ON public.help_articles FOR INSERT
  WITH CHECK (public.is_openpay_core_admin() = true);

CREATE POLICY "help_articles admin update"
  ON public.help_articles FOR UPDATE
  USING (public.is_openpay_core_admin() = true)
  WITH CHECK (public.is_openpay_core_admin() = true);

CREATE POLICY "help_articles admin delete"
  ON public.help_articles FOR DELETE
  USING (public.is_openpay_core_admin() = true);

CREATE OR REPLACE FUNCTION public.help_articles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_help_articles_updated ON public.help_articles;
CREATE TRIGGER trg_help_articles_updated
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.help_articles_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_help_articles_sort ON public.help_articles (sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON public.help_articles (category);
