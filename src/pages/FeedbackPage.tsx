import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquarePlus, Star, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIES = [
  { value: "general", label: "General feedback" },
  { value: "bug", label: "Bug / issue" },
  { value: "feature_request", label: "Feature request" },
  { value: "ui_ux", label: "UI / UX" },
  { value: "performance", label: "Performance" },
  { value: "payments", label: "Payments / wallet" },
  { value: "nft", label: "NFT / Web3" },
  { value: "other", label: "Other" },
];

const feedbackSchema = z.object({
  category: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  feature: z.string().trim().max(80).optional(),
  message: z.string().trim().min(3, "Please write at least 3 characters").max(2000, "Keep it under 2000 characters"),
  contact_email: z
    .string()
    .trim()
    .max(255)
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
});

type FeedbackRow = {
  id: string;
  category: string;
  rating: number;
  feature: string | null;
  message: string;
  status: string;
  admin_note: string;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  reviewed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  in_progress: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  dismissed: "bg-muted text-muted-foreground",
};

const FeedbackPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [category, setCategory] = useState("general");
  const [rating, setRating] = useState(5);
  const [feature, setFeature] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("openpay_feedback" as any)
        .select("id, category, rating, feature, message, status, admin_note, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows((data as unknown as FeedbackRow[]) || []);
      if (auth.user.email && !email) setEmail(auth.user.email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    try {
      window.localStorage.setItem("openpay_feedback_prompt_dismissed", "1");
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const parsed = feedbackSchema.safeParse({
      category,
      rating,
      feature: feature.trim() || undefined,
      message,
      contact_email: email.trim(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please review your inputs");
      return;
    }
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        toast.error("Please sign in first");
        navigate("/sign-in?mode=signin");
        return;
      }
      const { error } = await supabase.from("openpay_feedback" as any).insert({
        user_id: auth.user.id,
        category: parsed.data.category,
        rating: parsed.data.rating,
        feature: parsed.data.feature || null,
        message: parsed.data.message,
        contact_email: parsed.data.contact_email || null,
      });
      if (error) throw error;
      toast.success("Thank you! Your feedback was sent.");
      setMessage("");
      setFeature("");
      setRating(5);
      setCategory("general");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = useMemo(() => message.trim().length >= 3 && !submitting, [message, submitting]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">OpenPay Feedback</h1>
          <p className="text-xs text-muted-foreground">Help us improve — every voice matters.</p>
        </div>
        <MessageSquarePlus className="h-6 w-6 text-paypal-blue" />
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-5">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-bold text-foreground">Share your feedback</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Report a bug, suggest a feature, or tell us what's working well.
          </p>

          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Feature (optional)</Label>
                <Input
                  value={feature}
                  onChange={(e) => setFeature(e.target.value)}
                  placeholder="e.g. NFT store, Top up, QR pay"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Overall rating</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="p-1"
                    aria-label={`Rate ${n} stars`}
                  >
                    <Star
                      className={`h-7 w-7 transition-colors ${
                        n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Your feedback</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What did you like? What can we do better?"
                maxLength={2000}
                rows={5}
              />
              <p className="text-right text-[11px] text-muted-foreground">{message.length}/2000</p>
            </div>

            <div className="space-y-1.5">
              <Label>Contact email (optional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
              />
            </div>

            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="h-11 w-full rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
              ) : (
                "Send feedback"
              )}
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold text-foreground">Your recent feedback</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No feedback yet. Yours will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {row.category.replace(/_/g, " ")}
                        {row.feature ? ` • ${row.feature}` : ""}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < row.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[row.status] || statusStyle.new}`}>
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{row.message}</p>
                  {row.admin_note && (
                    <div className="mt-2 rounded-xl bg-secondary/60 p-2 text-xs text-foreground">
                      <span className="font-semibold text-paypal-blue">Admin: </span>
                      {row.admin_note}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {format(new Date(row.created_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default FeedbackPage;
