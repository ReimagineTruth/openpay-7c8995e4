import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ReceiptText, User, Mail, Phone, Calendar, DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { PI_TO_USD, useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AuthMark from "@/components/AuthMark";

const db = supabase as any;

type PosSessionPublic = {
  session_id: string;
  currency: string;
  amount: number;
  merchant_name: string;
  merchant_username: string;
};

type CustomerDetails = {
  user_id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

type PosPaymentDetails = {
  payment_id: string;
  transaction_id: string;
  customer_details: CustomerDetails | null;
  created_at: string;
  status: string;
};

const PosThankYouPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currencies } = useCurrency();

  const sessionToken = searchParams.get("session") || "";
  const initialTx = searchParams.get("tx") || "";
  const origin = (searchParams.get("origin") || "").trim().toLowerCase();
  const isMerchantOrigin = origin === "merchant-pos";

  const [loading, setLoading] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [transactionId, setTransactionId] = useState(initialTx);
  const [sessionData, setSessionData] = useState<PosSessionPublic | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PosPaymentDetails | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!sessionToken) return;
      setLoading(true);
      try {
        // Load session data
        const { data } = await db.rpc("get_public_merchant_checkout_session", { p_session_token: sessionToken });
        const row = Array.isArray(data) ? data[0] : data;
        const resolvedSessionId = row ? String(row.session_id || "") : "";
        if (row) {
          setSessionData({
            session_id: String(row.session_id || ""),
            currency: String(row.currency || "USD"),
            amount: Number(row.amount || 0),
            merchant_name: String(row.merchant_name || "OpenPay Merchant"),
            merchant_username: String(row.merchant_username || ""),
          });
        }

        if (resolvedSessionId) {
          const { data: paymentRow } = await db
            .from("merchant_payments")
            .select("id, transaction_id, buyer_user_id, created_at, status, amount, currency")
            .eq("session_id", resolvedSessionId)
            .maybeSingle();

          let buyerProfile: { full_name: string; username: string | null; avatar_url: string | null } | null = null;
          if (paymentRow?.buyer_user_id) {
            const { data: profileRow } = await db
              .from("profiles")
              .select("full_name, username, avatar_url")
              .eq("id", paymentRow.buyer_user_id)
              .maybeSingle();
            if (profileRow) {
              buyerProfile = {
                full_name: String(profileRow.full_name || "Customer"),
                username: profileRow.username ? String(profileRow.username) : null,
                avatar_url: profileRow.avatar_url ? String(profileRow.avatar_url) : null,
              };
            }
          }

          let privateCustomer: { customer_name: string | null; customer_email: string | null; metadata: any } | null = null;
          if (isMerchantOrigin) {
            const { data: privateSession } = await db
              .from("merchant_checkout_sessions")
              .select("customer_name, customer_email, metadata")
              .eq("id", resolvedSessionId)
              .maybeSingle();
            if (privateSession) {
              privateCustomer = {
                customer_name: privateSession.customer_name ? String(privateSession.customer_name) : null,
                customer_email: privateSession.customer_email ? String(privateSession.customer_email) : null,
                metadata: (privateSession as any).metadata ?? null,
              };
            }
          }

          if (paymentRow) {
            const customerName = privateCustomer?.customer_name || buyerProfile?.full_name || "Customer";
            const customerEmail = privateCustomer?.customer_email || null;
            const customerPhone =
              privateCustomer?.metadata && typeof privateCustomer.metadata === "object"
                ? String((privateCustomer.metadata as any).customer_phone || "") || null
                : null;

            setPaymentDetails({
              payment_id: String(paymentRow.id),
              transaction_id: paymentRow.transaction_id ? String(paymentRow.transaction_id) : "",
              created_at: String(paymentRow.created_at),
              status: String(paymentRow.status || "succeeded"),
              customer_details: paymentRow.buyer_user_id
                ? {
                    user_id: String(paymentRow.buyer_user_id),
                    full_name: customerName,
                    username: buyerProfile?.username ?? null,
                    email: customerEmail,
                    phone: customerPhone,
                    avatar_url: buyerProfile?.avatar_url ?? null,
                  }
                : null,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load POS session:", error);
        toast.error("Failed to load payment details");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [sessionToken]);

  useEffect(() => {
    const loadTx = async () => {
      if (transactionId || !sessionData?.session_id) return;
      
      // Use payment details if available
      if (paymentDetails?.transaction_id) {
        setTransactionId(String(paymentDetails.transaction_id));
        return;
      }
      
      // Fallback to merchant payments query
      const { data } = await db
        .from("merchant_payments")
        .select("transaction_id")
        .eq("session_id", sessionData.session_id)
        .maybeSingle();
      if (data?.transaction_id) {
        setTransactionId(String(data.transaction_id));
      }
    };
    void loadTx();
  }, [sessionData?.session_id, transactionId, paymentDetails]);

  const amountInUsd = useMemo(() => {
    if (!sessionData) return 0;
    const rate = currencies.find((c) => c.code === sessionData.currency)?.rate ?? 1;
    if (!rate) return 0;
    return (Number(sessionData.amount || 0) / rate) * PI_TO_USD;
  }, [currencies, sessionData]);

  useEffect(() => {
    if (!sessionData || !transactionId) return;
    setReceiptData({
      transactionId,
      ledgerTransactionId: transactionId,
      type: "send",
      amount: amountInUsd,
      otherPartyName: sessionData.merchant_name,
      otherPartyUsername: sessionData.merchant_username || undefined,
      note: `POS payment session: ${sessionData.session_id}`,
      date: new Date(),
    });
  }, [amountInUsd, sessionData, transactionId]);

  if (loading)     return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
          <p className="mt-4 text-muted-foreground">Loading POS confirmation...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-xl space-y-4">
        {/* Success Header */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            <h1 className="text-2xl font-semibold text-foreground">POS Payment Completed</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Thank you for your purchase! Your POS payment was processed successfully.</p>

          {!!transactionId && (
            <p className="mt-4 text-xs text-muted-foreground">
              Transaction ID: <span className="font-mono text-foreground">{transactionId}</span>
            </p>
          )}
        </div>

        {/* Customer Details */}
        {paymentDetails?.customer_details && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {paymentDetails.customer_details.avatar_url ? (
                  <img 
                    src={paymentDetails.customer_details.avatar_url} 
                    alt={paymentDetails.customer_details.full_name}
                    className="h-12 w-12 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-paypal-dark flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {paymentDetails.customer_details.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">{paymentDetails.customer_details.full_name}</p>
                  {paymentDetails.customer_details.username && (
                    <p className="text-sm text-muted-foreground">@{paymentDetails.customer_details.username}</p>
                  )}
                </div>
              </div>
              
              {paymentDetails.customer_details.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{paymentDetails.customer_details.email}</span>
                </div>
              )}
              
              {paymentDetails.customer_details.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{paymentDetails.customer_details.phone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Details */}
        {sessionData && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Details
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">
                  {sessionData.currency} {Number(sessionData.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Merchant</span>
                <span className="font-medium text-foreground">{sessionData.merchant_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">
                  {paymentDetails?.created_at ? new Date(paymentDetails.created_at).toLocaleDateString() : new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="font-medium text-emerald-600">Completed</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 rounded-lg" onClick={() => setReceiptOpen(true)} disabled={!receiptData}>
            <ReceiptText className="mr-2 h-4 w-4" />
            View receipt
          </Button>
          <Button
            className="h-10 rounded-lg bg-paypal-blue text-white hover:bg-[#004dc5]"
            onClick={() => navigate(isMerchantOrigin ? "/merchant-pos" : "/dashboard")}
          >
            {isMerchantOrigin ? "Back to POS" : "Back to Home"}
          </Button>
          <Button variant="ghost" className="h-10 rounded-lg" onClick={() => navigate("/activity")}>
            Activity
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">Powered by OpenPay</p>
      </div>
      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />
    </div>
  );
};

export default PosThankYouPage;
