import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import {
  classifyProDestination,
  formatProDestinationPreview,
  getProDestinationError,
  makeProXferRef,
  normalizeProDestination,
  OPENPAY_PRO_PARTNER_USERNAME,
} from "@/lib/openpayProTransfer";
import { useThankYouModal } from "@/contexts/ThankYouModalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthMark from "@/components/AuthMark";

type Props = {
  embedded?: boolean;
  onBack?: () => void;
};

const SendToOpenPayProPanel = ({ embedded = false, onBack }: Props) => {
  const navigate = useNavigate();
  const { showThankYouModal } = useThankYouModal();
  const [proTo, setProTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const amountNum = Number(amount);
  const destinationKind = classifyProDestination(proTo);
  const normalizedPro = normalizeProDestination(proTo);
  const destinationError = getProDestinationError(proTo);
  const previewTarget = destinationKind === "invalid" || destinationKind === "empty"
    ? ""
    : formatProDestinationPreview(proTo);

  const canSubmit = useMemo(
    () =>
      Boolean(normalizedPro) &&
      !destinationError &&
      Number.isFinite(amountNum) &&
      amountNum > 0 &&
      !submitting,
    [amountNum, destinationError, normalizedPro, submitting],
  );

  useEffect(() => {
    const load = async () => {
      setLoadingBalance(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/sign-in?mode=signin&next=/send/pro");
          return;
        }
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();
        setBalance(Number(wallet?.balance || 0));
      } catch (error) {
        console.error("Failed to load Pro transfer balance", error);
        toast.error("Could not load your balance");
      } finally {
        setLoadingBalance(false);
      }
    };
    void load();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (destinationError) {
      toast.error(destinationError);
      return;
    }

    if (amountNum > balance) {
      toast.error("Insufficient balance");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("transfer-to-openpay-pro", {
        body: {
          to: normalizedPro,
          amount: Number(amountNum.toFixed(2)),
          memo: memo.trim() || undefined,
          ref: makeProXferRef(),
        },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error, "Transfer to OpenPay Pro failed"));
      }

      const payload = (data || {}) as {
        error?: string;
        warning?: string;
        partial?: boolean;
        transaction_id?: string;
        note?: string;
        to_pro?: string;
        partner_name?: string;
        partner_username?: string;
        partner_avatar_url?: string | null;
      };

      if (payload.error && !payload.partial && !payload.transaction_id) {
        throw new Error(payload.error);
      }

      if (payload.partial || payload.warning) {
        toast.message(payload.warning || payload.error || "Pro credit pending");
      } else {
        toast.success(`Sent to OpenPay Pro ${payload.to_pro || previewTarget}`);
      }

      showThankYouModal({
        receiverName: payload.partner_name || "OpenPay Pro",
        receiverUsername: payload.to_pro || previewTarget,
        amount: amountNum,
        purpose: "openpay_pro_xfer",
        note: payload.note,
        receiverAvatar: payload.partner_avatar_url || undefined,
        transactionId: payload.transaction_id || "",
        date: new Date(),
      });

      setAmount("");
      setMemo("");
      setProTo("");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();
        setBalance(Number(wallet?.balance || 0));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transfer failed";
      if (/invalid.*address/i.test(message)) {
        toast.error("Invalid Pro wallet address. Use 0x followed by 40 hex characters.");
      } else if (/unknown|not found|does not exist/i.test(message)) {
        toast.error("Unknown OpenPay Pro destination. Check the @username or wallet address.");
      } else if (/insufficient/i.test(message)) {
        toast.error("Insufficient balance");
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const body = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/65">Your balance</p>
        <p className="mt-1 text-2xl font-black">
          {loadingBalance ? "…" : `${balance.toFixed(2)} OUSD`}
        </p>
        <p className="mt-2 text-xs text-white/70">
          Funds settle to @{OPENPAY_PRO_PARTNER_USERNAME}, then OpenPay Pro credits the destination wallet.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">
          To (Pro @username or 0x wallet)
        </label>
        <Input
          value={proTo}
          onChange={(e) => setProTo(e.target.value)}
          placeholder="@alice or 0x7bf2…851a"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 rounded-2xl border-white/20 bg-white/10 font-mono text-sm text-white placeholder:font-sans placeholder:text-white/45"
        />
        {proTo.trim() && destinationError ? (
          <p className="mt-2 text-xs font-medium text-red-200">{destinationError}</p>
        ) : (
          <p className="mt-2 text-xs text-white/60">
            Use a Pro @username or a 0x wallet address (40 hex characters).
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">
          Amount (OUSD)
        </label>
        <Input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="25.00"
          required
          className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/45"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/70">
          Memo (optional)
        </label>
        <Input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="What's this for?"
          maxLength={120}
          className="h-12 rounded-2xl border-white/20 bg-white/10 text-white placeholder:text-white/45"
        />
      </div>

      {previewTarget ? (
        <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm text-emerald-50">
          Preview: Send to OpenPay Pro <span className="font-bold break-all">{previewTarget}</span>
          {Number.isFinite(amountNum) && amountNum > 0 ? (
            <span className="font-bold"> · {amountNum.toFixed(2)} OUSD</span>
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-12 w-full rounded-2xl bg-white font-bold text-paypal-blue hover:bg-white/95"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {previewTarget ? `Send to ${previewTarget}` : "Send to OpenPay Pro"}
          </>
        )}
      </Button>
    </form>
  );

  if (embedded) {
    return <div className="mt-6">{body}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue via-[#0a53d8] to-[#062a78] px-4 py-5 text-white">
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/15"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <AuthMark className="h-12 w-12" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-white/65">Transfer</p>
              <h1 className="text-2xl font-black tracking-tight">OpenPay Pro</h1>
            </div>
          </div>
          {body}
        </div>
      </div>
    </div>
  );
};

export default SendToOpenPayProPanel;
