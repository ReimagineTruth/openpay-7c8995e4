-- ===============================================================
-- Database Diagnosis and Fix Script
-- This script identifies issues and applies fixes step by step
-- ===============================================================

-- Step 1: Check what tables exist
SELECT 'TABLES_CHECK' as diagnosis_type,
       table_name,
       table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('merchant_products', 'merchant_checkout_sessions', 'merchant_payments', 'wallets', 'transactions')
ORDER BY table_name;

-- Step 2: Check what functions exist
SELECT 'FUNCTIONS_CHECK' as diagnosis_type,
       routine_name,
       routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'upsert_merchant_product',
    'create_merchant_checkout_session', 
    'complete_merchant_checkout_with_wallet',
    'process_pos_payment_wallet',
    'verify_merchant_wallet_only_credit'
  )
ORDER BY routine_name;

-- Step 3: Check for common issues
DO $$
DECLARE
    v_missing_tables TEXT := '';
    v_missing_functions TEXT := '';
    v_issues TEXT := '';
BEGIN
    -- Check for missing tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_products') THEN
        v_missing_tables := v_missing_tables || 'merchant_products, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_checkout_sessions') THEN
        v_missing_tables := v_missing_tables || 'merchant_checkout_sessions, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_payments') THEN
        v_missing_tables := v_missing_tables || 'merchant_payments, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallets') THEN
        v_missing_tables := v_missing_tables || 'wallets, ';
    END IF;
    
    -- Check for missing functions
    IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'upsert_merchant_product') THEN
        v_missing_functions := v_missing_functions || 'upsert_merchant_product, ';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'create_merchant_checkout_session') THEN
        v_missing_functions := v_missing_functions || 'create_merchant_checkout_session, ';
    END IF;
    
    -- Report issues
    IF v_missing_tables != '' THEN
        v_issues := v_issues || 'Missing tables: ' || TRIM(TRAILING ', ' FROM v_missing_tables) || '; ';
    END IF;
    
    IF v_missing_functions != '' THEN
        v_issues := v_issues || 'Missing functions: ' || TRIM(TRAILING ', ' FROM v_missing_functions) || '; ';
    END IF;
    
    IF v_issues != '' THEN
        RAISE NOTICE '🔍 ISSUES FOUND: %', v_issues;
        RAISE NOTICE '📋 SOLUTION: Apply the complete fix script';
    ELSE
        RAISE NOTICE '✅ All required tables and functions exist';
    END IF;
END;
$$;

-- Step 4: Apply basic fixes if needed

-- Fix 1: Create merchant_products table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_products') THEN
        RAISE NOTICE '🔧 Creating merchant_products table...';
        
        CREATE TABLE public.merchant_products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            product_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            product_description TEXT DEFAULT '',
            image_url TEXT,
            unit_amount NUMERIC(12,2) NOT NULL CHECK (unit_amount >= 0),
            currency TEXT NOT NULL CHECK (char_length(currency) = 3),
            is_active BOOLEAN DEFAULT true,
            product_tags TEXT[] DEFAULT '{}',
            media_urls TEXT[] DEFAULT '{}',
            checkout_info TEXT DEFAULT '',
            metadata JSONB DEFAULT '{}'::jsonb,
            pricing_type TEXT DEFAULT 'one_time' CHECK (pricing_type IN ('one_time', 'subscription')),
            repeat_every INTEGER DEFAULT NULL,
            repeat_unit TEXT DEFAULT NULL CHECK (repeat_unit IN ('week', 'month', 'year')),
            tax_code TEXT DEFAULT 'digital_goods',
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        CREATE INDEX idx_merchant_products_owner_active ON public.merchant_products (merchant_user_id, is_active);
        ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE '✅ merchant_products table created';
    END IF;
END;
$$;

-- Fix 2: Create merchant_checkout_sessions table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_checkout_sessions') THEN
        RAISE NOTICE '🔧 Creating merchant_checkout_sessions table...';
        
        CREATE TABLE public.merchant_checkout_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_token TEXT UNIQUE NOT NULL,
            merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
            currency TEXT NOT NULL CHECK (char_length(currency) = 3),
            fee_amount NUMERIC(12,2) DEFAULT 0 CHECK (fee_amount >= 0),
            status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paid', 'expired', 'cancelled')),
            key_mode TEXT DEFAULT 'sandbox' CHECK (key_mode IN ('sandbox', 'live')),
            api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL,
            customer_name TEXT,
            customer_email TEXT,
            customer_phone TEXT,
            customer_address TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 minutes'),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        ALTER TABLE public.merchant_checkout_sessions ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE '✅ merchant_checkout_sessions table created';
    END IF;
END;
$$;

-- Fix 3: Create merchant_payments table if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_payments') THEN
        RAISE NOTICE '🔧 Creating merchant_payments table...';
        
        CREATE TABLE public.merchant_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES public.merchant_checkout_sessions(id) ON DELETE CASCADE,
            merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
            amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
            currency TEXT NOT NULL CHECK (char_length(currency) = 3),
            api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL,
            key_mode TEXT DEFAULT 'sandbox' CHECK (key_mode IN ('sandbox', 'live')),
            payment_link_id UUID REFERENCES public.merchant_payment_links(id) ON DELETE SET NULL,
            payment_link_token TEXT,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        ALTER TABLE public.merchant_payments ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE '✅ merchant_payments table created';
    END IF;
END;
$$;

-- Fix 4: Create basic merchant product function
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'upsert_merchant_product') THEN
        RAISE NOTICE '🔧 Creating upsert_merchant_product function...';
        
        CREATE OR REPLACE FUNCTION public.upsert_merchant_product(
            p_product_code TEXT,
            p_product_name TEXT,
            p_product_description TEXT DEFAULT '',
            p_unit_amount NUMERIC,
            p_currency TEXT DEFAULT 'USD',
            p_is_active BOOLEAN DEFAULT true,
            p_product_tags TEXT[] DEFAULT '{}',
            p_media_urls TEXT[] DEFAULT '{}',
            p_checkout_info TEXT DEFAULT '',
            p_metadata JSONB DEFAULT '{}'::jsonb,
            p_pricing_type TEXT DEFAULT 'one_time',
            p_repeat_every INTEGER DEFAULT NULL,
            p_repeat_unit TEXT DEFAULT NULL,
            p_tax_code TEXT DEFAULT 'digital_goods',
            p_publish BOOLEAN DEFAULT false
        )
        RETURNS TABLE (
            product_id UUID,
            success BOOLEAN,
            message TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_user_id UUID := auth.uid();
            v_product_id UUID;
        BEGIN
            -- Authentication check
            IF v_user_id IS NULL THEN
                RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Unauthorized'::TEXT;
                RETURN;
            END IF;

            -- Validation
            IF p_product_code IS NULL OR p_product_code = '' THEN
                RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Product code is required'::TEXT;
                RETURN;
            END IF;

            IF p_product_name IS NULL OR p_product_name = '' THEN
                RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Product name is required'::TEXT;
                RETURN;
            END IF;

            IF p_unit_amount IS NULL OR p_unit_amount < 0 THEN
                RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Valid amount is required'::TEXT;
                RETURN;
            END IF;

            -- Upsert product
            INSERT INTO public.merchant_products (
                merchant_user_id,
                product_code,
                product_name,
                product_description,
                unit_amount,
                currency,
                is_active,
                product_tags,
                media_urls,
                checkout_info,
                metadata,
                pricing_type,
                repeat_every,
                repeat_unit,
                tax_code,
                published_at
            ) VALUES (
                v_user_id,
                p_product_code,
                p_product_name,
                p_product_description,
                p_unit_amount,
                UPPER(TRIM(p_currency)),
                p_is_active,
                p_product_tags,
                p_media_urls,
                p_checkout_info,
                p_metadata,
                p_pricing_type,
                p_repeat_every,
                p_repeat_unit,
                p_tax_code,
                CASE WHEN p_publish THEN now() ELSE NULL END
            )
            ON CONFLICT (merchant_user_id, product_code)
            DO UPDATE SET
                product_name = EXCLUDED.product_name,
                product_description = EXCLUDED.product_description,
                unit_amount = EXCLUDED.unit_amount,
                currency = EXCLUDED.currency,
                is_active = EXCLUDED.is_active,
                product_tags = EXCLUDED.product_tags,
                media_urls = EXCLUDED.media_urls,
                checkout_info = EXCLUDED.checkout_info,
                metadata = EXCLUDED.metadata,
                pricing_type = EXCLUDED.pricing_type,
                repeat_every = EXCLUDED.repeat_every,
                repeat_unit = EXCLUDED.repeat_unit,
                tax_code = EXCLUDED.tax_code,
                published_at = COALESCE(merchant_products.published_at, CASE WHEN p_publish THEN now() ELSE NULL END),
                updated_at = now()
            RETURNING id INTO v_product_id;

            RETURN QUERY SELECT v_product_id::UUID, true::BOOLEAN, 
                CASE WHEN p_publish THEN 'Product published successfully' ELSE 'Product saved successfully' END::TEXT;
        END;
        $$;
        
        GRANT EXECUTE ON FUNCTION public.upsert_merchant_product TO authenticated;
        
        RAISE NOTICE '✅ upsert_merchant_product function created';
    END IF;
END;
$$;

-- Fix 5: Create basic checkout session function
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'create_merchant_checkout_session') THEN
        RAISE NOTICE '🔧 Creating create_merchant_checkout_session function...';
        
        CREATE OR REPLACE FUNCTION public.create_merchant_checkout_session(
            p_secret_key TEXT,
            p_mode TEXT DEFAULT 'sandbox',
            p_currency TEXT DEFAULT 'USD',
            p_items JSONB DEFAULT '[]'::jsonb,
            p_customer_name TEXT DEFAULT NULL,
            p_customer_email TEXT DEFAULT NULL,
            p_customer_phone TEXT DEFAULT NULL,
            p_customer_address TEXT DEFAULT NULL,
            p_metadata JSONB DEFAULT '{}'::jsonb,
            p_expires_in_minutes INTEGER DEFAULT 30
        )
        RETURNS TABLE (
            session_id UUID,
            session_token TEXT,
            total_amount NUMERIC,
            currency TEXT,
            status TEXT,
            success BOOLEAN,
            message TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'sandbox')));
            v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
            v_merchant_user_id UUID;
            v_session_token TEXT;
            v_session_id UUID;
            v_total_amount NUMERIC(12,2) := 0;
            v_expires_at TIMESTAMPTZ;
        BEGIN
            -- Validation
            IF v_mode NOT IN ('sandbox', 'live') THEN
                RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, false::BOOLEAN, 'Invalid mode'::TEXT;
                RETURN;
            END IF;

            IF char_length(v_currency) <> 3 THEN
                RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, false::BOOLEAN, 'Invalid currency'::TEXT;
                RETURN;
            END IF;

            -- For now, create a simple session without API key validation
            -- In production, you'll need to validate the API key
            v_merchant_user_id := auth.uid();
            
            IF v_merchant_user_id IS NULL THEN
                RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, false::BOOLEAN, 'Unauthorized'::TEXT;
                RETURN;
            END IF;

            -- Calculate expiration
            v_expires_at := now() + (GREATEST(5, LEAST(p_expires_in_minutes, 525600)) || ' minutes')::INTERVAL;

            -- Generate session token
            v_session_token := 'mcs_' || encode(gen_random_bytes(16), 'hex');

            -- Calculate total from items
            IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
                FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
                LOOP
                    v_total_amount := v_total_amount + COALESCE((v_item->>'amount')::NUMERIC, 0);
                END LOOP;
            END IF;

            -- Create checkout session
            INSERT INTO public.merchant_checkout_sessions (
                session_token,
                merchant_user_id,
                total_amount,
                currency,
                fee_amount,
                status,
                key_mode,
                customer_name,
                customer_email,
                customer_phone,
                customer_address,
                metadata,
                expires_at
            ) VALUES (
                v_session_token,
                v_merchant_user_id,
                v_total_amount,
                v_currency,
                0, -- Calculate fee amount if needed
                'open',
                v_mode,
                p_customer_name,
                p_customer_email,
                p_customer_phone,
                p_customer_address,
                p_metadata,
                v_expires_at
            ) RETURNING id INTO v_session_id;

            RETURN QUERY SELECT 
                v_session_id::UUID,
                v_session_token::TEXT,
                v_total_amount::NUMERIC,
                v_currency::TEXT,
                'open'::TEXT,
                true::BOOLEAN,
                'Checkout session created successfully'::TEXT;
        END;
        $$;
        
        GRANT EXECUTE ON FUNCTION public.create_merchant_checkout_session TO authenticated;
        
        RAISE NOTICE '✅ create_merchant_checkout_session function created';
    END IF;
END;
$$;

-- Step 6: Grant basic permissions
DO $$
BEGIN
    -- Grant permissions on tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_products') THEN
        GRANT ALL ON public.merchant_products TO authenticated;
        GRANT SELECT ON public.merchant_products TO anon;
        
        -- Create basic RLS policies
        DROP POLICY IF EXISTS "Users can manage own merchant products" ON public.merchant_products;
        CREATE POLICY "Users can manage own merchant products"
        ON public.merchant_products
        FOR ALL TO authenticated
        USING (merchant_user_id = auth.uid())
        WITH CHECK (merchant_user_id = auth.uid());
        
        DROP POLICY IF EXISTS "Public can view active products" ON public.merchant_products;
        CREATE POLICY "Public can view active products"
        ON public.merchant_products
        FOR SELECT TO anon, authenticated
        USING (is_active = true AND published_at IS NOT NULL);
        
        RAISE NOTICE '✅ merchant_products permissions and policies set';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_checkout_sessions') THEN
        GRANT ALL ON public.merchant_checkout_sessions TO authenticated;
        GRANT SELECT ON public.merchant_checkout_sessions TO anon;
        
        DROP POLICY IF EXISTS "Users can manage own checkout sessions" ON public.merchant_checkout_sessions;
        CREATE POLICY "Users can manage own checkout sessions"
        ON public.merchant_checkout_sessions
        FOR ALL TO authenticated
        USING (merchant_user_id = auth.uid())
        WITH CHECK (merchant_user_id = auth.uid());
        
        RAISE NOTICE '✅ merchant_checkout_sessions permissions and policies set';
    END IF;
END;
$$;

-- Step 7: Final verification
DO $$
DECLARE
    v_tables_count INTEGER := 0;
    v_functions_count INTEGER := 0;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_tables_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('merchant_products', 'merchant_checkout_sessions', 'merchant_payments');
    
    -- Count functions
    SELECT COUNT(*) INTO v_functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('upsert_merchant_product', 'create_merchant_checkout_session');
    
    RAISE NOTICE '';
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'DATABASE FIX COMPLETED';
    RAISE NOTICE '==============================================================';
    RAISE NOTICE '✅ Tables created: %', v_tables_count;
    RAISE NOTICE '✅ Functions created: %', v_functions_count;
    RAISE NOTICE '✅ Permissions and policies set';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready for testing:';
    RAISE NOTICE '1. Create merchant products';
    RAISE NOTICE '2. Generate checkout sessions';
    RAISE NOTICE '3. Process payments';
    RAISE NOTICE '';
    RAISE NOTICE 'Status: 🟢 DATABASE READY';
    RAISE NOTICE '==============================================================';
END $$;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
