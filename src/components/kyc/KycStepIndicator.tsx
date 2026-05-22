import { cn } from "@/lib/utils";
import { KYC_WIZARD_STEPS, type KycWizardStep } from "@/lib/kyc";
import { Check } from "lucide-react";

type KycStepIndicatorProps = {
  currentStep: KycWizardStep;
};

const stepOrder = KYC_WIZARD_STEPS.map((s) => s.id).filter((id) => id !== "intro");

const KycStepIndicator = ({ currentStep }: KycStepIndicatorProps) => {
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-1">
        {stepOrder.map((stepId, index) => {
          const meta = KYC_WIZARD_STEPS.find((s) => s.id === stepId);
          const done = currentIndex > index;
          const active = stepId === currentStep;
          return (
            <div key={stepId} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                  done && "bg-paypal-blue text-white",
                  active && !done && "bg-paypal-blue text-white ring-4 ring-paypal-blue/20",
                  !done && !active && "bg-secondary text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={cn("text-[10px] font-semibold", active ? "text-paypal-blue" : "text-muted-foreground")}>
                {meta?.short}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-paypal-blue transition-all duration-500"
          style={{ width: `${Math.max(8, ((currentIndex + 1) / stepOrder.length) * 100)}%` }}
        />
      </div>
    </div>
  );
};

export default KycStepIndicator;
