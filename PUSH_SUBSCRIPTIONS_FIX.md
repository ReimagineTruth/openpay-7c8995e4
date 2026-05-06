# Fix Missing push_subscriptions Table

## Problem
The error `relation "public.push_subscriptions" does not exist` indicates that the push_subscriptions table is missing from your Supabase database.

## Solution

### Option 1: Run SQL in Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy and paste the following SQL code:

```sql
-- Create the push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON public.push_subscriptions TO authenticated;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_common_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    NEW.updated_at := now();
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

-- Verify table creation
SELECT 'push_subscriptions table created successfully' as status;
```

6. Click **Run** to execute the SQL

### Option 2: Use the Migration File

If you have access to run migrations, you can apply the existing migration:

```bash
# If you have Supabase CLI setup
supabase db push
```

### Option 3: Verify Table Exists

After running the SQL, verify the table was created:

```sql
-- Check if table exists
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'push_subscriptions';
```

## What This Fixes

- Creates the missing `push_subscriptions` table
- Sets up proper Row Level Security (RLS) policies
- Adds necessary indexes for performance
- Enables realtime subscriptions
- Creates triggers for automatic timestamp updates

## After Fix

Once the table is created, the push notification system should work correctly without the "relation does not exist" error.

## Troubleshooting

If you still get errors after running the SQL:

1. Check that you're using the correct project in Supabase
2. Ensure you have sufficient permissions (admin or service role)
3. Try refreshing the Supabase dashboard
4. Check the SQL Editor results for any error messages
