/** Default home after auth. */
export const POST_AUTH_HOME = "/dashboard";

const AUTH_LANDING_PATHS = new Set([
  "/",
  "/auth",
  "/sign-in",
  "/signin",
  "/signup",
  "/auth/callback",
  "/auth/phantom/callback",
  "/auth/pi/login",
  "/auth/pi/callback",
  "/admin-mrwain",
  "/forgot-password",
  "/forgot-mpin",
  "/reset-password",
  "/two-factor",
  "/two-factor-verify",
]);

export const isAuthLandingPath = (pathname: string): boolean => {
  const path = (pathname || "/").split("?")[0] || "/";
  return AUTH_LANDING_PATHS.has(path);
};
