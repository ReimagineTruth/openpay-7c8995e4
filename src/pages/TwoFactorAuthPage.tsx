import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Shield, Smartphone, Key, Copy, Check, X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import AuthMark from "@/components/AuthMark";
import BottomNav from "@/components/BottomNav";

const TwoFactorAuthPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSetup, setIsSetup] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    checkCurrent2FAStatus();
  }, []);

  const checkCurrent2FAStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if user has 2FA enabled (you'd need to add this to user metadata)
        const has2FA = user.user_metadata?.two_factor_enabled || false;
        setIsSetup(has2FA);
        setIsVerified(has2FA);
        
        if (has2FA) {
          // Load backup codes
          await loadBackupCodes();
        }
      }
    } catch (error) {
      console.error("Error checking 2FA status:", error);
    }
  };

  const generateSecretKey = async () => {
    setLoading(true);
    try {
      // Generate a secret key for TOTP
      const secret = generateTOTPSecret();
      setSecretKey(secret);
      
      // Generate QR code
      const { data: { user } } = await supabase.auth.getUser();
      const issuer = "OpenPay";
      const accountName = user?.email || "OpenPay User";
      const qrCodeUrl = generateQRCode(secret, issuer, accountName);
      setQrCode(qrCodeUrl);
      
      setLoading(false);
    } catch (error) {
      console.error("Error generating 2FA:", error);
      toast.error("Failed to generate 2FA setup");
      setLoading(false);
    }
  };

  const generateTOTPSecret = (): string => {
    // Generate a random base32 secret
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  };

  const generateQRCode = (secret: string, issuer: string, accountName: string): string => {
    // This would generate a QR code URL
    // In production, you'd use a library like qrcode
    const otpauth = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}`;
    return otpauth; // This would be converted to actual QR code image
  };

  const verifyTOTP = (token: string, secret: string): boolean => {
    // Verify TOTP token (simplified - in production use proper TOTP library)
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    const expectedToken = generateTOTPToken(secret, timeStep);
    return token === expectedToken;
  };

  const generateTOTPToken = (secret: string, timeStep: number): string => {
    // Simplified TOTP generation (use proper crypto library in production)
    const hash = simpleHash(secret + timeStep);
    return (hash % 1000000).toString().padStart(6, '0');
  };

  const simpleHash = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  const setup2FA = async () => {
    if (!verificationCode) {
      toast.error("Please enter verification code");
      return;
    }

    setLoading(true);
    try {
      const isValid = verifyTOTP(verificationCode, secretKey);
      
      if (isValid) {
        // Save 2FA setup to user metadata
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.auth.updateUser({
            data: {
              two_factor_enabled: true,
              two_factor_secret: secretKey
            }
          });
          
          // Generate backup codes
          const codes = generateBackupCodes();
          setBackupCodes(codes);
          
          setIsSetup(true);
          setIsVerified(true);
          toast.success("2FA setup successfully! Save your backup codes.");
        }
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      toast.error("Failed to setup 2FA");
    } finally {
      setLoading(false);
    }
  };

  const generateBackupCodes = (): string[] => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  };

  const loadBackupCodes = async () => {
    // Load backup codes from user metadata or secure storage
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.backup_codes) {
      setBackupCodes(user.user_metadata.backup_codes);
    }
  };

  const disable2FA = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({
          data: {
            two_factor_enabled: false,
            two_factor_secret: null,
            backup_codes: null
          }
        });
        
        setIsSetup(false);
        setIsVerified(false);
        setQrCode("");
        setSecretKey("");
        setBackupCodes([]);
        toast.success("2FA has been disabled");
      }
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      toast.error("Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-white hover:text-white/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <AuthMark className="h-8 w-8" />
          <div className="w-5" />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-6 w-6 text-paypal-blue" />
            <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
          </div>

          {!isSetup ? (
            // Setup 2FA
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Add an extra layer of security to your account with Google Authenticator
                </p>
                
                {!qrCode ? (
                  <Button
                    onClick={generateSecretKey}
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-paypal-blue text-white font-semibold"
                  >
                    {loading ? "Generating..." : "Setup 2FA"}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">Scan QR Code</p>
                      <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded-lg mx-auto flex items-center justify-center">
                        <Smartphone className="h-12 w-12 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Open Google Authenticator and scan this QR code
                      </p>
                    </div>

                    <div className="bg-gray-100 p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">Or Enter Manually</p>
                      <div className="flex items-center gap-2">
                        <Input
                          value={secretKey}
                          readOnly
                          className="flex-1 font-mono text-sm"
                        />
                        <Button
                          onClick={() => copyToClipboard(secretKey)}
                          variant="outline"
                          size="sm"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">Verify Setup</p>
                      <Input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        maxLength={6}
                        className="text-center text-lg font-mono"
                      />
                      <Button
                        onClick={setup2FA}
                        disabled={loading || verificationCode.length !== 6}
                        className="w-full h-12 rounded-2xl bg-paypal-blue text-white font-semibold"
                      >
                        {loading ? "Verifying..." : "Enable 2FA"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 2FA Already Setup
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">2FA is enabled</span>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-3">Backup Codes</p>
                <p className="text-xs text-gray-600 mb-3">
                  Save these backup codes in a secure place. You can use them to access your account if you lose your phone.
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="bg-white p-2 rounded border text-xs font-mono">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={disable2FA}
                disabled={loading}
                variant="outline"
                className="w-full h-12 rounded-2xl text-red-600 border-red-300 hover:bg-red-50"
              >
                {loading ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorAuthPage;
