import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

export type OpenPayBtnStyle = "plain" | "buy" | "pay" | "donate" | "tip" | "checkout";
export type OpenPayBtnTheme =
  | "black"
  | "white"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "gray";

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

export const OPENPAY_BTN_THEMES: {
  id: OpenPayBtnTheme;
  label: string;
  bg: string;
  fg: string;
  /** Tailwind swatch for the color picker */
  swatch: string;
  /** White mark on dark/saturated fills; color mark on white */
  wordVariant: "color" | "white";
  /** Dark preview canvas so light buttons read clearly */
  previewDark: boolean;
  ring?: boolean;
}[] = [
  {
    id: "black",
    label: "Black",
    bg: "#1d1d1f",
    fg: "#ffffff",
    swatch: "bg-[var(--qrp-ink)]",
    wordVariant: "white",
    previewDark: false,
  },
  {
    id: "white",
    label: "White",
    bg: "#ffffff",
    fg: "#1d1d1f",
    swatch: "bg-white ring-1 ring-black/15",
    wordVariant: "color",
    previewDark: true,
    ring: true,
  },
  {
    id: "blue",
    label: "Blue",
    bg: "#007AFF",
    fg: "#ffffff",
    swatch: "bg-[#007AFF]",
    wordVariant: "white",
    previewDark: false,
  },
  {
    id: "green",
    label: "Green",
    bg: "#34C759",
    fg: "#ffffff",
    swatch: "bg-[#34C759]",
    wordVariant: "white",
    previewDark: false,
  },
  {
    id: "orange",
    label: "Orange",
    bg: "#FF9500",
    fg: "#ffffff",
    swatch: "bg-[#FF9500]",
    wordVariant: "white",
    previewDark: false,
  },
  {
    id: "red",
    label: "Red",
    bg: "#FF3B30",
    fg: "#ffffff",
    swatch: "bg-[#FF3B30]",
    wordVariant: "white",
    previewDark: false,
  },
  {
    id: "gray",
    label: "Gray",
    bg: "#8E8E93",
    fg: "#ffffff",
    swatch: "bg-[#8E8E93]",
    wordVariant: "white",
    previewDark: false,
  },
];

export function getOpenPayBtnTheme(theme: OpenPayBtnTheme = "black") {
  return OPENPAY_BTN_THEMES.find((t) => t.id === theme) || OPENPAY_BTN_THEMES[0];
}

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
  const tone = getOpenPayBtnTheme(theme);
  const lightOnFill = tone.wordVariant === "white";

  const body = (
    <>
      {meta.prefix ? (
        <span
          className={cn(
            "text-[15px] font-medium tracking-[-0.01em] sm:text-[16px]",
            lightOnFill ? "text-white" : "text-[var(--qrp-ink,#1d1d1f)]",
          )}
        >
          {meta.prefix}
        </span>
      ) : null}
      <OpenPayWordmark
        variant={tone.wordVariant}
        logoClassName="h-[20px] w-[20px] sm:h-[22px] sm:w-[22px]"
        textClassName="text-[17px] sm:text-[18px]"
      />
    </>
  );

  const classes = cn(
    "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] px-6 py-3.5 no-underline transition-opacity hover:opacity-92 active:scale-[0.98] sm:min-h-[52px]",
    tone.ring
      ? "ring-1 ring-black/10 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.2)]"
      : "shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)]",
    className,
  );

  const styleAttr = { backgroundColor: tone.bg, color: tone.fg };

  if (As === "a") {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes} style={styleAttr} onClick={onClick}>
        {body}
      </a>
    );
  }
  if (As === "button") {
    return (
      <button type="button" className={classes} style={styleAttr} onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <div className={classes} style={styleAttr}>
      {body}
    </div>
  );
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
  const tone = getOpenPayBtnTheme(theme);
  const ring = tone.ring
    ? "box-shadow:0 0 0 1px rgba(0,0,0,.1),0 8px 20px -12px rgba(0,0,0,.2);"
    : "box-shadow:0 8px 20px -10px rgba(0,0,0,.45);";
  const prefix = meta.prefix
    ? `<span style="font-size:16px;font-weight:500;letter-spacing:-0.01em;color:${tone.fg};">${meta.prefix}</span>`
    : "";

  return `<!-- OpenPay ${meta.label} button -->
<a href="${url}" target="_blank" rel="noopener"
   style="display:inline-flex;align-items:center;justify-content:center;gap:8px;
          background:${tone.bg};color:${tone.fg};min-height:52px;padding:14px 28px;border-radius:12px;
          text-decoration:none;font-family:'Plus Jakarta Sans','SF Pro Display','SF Pro Text',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
          ${ring}">
  ${prefix}
  <span style="display:inline-flex;align-items:center;gap:7px;">
    <img src="${logoUrl}" alt="" width="22" height="22" style="display:block;flex-shrink:0;" />
    <span style="font-size:18px;font-weight:600;letter-spacing:-0.03em;line-height:1;color:${tone.fg};">OpenPay</span>
  </span>
</a>`;
}
