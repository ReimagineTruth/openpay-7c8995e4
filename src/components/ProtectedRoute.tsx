import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BrandLogo from "@/components/BrandLogo";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const ProtectedRoute = ({ children, redirectTo = "/sign-in" }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          console.log('User not authenticated, redirecting to:', redirectTo);
          navigate(redirectTo, {
            replace: true,
            state: { from: location.pathname }
          });
          return;
        }

        // Require onboarding: real full_name + username before app access.
        if (location.pathname !== "/setup-profile") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", user.id)
            .maybeSingle();

          const fullName = (profile?.full_name || "").trim();
          const username = (profile?.username || "").trim();
          const needsSetup =
            !fullName ||
            !username ||
            username.toLowerCase().startsWith("pi_") ||
            !/^[a-z0-9_]{3,20}$/i.test(username);

          if (needsSetup) {
            navigate("/setup-profile", { replace: true });
            return;
          }
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check error:', error);
        navigate(redirectTo, {
          replace: true,
          state: { from: location.pathname }
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location.pathname, redirectTo]);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="nft-on-media theme-fixed fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
        <div className="text-center">
          <img src="/openpay-o-white.svg" alt="OpenPay" className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Loading...</p>
          <p className="mt-1 text-xs font-medium tracking-normal text-white/65">Powered by Pi Network</p>
          <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
