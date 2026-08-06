import { Check } from "lucide-react";

export type QrPayStepKey = "setup" | "share" | "pay" | "done";

const STEPS: { key: QrPayStepKey; label: string }[] = [
  { key: "setup", label: "Set up" },
  { key: "share", label: "Share" },
  { key: "pay", label: "Pay" },
  { key: "done", label: "Done" },
];

/**
 * Slim 4-step progress rail for the QR Pay journey.
 * Tuned for the light Apple Pay–style canvas.
 */
export default function QrPaySteps({ current }: { current: QrPayStepKey }) {
  const activeIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex w-full items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={step.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={`h-1 w-full rounded-full transition-colors ${
                done || active ? "bg-[var(--qrp-ink,#1d1d1f)]" : "bg-black/10"
              }`}
            />
            <span
              className={`flex items-center gap-1 truncate text-[11px] font-medium tracking-[-0.01em] ${
                active
                  ? "text-[var(--qrp-ink,#1d1d1f)]"
                  : done
                    ? "text-[var(--qrp-muted,#86868b)]"
                    : "text-black/30"
              }`}
            >
              {done && <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
