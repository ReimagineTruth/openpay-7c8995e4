import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import AuthMark from "@/components/AuthMark";
import { Shield, ArrowLeft } from "lucide-react";
import { isPiBrowserUserAgent, isPiBrowserUAOnly } from "@/lib/appSecurity";
import { lovable } from "@/integrations/lovable";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [userSession, setUserSession] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isPiBrowserUAOnly()) navigate("/auth", { replace: true });
  }, [navigate]);


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
      return;
    }
    
    if (data.user) {
      // Debug logging
      console.log("User metadata:", data.user.user_metadata);
      
      // 2FA verification disabled - proceed directly to dashboard
      navigate("/dashboard");
    }
  };

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
        // Complete the sign-in process
        toast.success("2FA verification successful");
        navigate("/dashboard");
      } else {
        toast.error("Invalid 2FA code. Please try again.");
      }
    } catch (error) {
      toast.error("2FA verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    setShow2FA(false);
    setTwoFactorCode("");
    setUserSession(null);
    
    // Sign out the partial session
    if (userSession) {
      supabase.auth.signOut();
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-8 text-center">
          <AuthMark className="mx-auto mb-5 h-16 w-16" />
          <p className="mb-1 text-2xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="text-sm font-medium text-white/85">
            {show2FA ? "Two-Factor Authentication" : "Welcome back"}
          </p>
        </div>
        
        {!show2FA ? (
          // Regular Sign-In Form
          <div className="paypal-surface w-full rounded-3xl p-7 shadow-2xl shadow-black/15">
            <h1 className="paypal-heading mb-6 text-center">Log In</h1>
            <form onSubmit={handleSignIn} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-2xl border-white/70 bg-white"
              />
              <PasswordInput
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-2xl border-white/70 bg-white"
              />
              <Button type="submit" disabled={loading} className="w-full h-12 rounded-2xl bg-paypal-blue text-primary-foreground text-base font-semibold hover:bg-[#004dc5]">
                {loading ? "Signing in..." : "Log In"}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              variant="outline"
              className="w-full h-12 rounded-2xl border-white/70 bg-white text-base font-semibold gap-2"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continue with Google
            </Button>
            
            <p className="text-center mt-6 text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-paypal-blue font-semibold">Sign Up</Link>
            </p>
            
            <p className="mt-4 text-center text-xs text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="text-paypal-blue font-medium">Terms</Link>
              {" "}and{" "}
              <Link to="/privacy" className="text-paypal-blue font-medium">Privacy Policy</Link>.
            </p>
          </div>
        ) : (
          // 2FA Verification Form
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
              
              <Input
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
                onClick={handleBackToSignIn}
                variant="outline"
                className="w-full h-12 rounded-2xl"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Lost access to your authenticator?{" "}
                <Link to="/two-factor" className="text-paypal-blue font-medium">
                  Use backup codes
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignIn;
