// Script to apply merchant_products currency constraint fix
// Run this with: node apply_currency_fix.js

const { createClient } = require('@supabase/supabase-js');

// You need to set these environment variables or replace them directly
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyCurrencyFix() {
    try {
        console.log('Applying merchant_products currency constraint fix...');
        
        const { error } = await supabase.rpc('exec_sql', {
            sql: `
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
            `
        });
        
        if (error) {
            console.error('Error applying fix:', error);
            return false;
        }
        
        console.log('✅ Currency constraint fix applied successfully!');
        console.log('The merchant_products table now accepts 2-10 character currency codes (including OUSD)');
        return true;
        
    } catch (err) {
        console.error('Unexpected error:', err);
        return false;
    }
}

// Alternative approach using direct SQL if you have psql access
console.log(`
If the above script doesn't work, you can manually run this SQL in your Supabase SQL Editor:

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
`);

applyCurrencyFix();
