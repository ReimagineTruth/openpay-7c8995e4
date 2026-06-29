import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingPiProfile,
  isPiOAuthEnabled,
  readPendingPiProfile,
} from "@/lib/piOAuth";

/**
 * Mount once near the top of the app. If a Pi OAuth profile was stashed
 * (because the user did Pi OAuth before having an app session) AND a
 * Lovable Cloud session is now active, link the Pi account to that user.
 *
 * Safe no-op when the feature flag is off or nothing is stashed.
 */
export function usePiOAuthAutoLink() {
  useEffect(() => {
    if (!isPiOAuthEnabled()) return;

    const tryLink = async (userId: string) => {
      const pending = readPendingPiProfile();
      if (!pending) return;
      if (pending.expiresAt && pending.expiresAt < Date.now()) {
        clearPendingPiProfile();
        return;
      }
      try {
        const { error } = await supabase
          .from("pi_accounts")
          .upsert(
            {
              user_id: userId,
              pi_uid: pending.uid,
              pi_username: pending.username,
              linked_via: "oauth_implicit",
              last_authenticated_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id" },
          );
        if (!error) clearPendingPiProfile();
      } catch {
        // best-effort; keep stash so user can retry from /auth/pi/callback
      }
    };

    // 1) Link immediately if already signed in.
    supabase.auth.getSession().then(({ data }) => {
      const uid = data?.session?.user?.id;
      if (uid) void tryLink(uid);
    });

    // 2) Link as soon as a session becomes available.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id;
      if (uid) void tryLink(uid);
    });

    return () => sub.subscription.unsubscribe();
  }, []);
}
