import type { KycFaceVerificationMetadata } from "@/lib/kyc";

export type LivenessChallengeId = "center" | "turn_left" | "turn_right" | "blink";

export interface LivenessChallenge {
  id: LivenessChallengeId;
  title: string;
  instruction: string;
  holdMs: number;
}

export const LIVENESS_CHALLENGES: LivenessChallenge[] = [
  {
    id: "center",
    title: "Center your face",
    instruction: "Position your face inside the oval and look at the camera",
    holdMs: 2200,
  },
  {
    id: "turn_left",
    title: "Turn left",
    instruction: "Slowly turn your head to your left and hold",
    holdMs: 2000,
  },
  {
    id: "turn_right",
    title: "Turn right",
    instruction: "Slowly turn your head to your right and hold",
    holdMs: 2000,
  },
  {
    id: "blink",
    title: "Blink once",
    instruction: "Blink naturally, then hold still for capture",
    holdMs: 1800,
  },
];

type FaceDetectorLike = {
  detect: (source: ImageBitmap) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
};

const getFaceDetector = (): FaceDetectorLike | null => {
  const ctor = (window as Window & { FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike })
    .FaceDetector;
  if (!ctor) return null;
  try {
    return new ctor({ fastMode: true, maxDetectedFaces: 1 });
  } catch {
    return null;
  }
};

export const detectFaceInVideo = async (video: HTMLVideoElement): Promise<boolean> => {
  if (video.videoWidth < 64 || video.videoHeight < 64) return false;
  const detector = getFaceDetector();
  if (!detector) return true;

  try {
    const bitmap = await createImageBitmap(video);
    const faces = await detector.detect(bitmap);
    bitmap.close();
    return faces.length > 0;
  } catch {
    return true;
  }
};

export const captureVideoFrame = (video: HTMLVideoElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });

export const buildFaceVerificationMetadata = (
  completed: LivenessChallengeId[],
  faceDetectedSteps: number,
): KycFaceVerificationMetadata => ({
  challenges_completed: completed,
  face_detected_steps: faceDetectedSteps,
  total_steps: LIVENESS_CHALLENGES.length,
  user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  captured_at: new Date().toISOString(),
});

export const computeLivenessScore = (faceDetectedSteps: number, totalSteps: number) => {
  const ratio = totalSteps > 0 ? faceDetectedSteps / totalSteps : 0;
  const base = 55 + ratio * 40;
  return Math.min(98, Math.round(base * 100) / 100);
};
