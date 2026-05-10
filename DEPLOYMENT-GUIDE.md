# App Developer Dashboard - Deployment Guide

## SQL Error Fixed ✅

The PostgreSQL error "input parameters after one with a default value must also have defaults" has been fixed by:

1. **Reordering function parameters** - Moved all parameters with default values to the end
2. **Fixed functions:**
   - `create_app()` - Removed default values from optional parameters
   - `create_app_payment_plan()` - Kept defaults for currency, trial_days, setup_fee at end
   - `process_app_payment()` - Moved required parameters before optional ones

## Quick Deployment Steps

### 1. Apply Database Migration Fix
```bash
# Option A: Apply the fix directly
psql -h your-db-host -U postgres -d your-db -f apply-migration-fix.sql

# Option B: Reset and re-migrate (WARNING: This will delete existing data)
supabase db reset
supabase db push
```

### 2. Deploy Edge Function
```bash
supabase functions deploy app-payments --no-verify-jwt
```

### 3. Verify Deployment
```bash
# Test function health
curl -X GET "https://your-project.supabase.co/functions/v1/app-payments" \
     -H "Authorization: Bearer your-anon-key" \
     -H "Content-Type: application/json"

# Check function logs
supabase functions logs app-payments
```

## Testing the Fix

### Test App Creation
```sql
-- Test the fixed function directly
SELECT * FROM create_app(
  'Test App',
  'Test Description',
  'https://testapp.com',
  NULL,
  'https://testapp.com/webhook'
);
```

### Test Plan Creation
```sql
-- Test payment plan creation
SELECT create_app_payment_plan(
  'your-app-id',
  'Premium Plan',
  'Premium features',
  'one_time',
  9.99
);
```

## Common Issues & Solutions

### Issue: "Function already exists" Error
**Solution:** The fix script drops existing functions first. If you still get this error:
```sql
DROP FUNCTION IF EXISTS public.create_app CASCADE;
DROP FUNCTION IF EXISTS public.create_app_payment_plan CASCADE;
DROP FUNCTION IF EXISTS public.process_app_payment CASCADE;
```

### Issue: Permission Denied
**Solution:** Ensure RLS policies are correctly set:
```sql
-- Check if user has permission
SELECT has_function_privilege('public.create_app(text, text, text, text, text)', 'execute');
```

### Issue: Edge Function Not Responding
**Solution:** Check deployment status:
```bash
supabase functions list
supabase functions logs app-payments --follow
```

## Verification Checklist

- [ ] SQL migration applied without errors
- [ ] Edge function deployed successfully
- [ ] Can create new app in dashboard
- [ ] Can create payment plans
- [ ] Can view analytics
- [ ] API keys are generated correctly
- [ ] Payment links work correctly

## Files Updated

1. **Database Migration:** `20260321000000_app_payment_system.sql`
   - Fixed parameter ordering in all functions
   
2. **Migration Fix:** `apply-migration-fix.sql`
   - Standalone script to apply fixes safely

3. **Frontend:** `src/pages/AppDeveloperDashboardPage.tsx`
   - Already fixed authentication issues

4. **Edge Function:** `supabase/functions/app-payments/index.ts`
   - Already added missing endpoints

## Next Steps After Deployment

1. **Test Complete Flow:**
   - Login → Dashboard → Create App → Create Plan → Test Payment

2. **Monitor Logs:**
   ```bash
   supabase functions logs app-payments --follow
   ```

3. **Check Database:**
   ```sql
   SELECT * FROM app_registry ORDER BY created_at DESC;
   SELECT * FROM app_payment_plans ORDER BY created_at DESC;
   ```

The app developer dashboard should now work without SQL errors!
