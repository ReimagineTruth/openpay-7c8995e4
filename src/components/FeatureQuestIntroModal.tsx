import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Trophy, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  FEATURE_QUEST_INTRO_KEY,
  FEATURE_QUEST_STEPS,
  getCompletedSteps,
} from "@/lib/featureQuest";

const FeatureQuestIntroModal = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(FEATURE_QUEST_INTRO_KEY) === "1";
      const done = getCompletedSteps().length;
      if (!dismissed && done < FEATURE_QUEST_STEPS.length) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(FEATURE_QUEST_INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const start = () => {
    dismiss();
    navigate("/feature-quest");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? dismiss() : setOpen(v))}>
      <DialogContent showCloseButton={false} className="max-w-sm overflow-hidden rounded-3xl p-0">
        <div className="relative bg-gradient-to-br from-paypal-blue via-[#0a56d6] to-[#062468] p-6 text-center text-white">
          <button
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <Trophy className="h-10 w-10" />
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/90">
            <Sparkles className="h-3.5 w-3.5" /> New challenge
          </div>
          <DialogTitle className="mt-1 text-2xl font-black">OpenPay Feature Quest</DialogTitle>
          <DialogDescription className="mt-1 text-white/90">
            Complete {FEATURE_QUEST_STEPS.length} quick steps to master every OpenPay feature and earn a Founder badge.
          </DialogDescription>
        </div>
        <div className="space-y-2 p-5">
          <Button
            onClick={start}
            className="h-11 w-full rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]"
          >
            Start the challenge <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={dismiss} className="h-10 w-full rounded-full">
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureQuestIntroModal;
