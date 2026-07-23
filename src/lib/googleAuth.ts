import { supabase } from "@/integrations/supabase/client";

/** App route that completes Supabase OAuth (Google) and stores the session. */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/auth/callback";

export const getGoogleOAuthRedirectUrl = (extraQuery?: Record<string, string>): string => {
  if (typeof window === "undefined") {
    return GOOGLE_OAUTH_CALLBACK_PATH;
  }
  const url = new URL(GOOGLE_OAUTH_CALLBACK_PATH, window.location.origin);
  if (extraQuery) {
    Object.entries(extraQuery).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }
  return url.toString();
};

export type GoogleSignInOptions = {
  /** Optional affiliate / referral code (Sign Up tab). */
  referralCode?: string;
};

/**
 * Starts Google sign-in via Supabase Auth.
 * Requires Google provider enabled in Supabase and redirect URLs allowlisted.
 */
export const signInWithGoogle = async (opts?: GoogleSignInOptions) => {
  const extraQuery: Record<string, string> = {};
  const ref = opts?.referralCode?.trim().toLowerCase();
  if (ref) extraQuery.ref = ref;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getGoogleOAuthRedirectUrl(extraQuery),
      queryParams: {
        access_type: "online",
        prompt: "select_account",
      },
    },
  });

  if (!error && data?.url) {
    window.location.assign(data.url);
  }

  return { data, error };
};
