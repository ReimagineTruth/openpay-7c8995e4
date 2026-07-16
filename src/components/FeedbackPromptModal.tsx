import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const DISMISS_KEY = "openpay_feedback_prompt_dismissed";
const SNOOZE_KEY = "openpay_feedback_prompt_snoozed_at";
const SNOOZE_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

const FeedbackPromptModal = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
      const snoozedAt = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
      if (snoozedAt && Date.now() - snoozedAt < SNOOZE_MS) return;
      const t = setTimeout(() => setOpen(true), 4000);
      return () => clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, []);

  const snooze = () => {
    try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* ignore */ }
    setOpen(false);
  };

  const dismissForever = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const goToFeedback = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
    navigate("/feedback");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? snooze() : setOpen(v))}>
      <DialogContent showCloseButton={false} className="max-w-sm overflow-hidden rounded-3xl p-0">
        <div className="relative bg-gradient-to-br from-paypal-blue via-[#0a56d6] to-[#062468] p-6 text-center text-white">
          <button
            onClick={snooze}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <MessageSquarePlus className="h-10 w-10" />
          </div>
          <DialogTitle className="mt-3 text-2xl font-black">How's OpenPay going?</DialogTitle>
          <DialogDescription className="mt-1 text-white/90">
            Share a quick thought — bugs, ideas, or wins. Your feedback shapes what we build next.
          </DialogDescription>
        </div>
        <div className="space-y-2 p-5">
          <Button onClick={goToFeedback} className="h-11 w-full rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]">
            Give feedback <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={snooze} className="h-10 w-full rounded-full">
            Maybe later
          </Button>
          <button onClick={dismissForever} className="mx-auto block text-[11px] text-muted-foreground hover:underline">
            Don't ask again
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackPromptModal;
