import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type TopUpRow = {
  amount_usd: number;
  status: string;
  credited_at: string | null;
};

const TopUpStripeReturnPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [row, setRow] = useState<TopUpRow | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        const { data } = await supabase
          .from("stripe_topups")
          .select("amount_usd, status, credited_at")
          .eq("stripe_session_id", sessionId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setRow(data as TopUpRow);
          if (data.status === "completed") return;
        }
        setAttempts(i + 1);
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const completed = row?.status === "completed";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center shadow-sm">
        {completed ? (
          <>
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-3" />
            <h1 className="text-2xl font-semibold mb-1">Top-up successful</h1>
            <p className="text-muted-foreground mb-4">
              ${Number(row?.amount_usd ?? 0).toFixed(2)} OUSD has been credited to your wallet.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-14 w-14 text-primary mx-auto mb-3 animate-spin" />
            <h1 className="text-2xl font-semibold mb-1">Confirming payment…</h1>
            <p className="text-muted-foreground mb-4">
              We're crediting your OUSD wallet. This usually takes a few seconds.
              {attempts >= 20 && (
                <span className="block mt-2 text-xs">
                  Still processing — refresh in a moment or check your top-up history.
                </span>
              )}
            </p>
          </>
        )}
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link to="/">
              Back to wallet <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/topup/history">View top-up history</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TopUpStripeReturnPage;
