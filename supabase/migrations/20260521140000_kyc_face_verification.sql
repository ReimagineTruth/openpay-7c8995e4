-- KYC face verification / liveness fields
ALTER TABLE kyc_applications
  ADD COLUMN IF NOT EXISTS liveness_passed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS liveness_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS face_verification_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS selfie_captured_at TIMESTAMPTZ;

COMMENT ON COLUMN kyc_applications.liveness_passed IS 'Client completed live face capture + liveness challenge';
COMMENT ON COLUMN kyc_applications.liveness_score IS '0-100 liveness confidence from client checks';
COMMENT ON COLUMN kyc_applications.face_verification_metadata IS 'Challenge steps, device info, face detection summary';

-- Sync profile on insert (pending) as well as update
CREATE OR REPLACE FUNCTION update_user_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET
        kyc_status = NEW.status,
        kyc_verified_at = CASE
            WHEN NEW.status = 'approved' THEN COALESCE(NEW.reviewed_at, NOW())
            ELSE profiles.kyc_verified_at
        END
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_kyc_status_trigger ON kyc_applications;
CREATE TRIGGER update_user_kyc_status_trigger
    AFTER INSERT OR UPDATE ON kyc_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_user_kyc_status();
