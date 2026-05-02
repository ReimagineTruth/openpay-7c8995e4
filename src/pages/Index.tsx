import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AuthMark from "@/components/AuthMark";

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(resolve, 900)),
    ]).then(([{ data: { session } }]) => {
      if (session) {
        navigate("/dashboard");
      } else {
        navigate("/auth");
      }
      setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-paypal-blue via-blue-600 to-[#072a7a] flex items-center justify-center px-6 relative overflow-hidden">
        <div className="text-center">
          <AuthMark className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Loading...</p>
          <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  return null;
};

export default Index;
