# Fix for merchant_products Currency Constraint Error

## Problem
Error: "new row for relation 'merchant_products' violates check constraint 'merchant_products_currency_check'"

This occurs when trying to create a product with OUSD currency (4 characters) because the existing constraint only allows 3-character currencies.

## Solution Options

### Option 1: Run the Migration (Recommended)
1. **Start Docker Desktop** (must be running first)
2. Run these commands in your terminal:
   ```bash
   cd c:\Users\mrjay\Downloads\openpay-9
   supabase start
   supabase db push
   ```

### Option 2: Run SQL Directly
Execute this SQL in your database (via Supabase Dashboard SQL Editor, psql, or any PostgreSQL client):

```sql
-- Fix merchant_products currency constraint to allow OUSD (4 characters)
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    ALTER TABLE public.merchant_products DROP CONSTRAINT IF EXISTS merchant_products_currency_check;
    
    -- Add the relaxed constraint that allows 2-10 character currency codes
    ALTER TABLE public.merchant_products ADD CONSTRAINT merchant_products_currency_check 
        CHECK (char_length(currency) >= 2 AND char_length(currency) <= 10);
    
    RAISE NOTICE 'merchant_products currency constraint updated to allow 2-10 characters';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating merchant_products currency constraint: %', SQLERRM;
END $$;
```

## What This Fixes
- Allows OUSD (4 characters) to be used in merchant_products
- Also allows other longer currency codes like USDT, USDC, etc.
- Maintains validation (2-10 characters) while being more flexible

## Verification
After applying the fix, you should be able to:
1. Create products with OUSD currency
2. Save products without the constraint violation error
3. Use the product publishing feature successfully

## Migration File Location
The migration file is located at: `supabase/migrations/20260226000000_relax_currency_constraints.sql`
