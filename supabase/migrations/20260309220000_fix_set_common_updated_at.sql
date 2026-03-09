-- Fix: set_common_updated_at() should not fail on tables without updated_at.
-- Some deployments attach this trigger broadly; referencing NEW.updated_at on a table
-- without that column raises ERROR 42703 (undefined_column).

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

