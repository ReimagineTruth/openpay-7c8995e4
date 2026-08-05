import { Check } from "lucide-react";

export type QrPayStepKey = "setup" | "share" | "pay" | "done";

const STEPS: { key: QrPayStepKey; label: string }[] = [
  { key: "setup", label: "Set up" },
  { key: "share", label: "Share link" },
  { key: "pay", label: "Checkout" },
  { key: "done", label: "Done" },
];

/**
 * Slim 4-step progress rail used across the whole QR Pay journey:
 * create the product → share the link → customer checkout → paid.
 * Rendered inside the blue hero, so colors are white-on-blue by design.
 */
export default function QrPaySteps({ current }: { current: QrPayStepKey }) {
  const activeIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex w-full items-center gap-1.5">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={step.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 w-full rounded-full transition-colors ${
                done ? "bg-white/85" : active ? "bg-white" : "bg-white/25"
              }`}
            />
            <span
              className={`flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] ${
                active ? "text-white" : done ? "text-white/80" : "text-white/45"
              }`}
            >
              {done && <Check className="h-3 w-3 shrink-0" />}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
