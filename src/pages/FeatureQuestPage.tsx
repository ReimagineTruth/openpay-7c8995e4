import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FEATURE_QUEST_CLAIMED_KEY,
  FEATURE_QUEST_STEPS,
  getCompletedSteps,
  markStepCompleted,
  resetFeatureQuest,
} from "@/lib/featureQuest";

const CATEGORIES = ["Essentials", "Grow", "Earn", "Business", "Advanced"] as const;

const FeatureQuestPage = () => {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>([]);
  const [claimed, setClaimed] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  useEffect(() => {
    setCompleted(getCompletedSteps());
    try {
      setClaimed(window.localStorage.getItem(FEATURE_QUEST_CLAIMED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const total = FEATURE_QUEST_STEPS.length;
  const doneCount = completed.length;
  const progress = Math.round((doneCount / total) * 100);
  const allDone = doneCount >= total;

  const grouped = useMemo(() => {
    return CATEGORIES.map((c) => ({
      title: c,
      steps: FEATURE_QUEST_STEPS.filter((s) => s.category === c),
    }));
  }, []);

  const handleStart = (id: string, route: string) => {
    const next = markStepCompleted(id);
    setCompleted(next);
    navigate(route);
  };

  const claimReward = () => {
    try {
      window.localStorage.setItem(FEATURE_QUEST_CLAIMED_KEY, "1");
    } catch {
      /* ignore */
    }
    setClaimed(true);
    setShowClaim(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white pb-24 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-paypal-blue">
              OpenPay Quest
            </div>
            <div className="text-base font-bold text-foreground">Feature Challenge</div>
          </div>
          <button
            onClick={() => {
              resetFeatureQuest();
              setCompleted([]);
              setClaimed(false);
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-paypal-blue via-[#0a56d6] to-[#062468] p-6 text-white shadow-xl shadow-paypal-blue/30">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/80">
              <Sparkles className="h-3.5 w-3.5" /> Welcome challenge
            </div>
            <h1 className="mt-1 text-2xl font-black leading-tight">
              Master every OpenPay feature
            </h1>
            <p className="mt-1 text-sm text-white/85">
              Complete each step to discover OpenPay end-to-end and unlock your Founder badge.
            </p>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-white/85">
                <span>
                  {doneCount} of {total} completed
                </span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Steps grouped */}
        <div className="mt-6 space-y-8">
          {grouped.map((group) => (
            <section key={group.title}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">
                  {group.title}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {group.steps.filter((s) => completed.includes(s.id)).length}/{group.steps.length}
                </span>
              </div>

              <div className="space-y-3">
                {group.steps.map((step) => {
                  const done = completed.includes(step.id);
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "rounded-2xl border p-4 transition-all",
                        done
                          ? "border-emerald-300/70 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/30"
                          : "border-border bg-card hover:border-paypal-blue/40 hover:shadow-md",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                            done
                              ? "bg-emerald-500 text-white"
                              : "bg-paypal-blue/10 text-paypal-blue",
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-foreground">{step.title}</div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {step.description}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleStart(step.id, step.route)}
                        className={cn(
                          "mt-4 h-10 w-full rounded-full text-sm font-semibold",
                          done
                            ? "bg-emerald-500 text-white hover:bg-emerald-600"
                            : "bg-paypal-blue text-white hover:bg-[#004dc5]",
                        )}
                      >
                        {done ? (
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Completed · Revisit
                          </span>
                        ) : (
                          step.cta
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Reward */}
        <section
          className={cn(
            "mt-8 rounded-3xl border p-5 transition-all",
            allDone
              ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-500/50 dark:from-emerald-950/40 dark:to-slate-950"
              : "border-dashed border-border bg-muted/40",
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                allDone ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
              )}
            >
              <Trophy className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">Claim your Founder badge</div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {allDone
                  ? "Congratulations! You've explored every OpenPay feature."
                  : "Finish all steps to unlock a special badge on your profile."}
              </p>
            </div>
          </div>
          <Button
            disabled={!allDone || claimed}
            onClick={claimReward}
            className={cn(
              "mt-4 h-11 w-full rounded-full text-sm font-bold",
              allDone && !claimed
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-muted text-muted-foreground",
            )}
          >
            {claimed ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Claimed
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Gift className="h-4 w-4" /> Claim reward
              </span>
            )}
          </Button>
        </section>
      </div>

      <Dialog open={showClaim} onOpenChange={setShowClaim}>
        <DialogContent showCloseButton={false} className="max-w-sm overflow-hidden rounded-3xl p-0">
          <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 p-6 text-center text-white">
            <button
              onClick={() => setShowClaim(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <Trophy className="h-10 w-10" />
            </div>
            <DialogTitle className="mt-3 text-2xl font-black">Congratulations!</DialogTitle>
            <DialogDescription className="mt-1 text-white/90">
              You've mastered every OpenPay feature and earned the Founder badge.
            </DialogDescription>
          </div>
          <div className="p-5">
            <Button
              onClick={() => {
                setShowClaim(false);
                navigate("/dashboard");
              }}
              className="h-11 w-full rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              Back to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeatureQuestPage;
