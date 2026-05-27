import { useCallback } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  amountUsd: number;
  returnUrl: string;
}

export function StripeTopUpCheckout({ amountUsd, returnUrl }: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-topup-checkout", {
      body: { amountUsd, returnUrl, environment: getStripeEnvironment() },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || data?.error || "Failed to start checkout");
    }
    return data.clientSecret as string;
  }, [amountUsd, returnUrl]);

  return (
    <div id="stripe-checkout" className="rounded-xl overflow-hidden border bg-card">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
