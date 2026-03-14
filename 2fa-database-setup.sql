-- 2FA Database Setup for OpenPay
-- This SQL adds support for Two-Factor Authentication

-- Add 2FA settings to user profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS backup_codes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS two_factor_setup_at TIMESTAMP WITH TIME ZONE;

-- Create 2FA backup codes usage tracking table
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for backup codes table
CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_user_id ON two_factor_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_backup_codes_code_hash ON two_factor_backup_codes(code_hash);

-- Add 2FA verification attempts tracking (optional, for security)
CREATE TABLE IF NOT EXISTS two_factor_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    attempt_type TEXT NOT NULL CHECK (attempt_type IN ('setup', 'verify', 'disable')),
    success BOOLEAN NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for attempts table
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_id ON two_factor_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_created_at ON two_factor_attempts(created_at);

-- Function to generate backup codes
CREATE OR REPLACE FUNCTION generate_backup_codes(user_id_param UUID)
RETURNS TEXT[] AS $$
DECLARE
    backup_codes TEXT[] := '{}';
    code TEXT;
BEGIN
    -- Generate 10 backup codes
    FOR i IN 1..10 LOOP
        code := LPAD(floor(random() * 1000000)::TEXT, 6, '0');
        backup_codes := array_append(backup_codes, code);
        
        -- Store hashed version in backup_codes table
        INSERT INTO two_factor_backup_codes (user_id, code_hash)
        VALUES (user_id_param, crypt(code, gen_salt('bf')));
    END LOOP;
    
    RETURN backup_codes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify backup code
CREATE OR REPLACE FUNCTION verify_backup_code(user_id_param UUID, code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    code_count INTEGER;
BEGIN
    -- Check if code exists and hasn't been used
    SELECT COUNT(*) INTO code_count
    FROM two_factor_backup_codes 
    WHERE user_id = user_id_param 
    AND code_hash = crypt(code, code_hash)
    AND used_at IS NULL;
    
    IF code_count > 0 THEN
        -- Mark code as used
        UPDATE two_factor_backup_codes 
        SET used_at = NOW()
        WHERE user_id = user_id_param 
        AND code_hash = crypt(code, code_hash)
        AND used_at IS NULL;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE two_factor_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies for backup codes
CREATE POLICY "Users can view their own backup codes" ON two_factor_backup_codes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backup codes" ON two_factor_backup_codes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for attempts
CREATE POLICY "Users can view their own attempts" ON two_factor_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts" ON two_factor_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON two_factor_backup_codes TO authenticated;
GRANT ALL ON two_factor_attempts TO authenticated;

-- Comments
COMMENT ON COLUMN profiles.two_factor_enabled IS 'Whether user has 2FA enabled';
COMMENT ON COLUMN profiles.two_factor_secret IS 'Secret key for TOTP (encrypted)';
COMMENT ON COLUMN profiles.backup_codes IS 'Backup codes for 2FA recovery';
COMMENT ON COLUMN profiles.two_factor_setup_at IS 'When 2FA was first set up';
COMMENT ON TABLE two_factor_backup_codes IS 'Tracks usage of 2FA backup codes';
COMMENT ON TABLE two_factor_attempts IS 'Tracks 2FA verification attempts for security';
