import { cn } from "@/lib/utils";
import { buildOpenPayAuthorizeUrl, createOpenPayAuthState } from "@/lib/openpayAuth";

type Props = {
  clientId: string;
  redirectUri: string;
  scope?: string | string[];
  state?: string;
  /** Persist state to sessionStorage under this key before redirect (CSRF). */
  stateStorageKey?: string;
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

/**
 * Drop-in "Sign in with OpenPay" button for third-party apps.
 * Renders an anchor that starts the OAuth Authorization Code flow at /connect.
 */
export function OpenPayAuthButton({
  clientId,
  redirectUri,
  scope = "profile",
  state,
  stateStorageKey = "openpay_oauth_state",
  className,
  label = "Sign in with OpenPay",
  size = "md",
  fullWidth = false,
}: Props) {
  const resolvedState = state || createOpenPayAuthState();
  const href = buildOpenPayAuthorizeUrl({
    clientId,
    redirectUri,
    scope,
    state: resolvedState,
  });

  const sizeClass =
    size === "sm"
      ? "px-3 py-2 text-sm gap-2"
      : size === "lg"
        ? "px-6 py-3.5 text-base gap-3"
        : "px-5 py-3 text-sm gap-2.5";

  return (
    <a
      href={href}
      onClick={() => {
        try {
          sessionStorage.setItem(stateStorageKey, resolvedState);
        } catch {
          // ignore
        }
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold text-white no-underline transition hover:brightness-110 active:scale-[0.98]",
        "bg-[#1652f0] shadow-md shadow-blue-900/20",
        sizeClass,
        fullWidth && "w-full",
        className,
      )}
    >
      <img
        src="/openpay-o-white.svg"
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 object-contain"
      />
      {label}
    </a>
  );
}

export default OpenPayAuthButton;
