-- Create remittance merchant tables
-- This migration adds complete merchant remittance functionality

-- Merchant stores table
CREATE TABLE IF NOT EXISTS remittance_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_description TEXT,
  business_type TEXT NOT NULL, -- 'bank', 'money_transfer', 'pawnshop', 'convenience_store', etc.
  license_number TEXT,
  license_expiry DATE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  verification_documents TEXT[], -- array of document URLs
  operating_hours JSONB, -- store operating hours
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchant fee settings table
CREATE TABLE IF NOT EXISTS remittance_merchant_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES remittance_merchants(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'cash_in', 'cash_out', 'transfer'
  fee_type TEXT NOT NULL, -- 'percentage', 'fixed', 'tiered'
  fee_value DECIMAL(10,4) NOT NULL, -- percentage rate or fixed amount
  min_fee DECIMAL(10,2), -- minimum fee for percentage fees
  max_fee DECIMAL(10,2), -- maximum fee for percentage fees
  currency_code TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchant transactions table
CREATE TABLE IF NOT EXISTS remittance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES remittance_merchants(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'cash_in', 'cash_out', 'transfer'
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_id TEXT, -- for customer identification
  amount DECIMAL(12,2) NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  fee_amount DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL, -- amount after fees
  exchange_rate DECIMAL(12,6),
  target_currency TEXT,
  target_amount DECIMAL(12,2),
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_bank TEXT,
  recipient_account TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  reference_number TEXT UNIQUE,
  qr_code_data TEXT, -- QR code content
  notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchant revenue tracking table
CREATE TABLE IF NOT EXISTS remittance_merchant_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES remittance_merchants(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES remittance_transactions(id) ON DELETE CASCADE,
  revenue_type TEXT NOT NULL, -- 'fee', 'commission', 'bonus'
  amount DECIMAL(10,2) NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchant cash management table
CREATE TABLE IF NOT EXISTS remittance_merchant_cash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES remittance_merchants(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'cash_in', 'cash_out'
  amount DECIMAL(12,2) NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_remittance_merchants_user_id ON remittance_merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_remittance_merchants_country ON remittance_merchants(country);
CREATE INDEX IF NOT EXISTS idx_remittance_merchants_is_active ON remittance_merchants(is_active);
CREATE INDEX IF NOT EXISTS idx_remittance_transactions_merchant_id ON remittance_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_remittance_transactions_status ON remittance_transactions(status);
CREATE INDEX IF NOT EXISTS idx_remittance_transactions_created_at ON remittance_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_remittance_transactions_reference ON remittance_transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_remittance_merchant_fees_merchant_id ON remittance_merchant_fees(merchant_id);
CREATE INDEX IF NOT EXISTS idx_remittance_merchant_revenue_merchant_id ON remittance_merchant_revenue(merchant_id);
CREATE INDEX IF NOT EXISTS idx_remittance_merchant_cash_merchant_id ON remittance_merchant_cash(merchant_id);

-- Enable RLS (Row Level Security)
ALTER TABLE remittance_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_merchant_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_merchant_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_merchant_cash ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Merchants can only see their own data
CREATE POLICY "Users can view their own merchants" ON remittance_merchants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own merchants" ON remittance_merchants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own merchants" ON remittance_merchants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own merchants" ON remittance_merchants
  FOR DELETE USING (auth.uid() = user_id);

-- Fee policies
CREATE POLICY "Users can view their own merchant fees" ON remittance_merchant_fees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_merchant_fees.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own merchant fees" ON remittance_merchant_fees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_merchant_fees.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

-- Transaction policies
CREATE POLICY "Users can view their own merchant transactions" ON remittance_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_transactions.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own merchant transactions" ON remittance_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_transactions.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own merchant transactions" ON remittance_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_transactions.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

-- Revenue policies
CREATE POLICY "Users can view their own merchant revenue" ON remittance_merchant_revenue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_merchant_revenue.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

-- Cash management policies
CREATE POLICY "Users can view their own merchant cash" ON remittance_merchant_cash
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_merchant_cash.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own merchant cash" ON remittance_merchant_cash
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM remittance_merchants 
      WHERE remittance_merchants.id = remittance_merchant_cash.merchant_id 
      AND remittance_merchants.user_id = auth.uid()
    )
  );

-- Functions for automatic calculations
CREATE OR REPLACE FUNCTION calculate_merchant_fee(
  p_merchant_id UUID,
  p_transaction_type TEXT,
  p_amount DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  fee_record RECORD;
  calculated_fee DECIMAL := 0;
BEGIN
  -- Get the merchant's fee configuration
  SELECT * INTO fee_record 
  FROM remittance_merchant_fees 
  WHERE merchant_id = p_merchant_id 
  AND transaction_type = p_transaction_type 
  AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Default fee if no configuration found
    RETURN p_amount * 0.015; -- 1.5% default
  END IF;
  
  -- Calculate fee based on fee type
  IF fee_record.fee_type = 'percentage' THEN
    calculated_fee := p_amount * fee_record.fee_value / 100;
    
    -- Apply min/max limits
    IF fee_record.min_fee IS NOT NULL AND calculated_fee < fee_record.min_fee THEN
      calculated_fee := fee_record.min_fee;
    END IF;
    
    IF fee_record.max_fee IS NOT NULL AND calculated_fee > fee_record.max_fee THEN
      calculated_fee := fee_record.max_fee;
    END IF;
    
  ELSIF fee_record.fee_type = 'fixed' THEN
    calculated_fee := fee_record.fee_value;
    
  ELSE -- tiered (simplified for now)
    calculated_fee := p_amount * fee_record.fee_value / 100;
  END IF;
  
  RETURN calculated_fee;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate reference number
CREATE OR REPLACE FUNCTION generate_transaction_reference() RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'REM';
  timestamp_part TEXT := to_char(NOW(), 'YYYYMMDDHH24MISS');
  random_part TEXT := lpad(floor(random() * 10000)::TEXT, 4, '0');
BEGIN
  RETURN prefix || timestamp_part || random_part;
END;
$$ LANGUAGE plpgsql;

-- Function to update merchant revenue
CREATE OR REPLACE FUNCTION update_merchant_revenue(
  p_merchant_id UUID,
  p_transaction_id UUID,
  p_fee_amount DECIMAL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO remittance_merchant_revenue (
    merchant_id, 
    transaction_id, 
    revenue_type, 
    amount, 
    description
  ) VALUES (
    p_merchant_id,
    p_transaction_id,
    'fee',
    p_fee_amount,
    'Transaction fee revenue'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_remittance_merchants_updated_at
  BEFORE UPDATE ON remittance_merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_remittance_merchant_fees_updated_at
  BEFORE UPDATE ON remittance_merchant_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_remittance_transactions_updated_at
  BEFORE UPDATE ON remittance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
