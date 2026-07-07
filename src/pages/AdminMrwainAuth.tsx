import { useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import AuthMark from "@/components/AuthMark";
import AuthFooter from "@/components/AuthFooter";
import { ArrowLeft, Globe, BookOpen, Users, ChevronRight } from "lucide-react";
import { isPiBrowserUAOnly } from "@/lib/appSecurity";

const AdminMrwainAuth = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "signin";
  const referralParam = (params.get("ref") || "").trim().toLowerCase();

  // In Pi Browser, only Pi authentication is allowed — hide email sign in/up
  if (isPiBrowserUAOnly()) {
    const search = referralParam ? `?ref=${referralParam}` : "";
    return <Navigate to={`/auth${search}`} replace />;
  }
  const [loading, setLoading] = useState(false);
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [signupCode, setSignupCode] = useState("");

  const setMode = (nextMode: "signin" | "signup") => {
    const next: Record<string, string> = { mode: nextMode };
    if (referralParam) next.ref = referralParam;
    setParams(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("No internet connection. Please reconnect and try again.");
      return;
    }

    setLoading(true);

    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      
      // 2FA verification disabled for now - go directly to dashboard
      navigate("/dashboard");
      return;
    }

    if (password.length < 6) {
      setLoading(false);
      toast.error("Password must be at least 6 characters");
      return;
    }

    const userData: any = {
      full_name: fullName,
      username,
      ...(referralParam ? { referral_code: referralParam } : {}),
    };
    
    if (signupCode.trim()) {
      userData.signup_code = signupCode.trim().toUpperCase();
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created successfully!");
      setSignedUpEmail(email);
      setShowEmailConfirmationModal(true);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        toast.error(error.message || "Google sign-in failed");
        setLoading(false);
        return;
      }
    } catch (err: any) {
      toast.error(err?.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue via-[#0a3fa8] to-[#062468] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <AuthMark className="mx-auto mb-4 h-14 w-14" />
          <h1 className="text-2xl font-bold tracking-tight text-white">OpenPay</h1>
          <p className="mt-1 text-sm text-white/75">
            {mode === "signin" ? "Welcome back" : "Create your wallet"}
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/20 dark:bg-[#0f172a]">
          {/* Back to Pi link */}
          <Link
            to="/auth"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-paypal-blue hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Pi Authentication
          </Link>

          {/* Segmented tabs */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            <button
              onClick={() => setMode("signin")}
              className={`rounded-xl py-2 text-sm font-semibold transition ${mode === "signin" ? "bg-white text-paypal-blue shadow-sm" : "text-muted-foreground"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-xl py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-white text-paypal-blue shadow-sm" : "text-muted-foreground"}`}
            >
              Sign Up
            </button>
          </div>

          {/* Google button - primary shortcut */}
          <Button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            variant="outline"
            className="mb-4 h-12 w-full rounded-2xl border-border/60 bg-white text-base font-semibold gap-2 dark:bg-white/5"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground dark:bg-[#0f172a]">or continue with email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-12 rounded-2xl"
                />
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-12 rounded-2xl"
                />
                <Input
                  type="text"
                  placeholder="Friend Affiliate Code (Optional)"
                  value={signupCode}
                  onChange={(e) => setSignupCode(e.target.value)}
                  className="h-12 rounded-2xl"
                />
              </>
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-2xl"
            />
            <PasswordInput
              placeholder={mode === "signin" ? "Password" : "Password (min 6 characters)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-2xl"
            />
            {mode === "signin" && (
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="font-semibold text-paypal-blue hover:underline"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-mpin")}
                  className="font-semibold text-paypal-blue hover:underline"
                >
                  Forgot MPIN?
                </button>
              </div>
            )}
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-paypal-blue text-base font-semibold text-white shadow-md shadow-paypal-blue/30 hover:bg-[#004dc5]">
              {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {/* Resources */}
          <div className="mt-6">
            <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resources
            </p>
            <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-muted/30">
              <ResourceLink href="https://www.droplinkpi.space/@openpay" icon={<Users className="h-4 w-4" />} label="OpenPay Socials" />
              <ResourceLink href="https://www.openpy.space/" icon={<Globe className="h-4 w-4" />} label="OpenPay Website" />
              <ResourceLink href="https://www.openpy.space/blog" icon={<BookOpen className="h-4 w-4" />} label="OpenPay Blog" />
            </div>
          </div>

          <div className="mt-5 border-t border-border/60 pt-4">
            <AuthFooter />
          </div>
        </div>
      </div>


      {/* Email Confirmation Modal */}
      <Dialog open={showEmailConfirmationModal} onOpenChange={setShowEmailConfirmationModal}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold text-paypal-blue">
              Check Your Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Confirmation Email Sent!
              </h3>
              <p className="text-sm text-gray-600">
                We've sent a confirmation email to:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="font-mono text-sm text-gray-800 break-all">{signedUpEmail}</p>
              </div>
            </div>

            <div className="space-y-3 text-left bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 text-sm">Next Steps:</h4>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Check your inbox (and spam folder)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Open the "Confirm your email" message</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Click the confirmation link inside</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">4.</span>
                  <span>Return here to sign in</span>
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Didn't receive the email? Check your spam folder or
                <button 
                  onClick={() => setShowEmailConfirmationModal(false)}
                  className="text-paypal-blue hover:underline ml-1"
                >
                  try signing in
                </button>
              </p>
              <p className="text-xs text-gray-500">
                The confirmation link expires in 24 hours.
              </p>
            </div>

            <Button 
              onClick={() => {
                setShowEmailConfirmationModal(false);
                setMode("signin");
              }}
              className="w-full bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              Got it, I'll check my email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ResourceLink = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
  >
    <span className="flex items-center gap-3">
      <span className="text-paypal-blue">{icon}</span>
      {label}
    </span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </a>
);

export default AdminMrwainAuth;
