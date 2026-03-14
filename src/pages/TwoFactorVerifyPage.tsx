import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AuthMark from "@/components/AuthMark";

const TwoFactorVerifyPage = () => {
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get return destination from navigation state
  const returnTo = (location.state as any)?.returnTo || "/dashboard";

  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    
    setLoading(true);
    
    try {
      // Simple validation for now - in production use proper TOTP verification
      const isValid = /^\d{6}$/.test(twoFactorCode);
      
      if (isValid) {
        // Complete the authentication process
        toast.success("2FA verification successful");
        navigate(returnTo, { replace: true });
      } else {
        toast.error("Invalid 2FA code. Please try again.");
      }
    } catch (error) {
      toast.error("2FA verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-8 text-center">
          <AuthMark className="mx-auto mb-5 h-32 w-32" />
          <p className="mb-1 text-2xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="text-sm font-medium text-white/85">Two-Factor Authentication</p>
        </div>
        
        <div className="paypal-surface w-full rounded-3xl p-7 shadow-2xl shadow-black/15">
          <div className="text-center mb-8">
            <Shield className="h-12 w-12 text-paypal-blue mx-auto mb-4" />
            <h1 className="paypal-heading mb-2">Enter Authentication Code</h1>
            <p className="text-sm text-gray-600">
              Open your authenticator app and enter the 6-digit code
            </p>
          </div>
          
          <form onSubmit={handle2FAVerification} className="space-y-6">
            <div className="flex justify-center gap-2 mb-8">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className="w-12 h-14 border-2 border-gray-300 rounded-lg flex items-center justify-center bg-white"
                >
                  <span className="text-2xl font-mono text-gray-800">
                    {twoFactorCode[index] || ''}
                  </span>
                </div>
              ))}
            </div>
            
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
              className="sr-only"
              autoFocus
            />
            
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-2xl bg-paypal-blue text-primary-foreground text-base font-semibold hover:bg-[#004dc5]">
              {loading ? "Verifying..." : "Verify Code"}
            </Button>
            
            <Button
              type="button"
              onClick={handleBack}
              variant="outline"
              className="w-full h-12 rounded-2xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Lost access to your authenticator?{" "}
              <button
                onClick={() => navigate("/two-factor")}
                className="text-paypal-blue font-medium hover:underline"
              >
                Use backup codes
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerifyPage;
