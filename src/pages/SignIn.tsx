import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import AuthMark from "@/components/AuthMark";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-8 text-center">
          <AuthMark className="mx-auto mb-5 h-32 w-32" />
          <p className="mb-1 text-2xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="text-sm font-medium text-white/85">Welcome back</p>
        </div>
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
      </div>
    </div>
  );
};

export default SignIn;
