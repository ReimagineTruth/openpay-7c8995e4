
-- Blog posts: admin-editable, public read for published
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  category text NOT NULL DEFAULT 'General',
  tags text[] NOT NULL DEFAULT '{}',
  author_name text NOT NULL DEFAULT 'OpenPay',
  youtube_id text,
  video_url text,
  published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  views int NOT NULL DEFAULT 0,
  likes int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts read published"
  ON public.blog_posts FOR SELECT
  USING (published = true OR public.is_openpay_core_admin() = true);

CREATE POLICY "blog_posts admin insert"
  ON public.blog_posts FOR INSERT
  WITH CHECK (public.is_openpay_core_admin() = true);

CREATE POLICY "blog_posts admin update"
  ON public.blog_posts FOR UPDATE
  USING (public.is_openpay_core_admin() = true)
  WITH CHECK (public.is_openpay_core_admin() = true);

CREATE POLICY "blog_posts admin delete"
  ON public.blog_posts FOR DELETE
  USING (public.is_openpay_core_admin() = true);

CREATE OR REPLACE FUNCTION public.blog_posts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_blog_posts_updated ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.blog_posts_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts (published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts (category);

-- Seed a few OpenPay feature posts (idempotent)
INSERT INTO public.blog_posts (slug, title, excerpt, content, category, tags, author_name, published)
VALUES
  ('welcome-to-openpay', 'Welcome to OpenPay — A New Way to Pay, Save & Grow',
    'Discover OpenPay: send money, pay with QR, accept POS payments, mine rewards, and more — all in one app.',
    E'# Welcome to OpenPay\n\nOpenPay brings together payments, savings, mining rewards, and merchant tools in a single beautifully designed app.\n\n## Key Highlights\n- Instant transfers to friends and family\n- QR Pay & POS checkout for merchants\n- Daily mining rewards via Pi Ad Network\n- Multi-currency wallet (30+ currencies)\n- Bank-grade security with MPIN & biometrics\n\nWe are just getting started. Stay tuned for more updates!',
    'Announcement', ARRAY['announcement','update'], 'OpenPay Team', true),
  ('qr-pay-explained', 'QR Pay Explained — Accept Payments in Seconds',
    'Generate a QR, share a link, or embed a button. OpenPay QR Pay turns any device into a checkout.',
    E'# QR Pay Explained\n\nWith OpenPay QR Pay you can:\n\n- Create one-time or reusable payment QR codes\n- Share a hosted checkout link\n- Embed a Pay button, iFrame, or widget into any website\n- Receive instant settlement to your OpenPay wallet\n\nOpen the QR Pay dashboard to view real-time analytics across daily, monthly, and yearly windows.',
    'Feature', ARRAY['qr','merchant'], 'OpenPay Team', true),
  ('mining-rewards-guide', 'Earn Daily with OpenPay Mining',
    'Activate your 24-hour mining cycle with a single rewarded ad and earn OUSD daily.',
    E'# Mining Rewards\n\nOpenPay rewards active Pioneers with daily mining sessions. Activate a session by watching one Pi rewarded ad and let it run for 24 hours.\n\n## How to start\n1. Open the Dashboard\n2. Tap the Mining card\n3. Watch a short ad to activate\n4. Come back tomorrow to claim',
    'Guide', ARRAY['mining','rewards'], 'OpenPay Team', true)
ON CONFLICT (slug) DO NOTHING;
