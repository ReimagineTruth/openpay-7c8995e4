import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Loader2, ScanFace, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LIVENESS_CHALLENGES,
  buildFaceVerificationMetadata,
  captureVideoFrame,
  computeLivenessScore,
  detectFaceInVideo,
  type LivenessChallengeId,
} from "@/lib/kycFaceVerification";
import type { KycFaceVerificationMetadata } from "@/lib/kyc";

export type KycFaceCaptureResult = {
  file: File;
  metadata: KycFaceVerificationMetadata;
  livenessScore: number;
};

type KycFaceCaptureProps = {
  onComplete: (result: KycFaceCaptureResult) => void;
  onCancel?: () => void;
  disabled?: boolean;
};

const KycFaceCapture = ({ onComplete, onCancel, disabled }: KycFaceCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [phase, setPhase] = useState<"intro" | "running" | "capturing" | "done">("intro");
  const [holdProgress, setHoldProgress] = useState(0);
  const [faceOk, setFaceOk] = useState(true);
  const [completedChallenges, setCompletedChallenges] = useState<LivenessChallengeId[]>([]);
  const [faceDetectedSteps, setFaceDetectedSteps] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const captureStartedRef = useRef(false);

  const challenge = LIVENESS_CHALLENGES[challengeIndex];

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
    } catch (err) {
      console.error("KYC camera error:", err);
      setCameraError("Camera access is required for face verification. Allow camera permission and try again.");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopCamera, previewUrl]);

  useEffect(() => {
    if (phase !== "running" || !cameraReady || !challenge) return;

    let cancelled = false;
    let raf = 0;
    const started = performance.now();

    const tick = async (now: number) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video) {
        const detected = await detectFaceInVideo(video);
        setFaceOk(detected);
      }
      const elapsed = now - started;
      const pct = Math.min(100, (elapsed / challenge.holdMs) * 100);
      setHoldProgress(pct);
      if (elapsed >= challenge.holdMs) {
        const video2 = videoRef.current;
        const detectedFinal = video2 ? await detectFaceInVideo(video2) : true;
        if (detectedFinal) {
          setFaceDetectedSteps((n) => n + 1);
        }
        setCompletedChallenges((prev) => [...prev, challenge.id]);
        if (challengeIndex >= LIVENESS_CHALLENGES.length - 1) {
          setPhase("capturing");
        } else {
          setChallengeIndex((i) => i + 1);
          setHoldProgress(0);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, cameraReady, challenge, challengeIndex]);

  useEffect(() => {
    if (phase !== "capturing" || !cameraReady || captureStartedRef.current) return;
    captureStartedRef.current = true;

    const run = async () => {
      const video = videoRef.current;
      if (!video) return;
      const blob = await captureVideoFrame(video);
      if (!blob) {
        setCameraError("Could not capture selfie. Please try again.");
        setPhase("running");
        setChallengeIndex(LIVENESS_CHALLENGES.length - 1);
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      const metadata = buildFaceVerificationMetadata(completedChallenges, faceDetectedSteps);
      const score = computeLivenessScore(faceDetectedSteps, LIVENESS_CHALLENGES.length);
      const file = new File([blob], `selfie_liveness_${Date.now()}.jpg`, { type: "image/jpeg" });
      stopCamera();
      setPhase("done");
      onComplete({ file, metadata, livenessScore: score });
    };

    void run();
  }, [phase, cameraReady, completedChallenges, faceDetectedSteps, onComplete, stopCamera]);

  const beginVerification = async () => {
    setPhase("running");
    setChallengeIndex(0);
    setHoldProgress(0);
    setCompletedChallenges([]);
    setFaceDetectedSteps(0);
    await startCamera();
  };

  if (phase === "intro") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-paypal-blue/20 bg-paypal-blue/5 p-4">
          <div className="flex items-start gap-3">
            <ScanFace className="mt-0.5 h-6 w-6 shrink-0 text-paypal-blue" />
            <div>
              <p className="font-semibold text-foreground">Live face verification</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We use your front camera for a short liveness check — similar to banking apps. You will center your face,
                turn left and right, then blink for capture.
              </p>
            </div>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-paypal-blue" />
            Good lighting, no sunglasses or mask
          </li>
          <li className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-paypal-blue" />
            Only you should be in the frame
          </li>
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1 bg-paypal-blue hover:bg-[#004dc5]" disabled={disabled} onClick={() => void beginVerification()}>
            Start face scan
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Back
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (phase === "done" && previewUrl) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="font-semibold text-foreground">Face verification captured</p>
        <img src={previewUrl} alt="Verified selfie" className="mx-auto h-40 w-40 rounded-2xl object-cover ring-2 ring-green-500/30" />
        <p className="text-sm text-muted-foreground">Liveness check complete. Continue to review and submit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cameraError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{cameraError}</span>
        </div>
      ) : null}

      <div className="relative mx-auto aspect-[3/4] max-h-[420px] w-full overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "h-[72%] w-[58%] rounded-[50%] border-[3px] transition-colors duration-300",
              faceOk ? "border-paypal-blue/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" : "border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
            )}
          />
        </div>
        {!cameraReady && phase !== "capturing" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
        ) : null}
        {phase === "capturing" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-sm font-medium text-white">Capturing...</p>
          </div>
        ) : null}
      </div>

      {challenge && phase === "running" ? (
        <>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-paypal-blue">
              Step {challengeIndex + 1} of {LIVENESS_CHALLENGES.length}
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">{challenge.title}</p>
            <p className="text-sm text-muted-foreground">{challenge.instruction}</p>
            {!faceOk ? <p className="mt-2 text-sm font-medium text-amber-600">Move your face into the oval</p> : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-paypal-blue transition-all duration-100" style={{ width: `${holdProgress}%` }} />
          </div>
        </>
      ) : null}

      {onCancel ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => { stopCamera(); onCancel(); }}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
};

export default KycFaceCapture;
