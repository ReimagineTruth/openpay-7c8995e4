import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import BrandLogo from "@/components/BrandLogo";
import { loadAppSecuritySettings, isPinSetupCompleted } from "@/lib/appSecurity";
import { playGoogleWalletSuccessSound } from "@/lib/soundEffects";
import { PI_TO_USD } from "@/contexts/CurrencyContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { OUSD_SOL_LABEL, OUSD_SOL_LOGO_URL } from "@/lib/ousdSol";

type WithdrawalType = "PI" | "MRWN" | "OUSD" | "OUSD_SOL";

type SwapWithdrawalRow = {
  id: string;
  amount: number;
  openpay_account_name: string;
  openpay_account_username: string;
  openpay_account_number: string;
  pi_wallet_address: string;
  mrwn_wallet_address: string;
  ousd_wallet_address: string;
  ousd_sol_wallet_address: string;
  withdrawal_type: WithdrawalType;
  status: string;
  admin_note: string;
  reviewed_at: string | null;
  created_at: string;
};

const SETTLEMENT_ACCOUNT_NUMBER = "OPEA68BB7A9F964994A199A15786D680FA";
const SETTLEMENT_USERNAME = "@openpay";
const PI_LOGO_URL = "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png";
const MRWN_LOGO_URL = "https://i.ibb.co/tTZvkjmN/a078a5ec-3c63-4ec5-8ade-f270722deab5-1-removebg-preview.png";
const OUSD_LOGO_URL = "/openpay-o.svg";
const WITHDRAWAL_FEE_RATE = 0.02;
const PIN_ACTION_KEY = "openpay_pin_action_swap_v1";
const swapEnabled = String(import.meta.env.VITE_SWAP_ENABLED || "false").toLowerCase() === "true";

const swapTypeLogo = (type: WithdrawalType) => {
  if (type === "PI") return PI_LOGO_URL;
  if (type === "OUSD") return OUSD_LOGO_URL;
  if (type === "OUSD_SOL") return OUSD_SOL_LOGO_URL;
  return MRWN_LOGO_URL;
};

const swapTypeLabel = (type: WithdrawalType) => (type === "OUSD_SOL" ? OUSD_SOL_LABEL : type);

const normalizeUsername = (value: string) => value.trim().replace(/^@+/, "").toLowerCase();
const isSchemaCacheMissingError = (message: string | undefined, target: string) =>
  Boolean(message) && message.includes("schema cache") && message.includes(target);

const SwapWithdrawalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const handleProtectedAction = async (action: () => Promise<void>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const settings = user ? loadAppSecuritySettings(user.id) : null;
    const pinSetupCompleted = user ? isPinSetupCompleted(user.id) : false;
    
    // Navigate to PIN confirmation page if user has PIN set up
    if (pinSetupCompleted && settings?.pinHash) {
      navigate("/confirm-pin", {
        state: {
          title: "Confirm your OpenPay PIN",
          returnTo: location.pathname + location.search,
          actionData: {
            kind: "swap_withdrawal_submit",
            amount: safeAmount,
            openpayName,
            openpayUsername: normalizedUsername,
            openpayAccountNumber,
            piWalletAddress,
            mrwnWalletAddress,
            ousdSolWalletAddress,
            withdrawalType,
          },
        },
      });
    } else {
      // Proceed directly with action if no PIN set up
      await action();
    }
  };

  useEffect(() => {
    // No PIN redirect flow; proceed without confirm-pin
  }, []);

  const [loading, setLoading] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState("");
  const [openpayName, setOpenpayName] = useState("");
  const [openpayUsername, setOpenpayUsername] = useState("");
  const [openpayAccountNumber, setOpenpayAccountNumber] = useState("");
  const [piWalletAddress, setPiWalletAddress] = useState("");
  const [mrwnWalletAddress, setMrwnWalletAddress] = useState("");
  const [ousdWalletAddress, setOusdWalletAddress] = useState("");
  const [ousdSolWalletAddress, setOusdSolWalletAddress] = useState("");
  const [withdrawalType, setWithdrawalType] = useState<WithdrawalType>("PI");
  const mrwnComingSoon = false;
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<SwapWithdrawalRow[]>([]);
  const [piPriceUsd] = useState<number>(PI_TO_USD);

  const { currencies } = useCurrency();
  const piCurrency = currencies.find(c => c.code === "PI");
  const mrwnCurrency = currencies.find(c => c.code === "MRWN");
  const ousdCurrency = currencies.find(c => c.code === "OUSD");
  const ousdSolCurrency = currencies.find(c => c.code === "OUSD_SOL");
  const selectedCurrency =
    withdrawalType === "PI"
      ? piCurrency
      : withdrawalType === "OUSD"
        ? ousdCurrency
        : withdrawalType === "OUSD_SOL"
          ? ousdSolCurrency ?? ousdCurrency
          : mrwnCurrency;
  
  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const meetsMinimum = safeAmount >= 10;
  const feeAmount = safeAmount > 0 ? Number((safeAmount * WITHDRAWAL_FEE_RATE).toFixed(2)) : 0;
  const payoutAmount = safeAmount > 0 ? Number((safeAmount - feeAmount).toFixed(2)) : 0;
  const payoutPiAmount = payoutAmount > 0 ? payoutAmount / PI_TO_USD : 0;
  const payoutMrwnAmount = payoutAmount > 0 && selectedCurrency ? payoutAmount / selectedCurrency.rate : 0;
  const payoutOusdAmount = payoutAmount > 0 ? payoutAmount : 0;
  const payoutOusdSolAmount = payoutAmount > 0 ? payoutAmount : 0;
  const showPrice =
    withdrawalType === "PI" ||
    withdrawalType === "OUSD" ||
    withdrawalType === "OUSD_SOL" ||
    !mrwnComingSoon;

  const normalizedUsername = useMemo(() => normalizeUsername(openpayUsername), [openpayUsername]);
  const formattedPiPrice = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(piPriceUsd),
    [piPriceUsd],
  );

  const loadIdentity = async () => {
    const { data, error } = await supabase.rpc("upsert_my_user_account");
    if (error) return;
    const row = data as { account_number?: string; account_name?: string; account_username?: string } | null;
    setOpenpayAccountNumber((prev) => prev || String(row?.account_number || "").trim().toUpperCase());
    setOpenpayName((prev) => prev || String(row?.account_name || "").trim());
    setOpenpayUsername((prev) => prev || String(row?.account_username || "").trim());
  };

  const loadHistory = async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("user_swap_withdrawals" as any)
        .select("id, amount, openpay_account_name, openpay_account_username, openpay_account_number, pi_wallet_address, mrwn_wallet_address, ousd_wallet_address, ousd_sol_wallet_address, withdrawal_type, status, admin_note, reviewed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message || "Failed to load withdrawals");
      const rows: any[] = Array.isArray(data) ? (data as any[]) : [];
      setHistory(
        rows.map((r: any) => {
          return {
            id: String(r.id ?? ""),
            amount: Number((r.amount as number | string | undefined) ?? 0),
            openpay_account_name: String(r.openpay_account_name ?? ""),
            openpay_account_username: String(r.openpay_account_username ?? ""),
            openpay_account_number: String(r.openpay_account_number ?? ""),
            pi_wallet_address: String(r.pi_wallet_address ?? ""),
            mrwn_wallet_address: String(r.mrwn_wallet_address ?? ""),
            ousd_wallet_address: String(r.ousd_wallet_address ?? ""),
            ousd_sol_wallet_address: String(r.ousd_sol_wallet_address ?? ""),
            withdrawal_type: (String(r.withdrawal_type ?? "PI") as WithdrawalType),
            status: String(r.status ?? "pending"),
            admin_note: String(r.admin_note ?? ""),
            reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null,
            created_at: String(r.created_at ?? ""),
          };
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load withdrawals";
      if (isSchemaCacheMissingError(message, "public.user_swap_withdrawals")) {
        setHistory([]);
        toast.error("Withdrawal history is initializing. Please refresh in a moment.");
        return;
      }
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      await Promise.all([loadIdentity(), loadHistory()]);
      setIsInitialLoadDone(true);
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = location.state as any;
    let data = state?.actionData || null;
    if (!data) {
      try {
        const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(PIN_ACTION_KEY) : null;
        if (raw) data = JSON.parse(raw);
      } catch {
        // no-op
      }
    }
    if (state?.pinVerified && data?.kind === "swap_withdrawal_submit") {
      void (async () => {
        await submitWithdrawalRequest({
          amount: String(data.amount),
          openpayName: String(data.openpayName || ""),
          openpayUsername: String(data.openpayUsername || ""),
          openpayAccountNumber: String(data.openpayAccountNumber || ""),
          piWalletAddress: String(data.piWalletAddress || ""),
          mrwnWalletAddress: String(data.mrwnWalletAddress || ""),
          ousdWalletAddress: String(data.ousdWalletAddress || ""),
          ousdSolWalletAddress: String(data.ousdSolWalletAddress || ""),
          withdrawalType: String(data.withdrawalType || "PI") as WithdrawalType,
        });
        try {
          if (typeof window !== "undefined") window.sessionStorage.removeItem(PIN_ACTION_KEY);
        } catch {
          // no-op
        }
        navigate(location.pathname + location.search, { replace: true, state: {} });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    const amountParam = searchParams.get("amount");
    const typeParam = searchParams.get("type");
    
    if (amountParam) {
      const parsed = Number(amountParam);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      const formatted = parsed.toFixed(2);
      setAmount((prev) => prev || formatted);
    }
    
    if (typeParam && (typeParam === "PI" || typeParam === "MRWN" || typeParam === "OUSD" || typeParam === "OUSD_SOL")) {
      setWithdrawalType(typeParam);
    }
  }, [searchParams]);

  const submitWithdrawal = async () => {
    if (!swapEnabled) {
      toast.error("Swap withdrawal is coming soon");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!meetsMinimum) {
      toast.error("Minimum withdrawal is 10 OPEN USD");
      return;
    }
    if (
      !openpayName.trim() ||
      !normalizedUsername ||
      !openpayAccountNumber.trim() ||
      (withdrawalType === "PI"
        ? !piWalletAddress.trim()
        : withdrawalType === "OUSD"
          ? !ousdWalletAddress.trim()
          : withdrawalType === "OUSD_SOL"
            ? !ousdSolWalletAddress.trim()
            : !mrwnWalletAddress.trim())
    ) {
      toast.error("Complete all required fields");
      return;
    }
    if (!agreementAccepted) {
      setAgreementChecked(false);
      setShowAgreementModal(true);
      return;
    }

    setShowConfirmModal(true);
  };

  const submitWithdrawalRequest = async (overrideData?: {
    amount: string;
    openpayName: string;
    openpayUsername: string;
    openpayAccountNumber: string;
    piWalletAddress: string;
    mrwnWalletAddress: string;
    ousdWalletAddress: string;
    ousdSolWalletAddress: string;
    withdrawalType: WithdrawalType;
  }) => {
    const activeAmount = overrideData ? Number(overrideData.amount) : safeAmount;
    const activeOpenpayName = overrideData ? overrideData.openpayName : openpayName;
    const activeOpenpayUsername = overrideData ? overrideData.openpayUsername : normalizedUsername;
    const activeOpenpayAccountNumber = overrideData ? overrideData.openpayAccountNumber : openpayAccountNumber;
    const activePiWalletAddress = overrideData ? overrideData.piWalletAddress : piWalletAddress;
    const activeMrwnWalletAddress = overrideData ? overrideData.mrwnWalletAddress : mrwnWalletAddress;
    const activeOusdWalletAddress = overrideData ? overrideData.ousdWalletAddress : ousdWalletAddress;
    const activeOusdSolWalletAddress = overrideData ? overrideData.ousdSolWalletAddress : ousdSolWalletAddress;
    const activeWithdrawalType = overrideData ? overrideData.withdrawalType : withdrawalType;

    playGoogleWalletSuccessSound();
    setSubmitted(false);
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("submit_swap_withdrawal", {
        p_amount: activeAmount,
        p_openpay_account_name: activeOpenpayName.trim(),
        p_openpay_account_username: activeOpenpayUsername,
        p_openpay_account_number: activeOpenpayAccountNumber.trim().toUpperCase(),
        p_pi_wallet_address: activeWithdrawalType === "PI" ? activePiWalletAddress.trim() : null,
        p_mrwn_wallet_address: activeWithdrawalType === "MRWN" ? activeMrwnWalletAddress.trim() : null,
        p_ousd_wallet_address: activeWithdrawalType === "OUSD" ? activeOusdWalletAddress.trim() : null,
        p_ousd_sol_wallet_address: activeWithdrawalType === "OUSD_SOL" ? activeOusdSolWalletAddress.trim() : null,
        p_withdrawal_type: activeWithdrawalType,
      });
      if (error) throw new Error(error.message || "Withdrawal submission failed");
      if (data) {
        toast.success("Thank you! Withdrawal request submitted.");
      } else {
        toast.message("Thank you! Withdrawal request submitted.");
      }
      toast.message("Please wait for admin confirmation. You will receive updates in your dashboard activity history.");
      setSubmitted(true);
      setAmount("");
      await loadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Withdrawal submission failed";
      if (isSchemaCacheMissingError(message, "public.submit_swap_withdrawal")) {
        toast.error("Withdrawal submission is initializing. Please refresh and try again.");
        return;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const confirmAgreementAndSubmit = async () => {
    if (!agreementChecked) return;
    if (!swapEnabled) {
      toast.error("Swap withdrawal is coming soon");
      return;
    }
    setAgreementAccepted(true);
    setShowAgreementModal(false);
    setShowConfirmModal(true);
  };

  return (
    <div className="min-h-screen bg-paypal-blue px-4 py-4 pb-10 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} aria-label="Back" className="bg-white flex h-10 w-10 items-center justify-center rounded-full">
              <ArrowLeft className="h-6 w-6 text-paypal-blue" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/20">
                  <BrandLogo className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">OpenPay</h1>
                  <p className="text-xs text-white/80">Swap Withdrawal</p>
                </div>
              </div>
              <p className="text-xs text-white/80">OpenUSD to {swapTypeLabel(withdrawalType)} payout</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadHistory} disabled={refreshing} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="paypal-surface rounded-3xl p-4 space-y-4">
          {!swapEnabled && (
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-foreground">
              <p className="text-base font-semibold text-foreground">Swap Withdrawal</p>
              <p className="mt-2">This feature is coming soon.</p>
              <p className="mt-1">You can view your recent requests below once available.</p>
            </div>
          )}
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-foreground">
            <p className="font-semibold text-foreground">How this works</p>
            <p className="mt-2">1. Fill in your OpenPay identity and {withdrawalType === "OUSD_SOL" ? "Solana" : "mainnet"} {swapTypeLabel(withdrawalType)} wallet address.</p>
            <p>2. When you submit, your OpenUSD is moved to the settlement account {SETTLEMENT_USERNAME} ({SETTLEMENT_ACCOUNT_NUMBER}).</p>
            {showPrice ? (
              <>
                <p>3. After admin approval, you receive {swapTypeLabel(withdrawalType)} to your wallet. Rate is always 1 {swapTypeLabel(withdrawalType)} = {withdrawalType === "PI" ? PI_TO_USD.toFixed(2) : withdrawalType === "OUSD" || withdrawalType === "OUSD_SOL" ? "1.00" : (selectedCurrency?.rate || 0.5).toFixed(2)} OPEN USD.</p>
                <p>4. A 2% processing fee applies to withdrawals.</p>
              </>
            ) : (
              <>
                <p>3. After admin approval, you will receive {withdrawalType === "OUSD" ? "OUSD" : "MRWN"} to your mainnet wallet. Price coming soon.</p>
                <p>4. A 2% processing fee applies to withdrawals.</p>
              </>
            )}
            {showPrice && (
              <div className="mt-3 rounded-xl border border-white/30 bg-white/5 p-3 text-xs text-foreground">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <img src={withdrawalType === "PI" ? PI_LOGO_URL : withdrawalType === "OUSD" ? OUSD_LOGO_URL : MRWN_LOGO_URL} alt={withdrawalType} className="h-4 w-4" />
                    {withdrawalType} fixed rate
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <img src={withdrawalType === "PI" ? PI_LOGO_URL : withdrawalType === "OUSD" ? OUSD_LOGO_URL : MRWN_LOGO_URL} alt={withdrawalType} className="h-4 w-4" />
                    <span>{withdrawalType === "PI" ? "π" : withdrawalType === "OUSD" ? "O" : "M"}</span>
                    <span>{withdrawalType === "PI" ? formattedPiPrice : withdrawalType === "OUSD" ? "1.00" : (selectedCurrency?.rate || 0.5).toFixed(2)}</span>
                  </span>
                </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Fixed</span>
                    <span>1 {withdrawalType} = {withdrawalType === "PI" ? PI_TO_USD.toFixed(2) : withdrawalType === "OUSD" ? "1.00" : (selectedCurrency?.rate || 0.5).toFixed(2)} OPEN USD</span>
                  </div>
              </div>
            )}
            {!showPrice && withdrawalType === "MRWN" && (
              <div className="mt-3 rounded-xl border border-yellow-300/50 bg-yellow-100/20 p-3 text-xs text-yellow-900">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <img src={MRWN_LOGO_URL} alt="MRWN" className="h-4 w-4" />
                    MRWN price coming soon
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <img src={MRWN_LOGO_URL} alt="MRWN" className="h-4 w-4" />
                    <span>M</span>
                    <span>Coming Soon</span>
                  </span>
                </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-yellow-800">
                    <span>Status</span>
                    <span>Price will be announced soon</span>
                  </div>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Processing may be delayed due to high transaction volume or network congestion.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Withdrawal details</p>
            <p className="text-xs text-muted-foreground">Select withdrawal type and confirm your OpenPay identity and wallet address.</p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>Withdrawal type</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">Select one</span>
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setWithdrawalType("PI")}
                  disabled={!swapEnabled}
                  className={`group relative h-16 rounded-2xl border-2 transition-all duration-300 ease-out ${
                    withdrawalType === "PI"
                      ? "border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 shadow-xl shadow-blue-500/25 scale-105"
                      : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 hover:shadow-lg hover:scale-102 hover:-translate-y-1"
                  } ${!swapEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {withdrawalType === "PI" && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white"></div>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center gap-2 h-full">
                    <div className={`relative transition-transform duration-300 ${
                      withdrawalType === "PI" ? "scale-110" : "group-hover:scale-105"
                    }`}>
                      <img src={PI_LOGO_URL} alt="PI" className="h-6 w-6 drop-shadow-md" />
                    </div>
                    <div className="text-center">
                      <span className={`text-xs font-bold transition-colors duration-300 ${
                        withdrawalType === "PI" ? "text-blue-600" : "text-foreground group-hover:text-white"
                      }`}>Pi Network</span>
                      <div className={`text-[10px] transition-opacity duration-300 ${
                        withdrawalType === "PI" ? "opacity-100 text-blue-500" : "opacity-0 group-hover:opacity-70 text-muted-foreground"
                      }`}>Fast & Secure</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalType("OUSD")}
                  disabled={!swapEnabled}
                  className={`group relative h-16 rounded-2xl border-2 transition-all duration-300 ease-out ${
                    withdrawalType === "OUSD"
                      ? "border-green-400 bg-gradient-to-br from-green-50 to-green-100 shadow-xl shadow-green-500/25 scale-105"
                      : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 hover:shadow-lg hover:scale-102 hover:-translate-y-1"
                  } ${!swapEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {withdrawalType === "OUSD" && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white"></div>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center gap-2 h-full">
                    <div className={`relative transition-transform duration-300 ${
                      withdrawalType === "OUSD" ? "scale-110" : "group-hover:scale-105"
                    }`}>
                      <img src={OUSD_LOGO_URL} alt="OUSD" className="h-6 w-6 drop-shadow-md" />
                    </div>
                    <div className="text-center">
                      <span className={`text-xs font-bold transition-colors duration-300 ${
                        withdrawalType === "OUSD" ? "text-green-600" : "text-foreground group-hover:text-white"
                      }`}>OUSD</span>
                      <div className={`text-[10px] transition-opacity duration-300 ${
                        withdrawalType === "OUSD" ? "opacity-100 text-green-500" : "opacity-0 group-hover:opacity-70 text-muted-foreground"
                      }`}>1:1 Rate</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalType("OUSD_SOL")}
                  disabled={!swapEnabled}
                  className={`group relative h-16 rounded-2xl border-2 transition-all duration-300 ease-out ${
                    withdrawalType === "OUSD_SOL"
                      ? "border-sky-400 bg-gradient-to-br from-sky-50 to-blue-100 shadow-xl shadow-sky-500/25 scale-105"
                      : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 hover:shadow-lg hover:scale-102 hover:-translate-y-1"
                  } ${!swapEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {withdrawalType === "OUSD_SOL" && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-sky-500 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white"></div>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center gap-2 h-full">
                    <div className={`relative transition-transform duration-300 ${
                      withdrawalType === "OUSD_SOL" ? "scale-110" : "group-hover:scale-105"
                    }`}>
                      <img src={OUSD_SOL_LOGO_URL} alt={OUSD_SOL_LABEL} className="h-6 w-6 drop-shadow-md" />
                    </div>
                    <div className="text-center">
                      <span className={`text-xs font-bold transition-colors duration-300 ${
                        withdrawalType === "OUSD_SOL" ? "text-sky-600" : "text-foreground group-hover:text-white"
                      }`}>{OUSD_SOL_LABEL}</span>
                      <div className={`text-[10px] transition-opacity duration-300 ${
                        withdrawalType === "OUSD_SOL" ? "opacity-100 text-sky-500" : "opacity-0 group-hover:opacity-70 text-muted-foreground"
                      }`}>Solana 1:1</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalType("MRWN")}
                  disabled={!swapEnabled}
                  className={`group relative h-16 rounded-2xl border-2 transition-all duration-300 ease-out ${
                    withdrawalType === "MRWN"
                      ? "border-purple-400 bg-gradient-to-br from-purple-50 to-purple-100 shadow-xl shadow-purple-500/25 scale-105"
                      : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 hover:shadow-lg hover:scale-102 hover:-translate-y-1"
                  } ${!swapEnabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {withdrawalType === "MRWN" && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-purple-500 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-white"></div>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center gap-2 h-full">
                    <div className={`relative transition-transform duration-300 ${
                      withdrawalType === "MRWN" ? "scale-110" : "group-hover:scale-105"
                    }`}>
                      <img src={MRWN_LOGO_URL} alt="MRWN" className="h-6 w-6 drop-shadow-md" />
                    </div>
                    <div className="text-center">
                      <span className={`text-xs font-bold transition-colors duration-300 ${
                        withdrawalType === "MRWN" ? "text-purple-600" : "text-foreground group-hover:text-white"
                      }`}>MRWN</span>
                      <div className={`text-[10px] transition-opacity duration-300 ${
                        withdrawalType === "MRWN" ? "opacity-100 text-purple-500" : "opacity-0 group-hover:opacity-70 text-muted-foreground"
                      }`}>OUSD → MRWN</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>OpenUSD amount (min 10)</span>
              <input
                value={amount}
                type="number"
                min="10"
                step="0.01"
                placeholder="Enter amount"
                readOnly
                aria-readonly="true"
                className="h-11 w-full rounded-xl border border-white/30 bg-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>OpenPay full name</span>
              <input
                value={openpayName}
                placeholder="Full name"
                readOnly
                aria-readonly="true"
                className="h-11 w-full rounded-xl border border-white/30 bg-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>OpenPay username</span>
              <input
                value={openpayUsername}
                placeholder="@username"
                readOnly
                aria-readonly="true"
                className="h-11 w-full rounded-xl border border-white/30 bg-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>OpenPay account number</span>
              <input
                value={openpayAccountNumber}
                placeholder="OPEA..."
                readOnly
                aria-readonly="true"
                className="h-11 w-full rounded-xl border border-white/30 bg-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <img src={swapTypeLogo(withdrawalType)} alt={swapTypeLabel(withdrawalType)} className="h-4 w-4" />
                {withdrawalType === "OUSD_SOL" ? "Solana" : "Mainnet"} {swapTypeLabel(withdrawalType)} wallet address
              </span>
              <input
                value={
                  withdrawalType === "PI"
                    ? piWalletAddress
                    : withdrawalType === "OUSD"
                      ? ousdWalletAddress
                      : withdrawalType === "OUSD_SOL"
                        ? ousdSolWalletAddress
                        : mrwnWalletAddress
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (withdrawalType === "PI") setPiWalletAddress(v);
                  else if (withdrawalType === "OUSD") setOusdWalletAddress(v);
                  else if (withdrawalType === "OUSD_SOL") setOusdSolWalletAddress(v);
                  else setMrwnWalletAddress(v);
                }}
                placeholder={`${swapTypeLabel(withdrawalType)} wallet address`}
                readOnly={!swapEnabled}
                aria-readonly={!swapEnabled ? "true" : undefined}
                className="h-11 w-full rounded-xl border border-white/30 bg-white/10 px-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <span className="text-[11px] text-muted-foreground">Make sure this is your {swapTypeLabel(withdrawalType)} {withdrawalType === "OUSD_SOL" ? "Solana" : "mainnet"} address.</span>
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/30 p-3 text-sm text-foreground">
            <div className="flex items-center justify-between">
              <span>Amount</span>
              <span className="font-semibold">{safeAmount.toFixed(2)} OPEN USD</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Fee (2%)</span>
              <span>-{feeAmount.toFixed(2)} OPEN USD</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold">You will receive</span>
              <span className="inline-flex items-center gap-2 font-semibold text-paypal-blue">
                <img src={swapTypeLogo(withdrawalType)} alt={swapTypeLabel(withdrawalType)} className="h-5 w-5" />
                {(() => {
                  if (showPrice) {
                    if (withdrawalType === "PI") return `${payoutPiAmount.toFixed(4)} PI`;
                    if (withdrawalType === "OUSD") return `${payoutOusdAmount.toFixed(2)} OUSD`;
                    if (withdrawalType === "OUSD_SOL") return `${payoutOusdSolAmount.toFixed(2)} ${OUSD_SOL_LABEL}`;
                    if (withdrawalType === "MRWN") return `${payoutMrwnAmount.toFixed(4)} MRWN`;
                    return "Coming Soon";
                  }
                  if (withdrawalType === "PI") return `${payoutPiAmount.toFixed(4)} PI`;
                  if (withdrawalType === "OUSD") return `${payoutOusdAmount.toFixed(2)} OUSD`;
                  if (withdrawalType === "OUSD_SOL") return `${payoutOusdSolAmount.toFixed(2)} ${OUSD_SOL_LABEL}`;
                  if (withdrawalType === "MRWN") return "Coming Soon MRWN";
                  return "Coming Soon";
                })()}
              </span>
            </div>
          </div>

          <Button
            className="mt-3 h-11 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white hover:bg-[#004dc5]"
            onClick={submitWithdrawal}
            disabled={!swapEnabled || loading || !meetsMinimum}
          >
            {!swapEnabled ? "Coming Soon" : loading ? "Submitting..." : "Submit Withdrawal"}
          </Button>
          {submitted ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Thank you! Your withdrawal request is complete. Please wait for admin confirmation. You will receive updates
              in your dashboard activity history.
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            By submitting, you authorize the transfer of your OpenUSD to {SETTLEMENT_USERNAME} ({SETTLEMENT_ACCOUNT_NUMBER}).
          </p>
        </div>

        <div className="mt-4 paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Recent withdrawals</h2>
            <p className="text-xs text-muted-foreground">{history.length} latest</p>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
          ) : (
            <div className="divide-y divide-border/70 rounded-2xl border border-border/70">
              {history.map((row, index) => (
                <div key={row.id || index} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.amount.toFixed(2)} OPEN USD</p>
                    <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      {row.status}
                    </span>
                  </div>
                  <div className="mt-1 inline-flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <img src={swapTypeLogo(row.withdrawal_type)} alt={swapTypeLabel(row.withdrawal_type)} className="h-5 w-auto object-contain" />
                    <span>{swapTypeLabel(row.withdrawal_type)} payout</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {swapTypeLabel(row.withdrawal_type)} wallet:{" "}
                    {row.withdrawal_type === "PI"
                      ? row.pi_wallet_address
                      : row.withdrawal_type === "OUSD"
                        ? row.ousd_wallet_address
                        : row.withdrawal_type === "OUSD_SOL"
                          ? row.ousd_sol_wallet_address
                          : row.mrwn_wallet_address}
                  </p>
                  {row.admin_note && (
                    <p className="mt-1 text-xs text-muted-foreground">Admin note: {row.admin_note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAgreementModal} onOpenChange={setShowAgreementModal}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg p-6">
          <DialogTitle className="text-xl font-bold text-foreground mb-4">OpenPay Swap Withdrawal Agreement</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mb-6">
            Please review and accept before proceeding with your swap withdrawal.
          </DialogDescription>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border p-4 text-sm text-foreground space-y-4">
              <div>
                <p className="font-semibold">1. Nature of Service</p>
                <p className="mt-2">
                  OpenPay facilitates internal balance transfers and swap withdrawal requests. OpenPay is not a bank or
                  licensed money service business unless stated under applicable law.
                </p>
              </div>
              <div>
                <p className="font-semibold">2. Withdrawal Authorization</p>
                <p className="mt-2">By proceeding, you authorize OpenPay to move your OpenUSD to the settlement account.</p>
                <p className="mt-1">You confirm the OpenPay account details and {withdrawalType === "PI" ? "PI" : withdrawalType === "OUSD" ? "OUSD" : "MRWN"} wallet address are correct.</p>
              </div>
              <div>
                <p className="font-semibold">3. Fees and Processing</p>
                <p className="mt-2">A 2% processing fee applies to swap withdrawals.</p>
                <p className="mt-1">Processing time depends on network conditions and admin approval.</p>
              </div>
              <div>
                <p className="font-semibold">4. User Responsibility</p>
                <p className="mt-2">Verify the withdrawal amount and wallet address before submitting.</p>
                <p className="mt-1">Incorrect details may lead to delayed or failed payouts.</p>
              </div>
              <div>
                <p className="font-semibold">5. No Deposit Insurance</p>
                <p className="mt-2">OpenPay balances are not insured by any government deposit insurance program.</p>
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm text-foreground p-3 rounded-lg bg-muted/50">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
              />
              <span className="leading-relaxed">I understand and agree to proceed with this withdrawal.</span>
            </label>
            <Button
              className="h-12 w-full rounded-xl bg-paypal-blue text-white hover:bg-[#004dc5] font-semibold"
              disabled={!swapEnabled || !agreementChecked}
              onClick={confirmAgreementAndSubmit}
            >
              {!swapEnabled ? "Coming Soon" : "Accept & Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="rounded-3xl sm:max-w-md p-6">
          <DialogTitle className="text-lg font-bold text-foreground mb-2">Confirm Withdrawal</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mb-6">
            Please confirm the withdrawal details before submitting.
          </DialogDescription>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border p-4 bg-muted/30">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-semibold text-foreground">{safeAmount.toFixed(2)} OPEN USD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fee (2%)</span>
                  <span className="font-semibold text-red-500">-{feeAmount.toFixed(2)} OPEN USD</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">You will receive</span>
                    <span className="font-bold text-lg text-paypal-blue">
                      {withdrawalType === "PI"
                        ? payoutPiAmount.toFixed(4)
                        : withdrawalType === "OUSD"
                          ? payoutOusdAmount.toFixed(2)
                          : withdrawalType === "OUSD_SOL"
                            ? payoutOusdSolAmount.toFixed(2)
                            : payoutMrwnAmount.toFixed(4)}{" "}
                      {swapTypeLabel(withdrawalType)}
                    </span>
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">{withdrawalType} wallet</span>
                    <span className="font-mono text-xs text-foreground break-all">
                      {withdrawalType === "PI"
                        ? piWalletAddress || "N/A"
                        : withdrawalType === "OUSD"
                          ? ousdWalletAddress || "N/A"
                          : withdrawalType === "OUSD_SOL"
                            ? ousdSolWalletAddress || "N/A"
                            : mrwnWalletAddress || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 h-12 rounded-xl bg-paypal-blue text-white hover:bg-[#004dc5] font-semibold"
                onClick={() => {
                  setShowConfirmModal(false);
                  handleProtectedAction(submitWithdrawalRequest);
                }}
                disabled={!swapEnabled || loading}
              >
                {!swapEnabled ? "Coming Soon" : "Confirm & Submit"}
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl px-6"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SwapWithdrawalPage;
