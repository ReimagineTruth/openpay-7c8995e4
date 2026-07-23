import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signInWithGoogle } from "@/lib/googleAuth";

/**
 * Legacy Lovable Cloud Auth sent users to `/~oauth/initiate` or `/.lovable/oauth/initiate`.
 * That broker exists only on Lovable hosting — on openpy.space it 404'd.
 * Forward Google requests to Supabase OAuth instead.
 */
const LegacyLovableOAuthInitiatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const provider = (searchParams.get("provider") || "google").toLowerCase();

      if (provider !== "google") {
        toast.error(`Sign in with ${provider} is not available. Use Google or email instead.`);
        navigate("/sign-in", { replace: true });
        return;
      }

      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || "Google sign-in failed");
        navigate("/sign-in", { replace: true });
      }
    };

    void run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] flex items-center justify-center px-6">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
        <p className="text-white">Redirecting to Google sign-in…</p>
      </div>
    </div>
  );
};

export default LegacyLovableOAuthInitiatePage;
