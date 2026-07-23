import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          toast.error(`Authentication error: ${errorDescription || error}`);
          navigate("/sign-in", { replace: true });
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            toast.error(exchangeError.message || "Failed to complete Google sign-in");
            navigate("/sign-in", { replace: true });
            return;
          }
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        if (hashParams.get("access_token") || hashParams.get("error")) {
          const { error: hashError } = await supabase.auth.getSession();
          if (hashError) {
            toast.error(hashError.message || "Failed to complete sign-in");
            navigate("/sign-in", { replace: true });
            return;
          }
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          toast.error(sessionError.message || "Failed to get session");
          navigate("/sign-in", { replace: true });
          return;
        }

        if (sessionData.session) {
          toast.success("Successfully signed in!");
          window.history.replaceState({}, document.title, "/auth/callback");
          navigate("/dashboard", { replace: true });
          return;
        }

        toast.error("Authentication failed — no session found");
        navigate("/sign-in", { replace: true });
      } catch (err) {
        console.error("Auth callback error:", err);
        toast.error("An unexpected error occurred during authentication");
        navigate("/sign-in", { replace: true });
      }
    };

    void handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
        <p className="text-white">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
