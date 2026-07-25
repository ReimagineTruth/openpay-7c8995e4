import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Share2, Wallet, CircleDollarSign, AtSign } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import {
  isOpenPayProPartnerNote,
  isProXferNote,
  parseProXferNote,
} from "@/lib/openpayProTransfer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AuthMark from "@/components/AuthMark";

interface RecipientProfile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
}

const appendQueryParams = (baseUrl: string, params: Record<string, string | undefined | null>) => {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value != null && String(value).trim() !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
};

const UsernamePayPage = () => {
  const navigate = useNavigate();
  const { username = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadError, setLoadError] = useState("");

  const normalizedUsername = username.trim().replace(/^@+/, "").toLowerCase();
  const requestedAmount = searchParams.get("amount") || "";
  const requestedCurrency = (searchParams.get("currency") || "PI").toUpperCase();
  const requestedNote = searchParams.get("note") || "";
  const successUrl = (searchParams.get("success_url") || "").trim();
  const cancelUrl = (searchParams.get("cancel_url") || "").trim();

  const amountNum = Number(requestedAmount);
  const hasValidAmount = Number.isFinite(amountNum) && amountNum > 0;
  const isProXfer = isProXferNote(requestedNote);
  const isPartnerTopup =
    isOpenPayProPartnerNote(requestedNote) || (Boolean(successUrl) && hasValidAmount);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setViewerId(user?.id || null);
        setIsAuthenticated(Boolean(user));

        if (!normalizedUsername) {
          setLoadError("Missing payment username.");
          setRecipient(null);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .ilike("username", normalizedUsername)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          setLoadError("This OpenPay payment link could not be found.");
          setRecipient(null);
          return;
        }

        setRecipient({
          id: data.id,
          full_name: data.full_name || "OpenPay User",
          username: data.username || normalizedUsername,
          avatar_url: data.avatar_url || null,
        });
      } catch (error) {
        console.error("Failed to load username pay page", error);
        setLoadError("We couldn't load this payment profile right now.");
        setRecipient(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [normalizedUsername]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !normalizedUsername) return "";
    const params = new URLSearchParams();
    if (hasValidAmount) {
      params.set("amount", amountNum.toFixed(2));
    }
    if (requestedCurrency) {
      params.set("currency", requestedCurrency);
    }
    if (requestedNote.trim()) {
      params.set("note", requestedNote.trim());
    }
    if (successUrl) {
      params.set("success_url", successUrl);
    }
    if (cancelUrl) {
      params.set("cancel_url", cancelUrl);
    }
    const suffix = params.toString();
    return `${window.location.origin}/pay/${encodeURIComponent(normalizedUsername)}${suffix ? `?${suffix}` : ""}`;
  }, [
    amountNum,
    cancelUrl,
    hasValidAmount,
    normalizedUsername,
    requestedCurrency,
    requestedNote,
    successUrl,
  ]);

  const currentPayPath = useMemo(() => {
    if (typeof window === "undefined") return `/pay/${encodeURIComponent(normalizedUsername)}`;
    return `${window.location.pathname}${window.location.search}`;
  }, [normalizedUsername, searchParams]);

  const initials = (recipient?.full_name || recipient?.username || "OP")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const canPayThisUser = recipient && recipient.id !== viewerId;

  const redirectToSignIn = () => {
    toast.message("Sign in to continue with this payment.");
    navigate(`/sign-in?mode=signin&next=${encodeURIComponent(currentPayPath)}`);
  };

  const handleCancelOrder = () => {
    if (cancelUrl) {
      window.location.href = appendQueryParams(cancelUrl, {
        openpay_cancel: "1",
        openpay_ref: requestedNote.trim() || undefined,
      });
      return;
    }
    navigate(-1);
  };

  const handleBack = () => {
    if (isPartnerTopup) {
      handleCancelOrder();
      return;
    }
    navigate(-1);
  };

  const transferViaSecureRpcFallback = async (receiverId: string, amount: number, note: string) => {
    const { data: txId, error: rpcError } = await supabase.rpc("transfer_funds_authenticated", {
      p_receiver_id: receiverId,
      p_amount: amount,
      p_note: note,
      p_currency_code: "OUSD",
      p_sender_amount: amount,
      p_sender_currency_code: "OUSD",
      p_receiver_amount: amount,
      p_receiver_currency_code: "OUSD",
    } as never);

    if (!rpcError) {
      return String(txId || "");
    }

    const rpcMessage =
      typeof (rpcError as { message?: unknown })?.message === "string"
        ? (rpcError as { message: string }).message
        : "Fallback transfer failed";

    const shouldTryLegacy =
      /schema cache|transfer_funds_authenticated|function.*not\s+found/i.test(rpcMessage);

    if (!shouldTryLegacy) {
      throw new Error(rpcMessage);
    }

    const { data: legacyTxId, error: legacyError } = await supabase.rpc("transfer_funds_authenticated", {
      p_receiver_id: receiverId,
      p_amount: amount,
      p_note: note,
    });

    if (legacyError) {
      const legacyMessage =
        typeof (legacyError as { message?: unknown })?.message === "string"
          ? (legacyError as { message: string }).message
          : "Fallback transfer failed";
      throw new Error(legacyMessage);
    }

    return String(legacyTxId || "");
  };

  const handlePartnerTopupPay = async () => {
    if (!recipient) return;

    if (!isAuthenticated) {
      redirectToSignIn();
      return;
    }

    if (!canPayThisUser) {
      toast.error("You can't pay your own account from this link.");
      return;
    }

    if (!hasValidAmount) {
      toast.error("This top-up link is missing a valid amount.");
      return;
    }

    setPaying(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        redirectToSignIn();
        return;
      }

      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletError) {
        throw walletError;
      }

      const balance = Number(wallet?.balance ?? 0);
      if (balance < amountNum) {
        toast.error("Insufficient balance for this top-up.");
        return;
      }

      const note = requestedNote.trim() || (isProXfer ? "pro_xfer:unknown:manual" : "OpenPay Pro top-up");
      const purpose = isProXfer ? "openpay_pro_xfer" : "openpay_pro_topup";
      let txId = "";

      const { data, error } = await supabase.functions.invoke("send-money", {
        body: {
          receiver_id: recipient.id,
          amount: amountNum,
          note,
          purpose,
          currency_code: "OUSD",
          sender_amount: amountNum,
          sender_currency_code: "OUSD",
          receiver_amount: amountNum,
          receiver_currency_code: "OUSD",
        },
      });

      if (error) {
        try {
          txId = await transferViaSecureRpcFallback(recipient.id, amountNum, note);
        } catch (fallbackError) {
          const edgeErrorMessage = await getFunctionErrorMessage(error, "Transfer failed");
          const fallbackErrorMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : typeof (fallbackError as { message?: unknown })?.message === "string"
                ? String((fallbackError as { message: string }).message)
                : "Fallback transfer failed";
          toast.error(`${edgeErrorMessage}. ${fallbackErrorMessage}`);
          return;
        }
      } else {
        txId = (data as { transaction_id?: string } | null)?.transaction_id || "";
      }

      if (isProXfer && txId) {
        const parsed = parseProXferNote(note);
        const { error: notifyError, data: notifyData } = await supabase.functions.invoke(
          "transfer-to-openpay-pro",
          {
            body: {
              notify_only: true,
              openpay_tx_id: txId,
              amount: amountNum,
              note,
              to: parsed?.to || undefined,
            },
          },
        );
        if (notifyError) {
          console.error("Pro inbound notify failed", notifyError);
          toast.message("Payment sent on OpenPay. Pro credit may need a moment to sync.");
        } else if ((notifyData as { error?: string } | null)?.error) {
          toast.message(String((notifyData as { error?: string }).error));
        }
      }

      const thankYouParams = new URLSearchParams({
        amount: amountNum.toFixed(2),
        currency: "OUSD",
        to: recipient.username || normalizedUsername,
        name: recipient.full_name,
        note,
        tx: txId,
      });
      if (successUrl) thankYouParams.set("success_url", successUrl);
      if (cancelUrl) thankYouParams.set("cancel_url", cancelUrl);

      navigate(`/pay/thank-you?${thankYouParams.toString()}`, { replace: true });
    } catch (error) {
      console.error("Pro top-up payment failed", error);
      toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handleContinueToPay = () => {
    if (!recipient) return;

    // Re-read params at click time so Pro top-ups never fall through to /send
    const noteNow = (searchParams.get("note") || "").trim();
    const successNow = (searchParams.get("success_url") || "").trim();
    const amountNow = Number(searchParams.get("amount") || "");
    const isTopupNow =
      isOpenPayProPartnerNote(noteNow) ||
      (Boolean(successNow) && Number.isFinite(amountNow) && amountNow > 0);

    if (isTopupNow || isPartnerTopup) {
      void handlePartnerTopupPay();
      return;
    }

    if (!isAuthenticated) {
      redirectToSignIn();
      return;
    }
    if (!canPayThisUser) {
      toast.error("You can't pay your own account from this link.");
      return;
    }

    const params = new URLSearchParams({ to: recipient.id });
    if (hasValidAmount) {
      params.set("amount", amountNum.toFixed(2));
    }
    if (requestedCurrency) {
      params.set("currency", requestedCurrency);
    }
    if (requestedNote.trim()) {
      params.set("note", requestedNote.trim());
    }
    navigate(`/send?${params.toString()}`);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Payment link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Pay @${recipient?.username || normalizedUsername} on OpenPay`,
          text: `OpenPay payment link for @${recipient?.username || normalizedUsername}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fall back to copy.
      }
    }
    await handleCopy();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
        <div className="text-center">
          <AuthMark className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Loading payment link...</p>
          <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue via-[#0a53d8] to-[#062a78] px-4 py-5 text-white">
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/15"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-white/20">
              <AvatarImage src={recipient?.avatar_url || ""} alt={recipient?.full_name || normalizedUsername} />
              <AvatarFallback className="bg-white/20 text-lg font-bold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/65">OpenPay tag</p>
              <h1 className="truncate text-2xl font-black tracking-tight">{recipient?.full_name || "Payment profile"}</h1>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-white/80">
                <AtSign className="h-4 w-4" />
                {recipient?.username || normalizedUsername}
              </p>
            </div>
          </div>

          {loadError ? (
            <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-50">
              {loadError}
            </div>
          ) : null}

          {!loadError && recipient ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-black/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/65">Pay to</p>
                  <p className="mt-2 text-lg font-bold">{recipient.full_name}</p>
                  <p className="text-sm text-white/75">@{recipient.username}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-black/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/65">Requested amount</p>
                  <p className="mt-2 text-lg font-bold">
                    {hasValidAmount
                      ? `${amountNum.toFixed(2)} ${isPartnerTopup ? "OUSD" : requestedCurrency}`
                      : "Choose amount in app"}
                  </p>
                  <p className="text-sm text-white/75">{requestedNote.trim() || "No note added"}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">
                      {isPartnerTopup
                        ? isAuthenticated
                          ? isProXfer
                            ? "One-click Pro transfer"
                            : "One-click Pro top-up"
                          : "Sign in to continue"
                        : isAuthenticated
                          ? "Continue in OpenPay"
                          : "Sign in to pay"}
                    </p>
                    <p className="mt-1 text-sm text-white/75">
                      {isPartnerTopup
                        ? isProXfer
                          ? "Pay from your OpenPay balance to credit an OpenPay Pro wallet via this partner tag."
                          : "Pay from your OpenPay balance to complete this OpenPay Pro wallet top-up."
                        : `This payment link opens the existing OpenPay send flow, prefilled for @${recipient.username}.`}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleContinueToPay}
                className="mt-5 h-12 w-full rounded-2xl bg-white font-bold text-paypal-blue hover:bg-white/95"
                disabled={!canPayThisUser || paying}
              >
                <CircleDollarSign className="mr-2 h-4 w-4" />
                {paying
                  ? "Processing..."
                  : isAuthenticated
                    ? `Pay @${recipient.username}`
                    : `Sign in to pay @${recipient.username}`}
              </Button>

              {isPartnerTopup ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelOrder}
                  className="mt-3 h-11 w-full rounded-2xl border-white/20 bg-transparent font-bold text-white hover:bg-white/10"
                  disabled={paying}
                >
                  Cancel order
                </Button>
              ) : null}

              {!canPayThisUser && isAuthenticated ? (
                <p className="mt-3 text-center text-sm text-white/75">This payment tag belongs to your current account.</p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="h-11 rounded-2xl border-white/20 bg-white/10 font-bold text-white hover:bg-white/15"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShare}
                  className="h-11 rounded-2xl border-white/20 bg-white/10 font-bold text-white hover:bg-white/15"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Link
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/15 bg-black/10 p-4 text-sm text-white/75">
              Check the link and try again, or open the OpenPay app to request a fresh payment tag.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsernamePayPage;
