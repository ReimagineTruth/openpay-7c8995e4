import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingPiProfile,
  fetchPiUser,
  parsePiCallbackHash,
  stashPendingPiProfile,
  verifyPiOAuthState,
  type PiOAuthProfile,
} from "@/lib/piOAuth";

type Status =
  | { kind: "loading"; message: string }
  | { kind: "linked"; profile: PiOAuthProfile }
  | { kind: "needs_login"; profile: PiOAuthProfile }
  | { kind: "error"; message: string };

/**
 * NEW, isolated Pi OAuth callback handler.
 * Lives at /auth/pi/callback. Does not interact with /auth/callback (existing).
 */
const PiOAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({
    kind: "loading",
    message: "Verifying Pi sign-in…",
  });

  useEffect(() => {
    document.title = "Pi Sign-In — OpenPay";
    void handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback() {
    try {
      const parsed = parsePiCallbackHash(window.location.hash);

      // Strip the fragment so the access token isn't left in browser history.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );

      if (parsed.error) {
        throw new Error(
          parsed.errorDescription || `Pi sign-in failed: ${parsed.error}`,
        );
      }
      if (!parsed.accessToken) {
        throw new Error("Missing access token in callback URL.");
      }
      if (!verifyPiOAuthState(parsed.state)) {
        throw new Error(
          "Pi sign-in state mismatch. Please try signing in again.",
        );
      }
      if (parsed.expiresIn && parsed.expiresIn <= 0) {
        throw new Error("Pi access token already expired.");
      }

      const user = await fetchPiUser(parsed.accessToken);
      const profile: PiOAuthProfile = {
        uid: user.uid,
        username: user.username,
        accessToken: parsed.accessToken,
        expiresAt:
          Date.now() + Math.max(0, (parsed.expiresIn || 3600)) * 1000,
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;

      if (!currentUserId) {
        // No app session yet — stash the Pi profile so the user can complete
        // linking after they sign in (or sign up) via email/password.
        stashPendingPiProfile(profile);
        setStatus({ kind: "needs_login", profile });
        return;
      }

      await linkPiAccount(currentUserId, profile);
      clearPendingPiProfile();
      setStatus({ kind: "linked", profile });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown Pi sign-in error";
      setStatus({ kind: "error", message });
    }
  }

  async function linkPiAccount(userId: string, profile: PiOAuthProfile) {
    const payload = {
      user_id: userId,
      pi_uid: profile.uid,
      pi_username: profile.username,
      linked_via: "oauth_implicit",
      last_authenticated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("pi_accounts")
      .upsert(payload as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-10 pb-10">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6">
        {status.kind === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-paypal-blue" />
            <p className="text-sm text-muted-foreground">{status.message}</p>
          </div>
        )}

        {status.kind === "linked" && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-foreground">
              Pi account linked
            </h1>
            <p className="text-sm text-muted-foreground">
              Connected as{" "}
              <span className="font-semibold text-foreground">
                @{status.profile.username}
              </span>{" "}
              ({status.profile.uid}).
            </p>
            <Button
              className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
              onClick={() => navigate("/dashboard")}
            >
              Continue to OpenPay
            </Button>
          </div>
        )}

        {status.kind === "needs_login" && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-foreground">
              Almost there — sign in to link
            </h1>
            <p className="text-sm text-muted-foreground">
              Pi verified <strong>@{status.profile.username}</strong>. Sign in
              with your existing OpenPay email/password (or create one), and we
              will link this Pi account automatically.
            </p>
            <Button
              className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
              onClick={() => navigate("/sign-in?mode=signin")}
            >
              Continue with email
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-2xl"
              onClick={() => navigate("/sign-in?mode=signup")}
            >
              Create an OpenPay account
            </Button>
          </div>
        )}

        {status.kind === "error" && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-foreground">
              Pi sign-in failed
            </h1>
            <p className="text-sm text-destructive">{status.message}</p>
            <Button
              variant="outline"
              className="h-11 w-full rounded-2xl"
              onClick={() => navigate("/auth/pi/login")}
            >
              Try again
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full rounded-2xl"
              onClick={() => navigate("/auth")}
            >
              Back to sign-in options
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PiOAuthCallbackPage;
