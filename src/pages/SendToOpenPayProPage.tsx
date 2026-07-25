import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, QrCode, Send } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import {
  buildProXferNote,
  classifyProDestination,
  extractProDestinationFromQr,
  formatProDestinationPreview,
  getProDestinationError,
  makeProXferRef,
  normalizeProDestination,
  OPENPAY_PRO_PARTNER_USERNAME,
} from "@/lib/openpayProTransfer";
import { useThankYouModal } from "@/contexts/ThankYouModalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import AuthMark from "@/components/AuthMark";

type Props = {
  embedded?: boolean;
  onBack?: () => void;
};

type TransferPayload = {
  error?: string;
  warning?: string;
  partial?: boolean;
  pro_notified?: boolean;
  transaction_id?: string;
  note?: string;
  to_pro?: string;
  partner_name?: string;
  partner_username?: string;
  partner_avatar_url?: string | null;
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
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");

  const amountNum = Number(amount);
  const destinationKind = classifyProDestination(proTo);
  const normalizedPro = normalizeProDestination(proTo);
  const destinationError = getProDestinationError(proTo);
  const previewTarget =
    destinationKind === "invalid" || destinationKind === "empty"
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

  useEffect(() => {
    if (!showScanner) return;

    let scanner: Html5Qrcode | null = null;
    let isDone = false;
    setScanError("");

    const waitForScannerElement = async () => {
      if (typeof document === "undefined") return false;
      for (let i = 0; i < 10; i += 1) {
        if (document.getElementById("openpay-pro-scanner")) return true;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return false;
    };

    const stopScanner = async () => {
      if (!scanner) return;
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        // no-op
      }
      try {
        scanner.clear();
      } catch {
        // no-op
      }
    };

    const patchVideoElementForMobile = () => {
      if (typeof document === "undefined") return;
      const video = document.querySelector("#openpay-pro-scanner video") as HTMLVideoElement | null;
      if (!video) return;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("autoplay", "true");
      video.setAttribute("muted", "true");
    };

    const startScanner = async () => {
      const mounted = await waitForScannerElement();
      if (!mounted) {
        setScanError("Scanner failed to mount. Please try again.");
        return;
      }
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setScanError("Camera needs HTTPS (or localhost) to work.");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setScanError("Camera API is not available on this device/browser.");
        return;
      }

      scanner = new Html5Qrcode("openpay-pro-scanner", {
        verbose: false,
        useBarCodeDetectorIfSupported: false,
      });

      const onDecoded = async (decodedText: string) => {
        if (isDone) return;
        isDone = true;
        const destination = extractProDestinationFromQr(decodedText);
        await stopScanner();
        setShowScanner(false);

        if (!destination) {
          toast.error("QR did not contain a Pro @username or 0x wallet");
          return;
        }
        setProTo(destination);
        toast.success(`Scanned ${formatProDestinationPreview(destination)}`);
      };

      const scanConfig = {
        fps: 12,
        disableFlip: false,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const box = Math.max(180, Math.floor(minEdge * 0.68));
          return { width: box, height: box };
        },
      };

      try {
        let cameras: Awaited<ReturnType<typeof Html5Qrcode.getCameras>> = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch {
          // Some browsers block camera enumeration until stream opens.
        }
        const preferredBack = cameras.find((cam) =>
          /(back|rear|environment)/i.test(cam.label || ""),
        );

        const sources: Array<string | MediaTrackConstraints> = [];
        sources.push({ facingMode: { exact: "environment" } });
        sources.push({ facingMode: { ideal: "environment" } });
        sources.push({ facingMode: "environment" });
        if (preferredBack?.id) sources.push(preferredBack.id);
        if (cameras[0]?.id) sources.push(cameras[0].id);
        sources.push({ facingMode: "user" });

        let started = false;
        let startError = "";

        for (const source of sources) {
          try {
            await scanner.start(source, scanConfig, onDecoded, () => undefined);
            patchVideoElementForMobile();
            setScanError("");
            started = true;
            break;
          } catch (error) {
            startError = error instanceof Error ? error.message : "Unable to start camera";
          }
        }

        if (!started) {
          setScanError(startError || "Unable to start camera");
        }
      } catch (error) {
        setScanError(error instanceof Error ? error.message : "Unable to start camera");
      }
    };

    void startScanner();

    return () => {
      isDone = true;
      void stopScanner();
    };
  }, [showScanner]);

  const transferViaSendMoney = async (note: string): Promise<TransferPayload> => {
    const { data: partner, error: partnerError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .ilike("username", OPENPAY_PRO_PARTNER_USERNAME)
      .maybeSingle();

    if (partnerError) throw partnerError;
    if (!partner?.id) throw new Error("OpenPay Pro partner account is not available.");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && partner.id === user.id) {
      throw new Error("Cannot transfer to your own partner tag.");
    }

    const { data, error } = await supabase.functions.invoke("send-money", {
      body: {
        receiver_id: partner.id,
        amount: Number(amountNum.toFixed(2)),
        note,
        purpose: "openpay_pro_xfer",
      },
    });

    if (error) {
      throw new Error(await getFunctionErrorMessage(error, "Transfer to OpenPay Pro failed"));
    }

    const payload = (data || {}) as TransferPayload;
    if (payload.error && !payload.partial && !payload.transaction_id) {
      throw new Error(payload.error);
    }

    return {
      ...payload,
      partner_name: partner.full_name || "OpenPay Pro",
      partner_username: partner.username || OPENPAY_PRO_PARTNER_USERNAME,
      partner_avatar_url: partner.avatar_url,
      note: payload.note || note,
      to_pro: payload.to_pro || formatProDestinationPreview(proTo),
    };
  };

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
      const ref = makeProXferRef();
      const note = buildProXferNote(proTo, ref);
      // Use live send-money (debits partner + notifies Pro when secrets are set).
      // Dedicated transfer-to-openpay-pro is optional and may not be deployed yet.
      const payload = await transferViaSendMoney(note);

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
        note: payload.note || note,
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
      } else if (/insufficient/i.test(message)) {
        toast.error("Insufficient balance");
      } else if (/partner account is not available|own partner tag/i.test(message)) {
        toast.error(message);
      } else if (/unknown.*destination|invalid openpay pro username/i.test(message)) {
        toast.error("Unknown OpenPay Pro destination. Check the @username or wallet address.");
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
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="block text-xs font-bold uppercase tracking-wide text-white/70">
            To (Pro @username or 0x wallet)
          </label>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/25"
            aria-label="Scan Pro QR code"
          >
            <QrCode className="h-4 w-4" />
            Scan
          </button>
        </div>
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
            Use a Pro @username, 0x wallet, or scan a Pro QR code.
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

  const scannerDialog = (
    <Dialog open={showScanner} onOpenChange={setShowScanner}>
      <DialogContent className="max-w-md rounded-3xl">
        <div className="mb-2 flex items-center gap-2">
          <QrCode className="h-5 w-5 text-gray-800" />
          <DialogTitle className="text-lg font-semibold text-gray-800">Scan Pro QR</DialogTitle>
        </div>
        <DialogDescription className="text-xs text-muted-foreground">
          Point your camera at an OpenPay Pro @username or 0x wallet QR.
        </DialogDescription>
        <div
          id="openpay-pro-scanner"
          className="min-h-[260px] overflow-hidden rounded-2xl border border-border"
        />
        {scanError ? <p className="text-sm text-red-500">{scanError}</p> : null}
        <p className="text-xs text-muted-foreground">
          If the camera does not open in Pi Browser, enable camera permission and retry.
        </p>
      </DialogContent>
    </Dialog>
  );

  if (embedded) {
    return (
      <div className="mt-6">
        {body}
        {scannerDialog}
      </div>
    );
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
      {scannerDialog}
    </div>
  );
};

export default SendToOpenPayProPanel;
