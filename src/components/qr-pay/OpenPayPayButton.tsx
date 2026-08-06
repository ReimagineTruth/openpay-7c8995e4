import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

export type OpenPayBtnStyle = "plain" | "buy" | "pay" | "donate" | "tip" | "checkout";
export type OpenPayBtnTheme = "black" | "white";

export const OPENPAY_BTN_STYLES: {
  id: OpenPayBtnStyle;
  label: string;
  hint: string;
  prefix: string;
}[] = [
  { id: "plain", label: "Plain", hint: "Logo + OpenPay only", prefix: "" },
  { id: "buy", label: "Buy", hint: "Buy with OpenPay", prefix: "Buy with" },
  { id: "pay", label: "Pay", hint: "Pay with OpenPay", prefix: "Pay with" },
  { id: "donate", label: "Donate", hint: "Donate with OpenPay", prefix: "Donate with" },
  { id: "tip", label: "Tip", hint: "Tip with OpenPay", prefix: "Tip with" },
  { id: "checkout", label: "Checkout", hint: "Checkout with OpenPay", prefix: "Checkout with" },
];

export function defaultBtnStyleForPayment(type?: string): OpenPayBtnStyle {
  if (type === "donation" || type === "charity" || type === "crowdfunding" || type === "fundraising" || type === "gift") {
    return "donate";
  }
  if (type === "tip" || type === "split_bill") return "tip";
  if (type === "digital" || type === "product" || type === "digital_product" || type === "download") return "buy";
  if (type === "service" || type === "invoice" || type === "payment_request") return "pay";
  return "pay";
}

/** Apple Pay–style mark: logo mark + “OpenPay” word */
export function OpenPayWordmark({
  variant = "white",
  className,
  logoClassName,
  textClassName,
}: {
  variant?: "color" | "white";
  className?: string;
  logoClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <BrandLogo
        variant={variant}
        animate={false}
        className={cn("h-5 w-5 shrink-0 sm:h-[22px] sm:w-[22px]", logoClassName)}
      />
      <span
        className={cn(
          "text-[17px] font-semibold leading-none tracking-[-0.03em] sm:text-[18px]",
          variant === "white" ? "text-white" : "text-[var(--qrp-ink,#1d1d1f)]",
          textClassName,
        )}
      >
        OpenPay
      </span>
    </span>
  );
}

export function OpenPayStyledButton({
  href,
  style = "pay",
  theme = "black",
  className,
  as: As = "a",
  onClick,
}: {
  href?: string;
  style?: OpenPayBtnStyle;
  theme?: OpenPayBtnTheme;
  className?: string;
  as?: "a" | "button" | "div";
  onClick?: () => void;
}) {
  const meta = OPENPAY_BTN_STYLES.find((s) => s.id === style) || OPENPAY_BTN_STYLES[2];
  const isBlack = theme === "black";
  const wordVariant = isBlack ? "white" : "color";

  const body = (
    <>
      {meta.prefix ? (
        <span
          className={cn(
            "text-[15px] font-medium tracking-[-0.01em] sm:text-[16px]",
            isBlack ? "text-white" : "text-[var(--qrp-ink,#1d1d1f)]",
          )}
        >
          {meta.prefix}
        </span>
      ) : null}
      <OpenPayWordmark
        variant={wordVariant}
        logoClassName="h-[20px] w-[20px] sm:h-[22px] sm:w-[22px]"
        textClassName="text-[17px] sm:text-[18px]"
      />
    </>
  );

  const classes = cn(
    "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] px-6 py-3.5 no-underline transition-opacity hover:opacity-92 active:scale-[0.98] sm:min-h-[52px]",
    isBlack
      ? "bg-[#1d1d1f] text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)]"
      : "bg-white text-[#1d1d1f] ring-1 ring-black/10 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.2)]",
    className,
  );

  if (As === "a") {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes} onClick={onClick}>
        {body}
      </a>
    );
  }
  if (As === "button") {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}

/** HTML fragment for embed snippets (Apple Pay–style) */
export function openPayButtonHtml({
  url,
  logoUrl,
  style,
  theme,
}: {
  url: string;
  logoUrl: string;
  style: OpenPayBtnStyle;
  theme: OpenPayBtnTheme;
}) {
  const meta = OPENPAY_BTN_STYLES.find((s) => s.id === style) || OPENPAY_BTN_STYLES[2];
  const isBlack = theme === "black";
  const bg = isBlack ? "#1d1d1f" : "#ffffff";
  const fg = isBlack ? "#ffffff" : "#1d1d1f";
  const ring = isBlack ? "" : "box-shadow:0 0 0 1px rgba(0,0,0,.1),0 8px 20px -12px rgba(0,0,0,.2);";
  const prefix = meta.prefix
    ? `<span style="font-size:16px;font-weight:500;letter-spacing:-0.01em;color:${fg};">${meta.prefix}</span>`
    : "";

  return `<!-- OpenPay ${meta.label} button -->
<a href="${url}" target="_blank" rel="noopener"
   style="display:inline-flex;align-items:center;justify-content:center;gap:8px;
          background:${bg};color:${fg};min-height:52px;padding:14px 28px;border-radius:12px;
          text-decoration:none;font-family:'Plus Jakarta Sans','SF Pro Display','SF Pro Text',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
          box-shadow:0 8px 20px -10px rgba(0,0,0,.45);${ring}">
  ${prefix}
  <span style="display:inline-flex;align-items:center;gap:7px;">
    <img src="${logoUrl}" alt="" width="22" height="22" style="display:block;flex-shrink:0;" />
    <span style="font-size:18px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:${fg};">OpenPay</span>
  </span>
</a>`;
}
