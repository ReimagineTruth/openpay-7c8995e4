-- Fix merchant_products currency constraint to allow OUSD (4 characters)
-- The original constraint only allowed 3-character currencies, but OUSD needs 4

-- Drop and recreate the currency check constraint for merchant_products
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

-- Verify the constraint was updated
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.merchant_products'::regclass 
    AND conname = 'merchant_products_currency_check';
