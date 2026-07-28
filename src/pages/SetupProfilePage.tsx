import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AuthMark from "@/components/AuthMark";

const WelcomePage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate("/auth", { replace: true });
    });
  }, [navigate]);

  const handleContinue = () => {
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm text-center">
        <AuthMark className="mx-auto mb-6 h-16 w-16" />
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Welcome to OpenPay 👋
        </h1>
        <p className="mt-3 text-base text-white/85">
          Start using the app instantly.
        </p>

        <div className="paypal-surface mt-8 rounded-3xl p-6 text-left">
          <p className="text-sm text-muted-foreground">
            We only collect the data necessary to provide our service. You can
            add your name, username, or profile picture later from Profile
            Settings — all fields are optional.
          </p>

          <Button
            onClick={handleContinue}
            className="mt-5 h-12 w-full rounded-2xl bg-paypal-blue text-white text-base font-semibold hover:bg-[#004dc5]"
          >
            Continue
          </Button>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="mt-3 w-full text-sm font-medium text-paypal-blue"
          >
            Set up profile later
          </button>
        </div>

        <p className="mt-6 text-xs text-white/70">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;
