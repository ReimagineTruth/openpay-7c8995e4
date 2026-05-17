import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Share2, Wallet, CircleDollarSign, AtSign } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AuthMark from "@/components/AuthMark";

interface RecipientProfile {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
}

const UsernamePayPage = () => {
  const navigate = useNavigate();
  const { username = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadError, setLoadError] = useState("");

  const normalizedUsername = username.trim().replace(/^@+/, "").toLowerCase();
  const requestedAmount = searchParams.get("amount") || "";
  const requestedCurrency = (searchParams.get("currency") || "PI").toUpperCase();
  const requestedNote = searchParams.get("note") || "";

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
    if (requestedAmount && Number.isFinite(Number(requestedAmount)) && Number(requestedAmount) > 0) {
      params.set("amount", Number(requestedAmount).toFixed(2));
    }
    if (requestedCurrency) {
      params.set("currency", requestedCurrency);
    }
    if (requestedNote.trim()) {
      params.set("note", requestedNote.trim());
    }
    const suffix = params.toString();
    return `${window.location.origin}/pay/${encodeURIComponent(normalizedUsername)}${suffix ? `?${suffix}` : ""}`;
  }, [normalizedUsername, requestedAmount, requestedCurrency, requestedNote]);

  const initials = (recipient?.full_name || recipient?.username || "OP")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const canPayThisUser = recipient && recipient.id !== viewerId;

  const handleContinueToPay = () => {
    if (!recipient) return;
    if (!isAuthenticated) {
      toast.message("Sign in to continue with this payment.");
      navigate("/sign-in?mode=signin");
      return;
    }
    if (!canPayThisUser) {
      toast.error("You can't pay your own account from this link.");
      return;
    }

    const params = new URLSearchParams({ to: recipient.id });
    if (requestedAmount && Number.isFinite(Number(requestedAmount)) && Number(requestedAmount) > 0) {
      params.set("amount", Number(requestedAmount).toFixed(2));
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
          onClick={() => navigate(-1)}
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
                    {requestedAmount && Number.isFinite(Number(requestedAmount)) && Number(requestedAmount) > 0
                      ? `${Number(requestedAmount).toFixed(2)} ${requestedCurrency}`
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
                      {isAuthenticated ? "Continue in OpenPay" : "Sign in to pay"}
                    </p>
                    <p className="mt-1 text-sm text-white/75">
                      This payment link opens the existing OpenPay send flow, prefilled for @{recipient.username}.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleContinueToPay}
                className="mt-5 h-12 w-full rounded-2xl bg-white font-bold text-paypal-blue hover:bg-white/95"
                disabled={!canPayThisUser}
              >
                <CircleDollarSign className="mr-2 h-4 w-4" />
                {isAuthenticated ? `Pay @${recipient.username}` : `Sign in to pay @${recipient.username}`}
              </Button>

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
