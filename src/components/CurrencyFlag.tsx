import { useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";

/** ISO 4217 currency code → ISO 3166-1 alpha-2 / regional flag code for flagcdn */
const CURRENCY_TO_FLAG: Record<string, string> = {
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  JPY: "jp",
  CAD: "ca",
  AUD: "au",
  CHF: "ch",
  CNY: "cn",
  INR: "in",
  MXN: "mx",
  BRL: "br",
  KRW: "kr",
  SGD: "sg",
  HKD: "hk",
  SEK: "se",
  NOK: "no",
  DKK: "dk",
  NZD: "nz",
  ZAR: "za",
  TRY: "tr",
  AED: "ae",
  SAR: "sa",
  PLN: "pl",
  THB: "th",
  PHP: "ph",
  IDR: "id",
  MYR: "my",
  CZK: "cz",
  CLP: "cl",
  NGN: "ng",
  ARS: "ar",
  COP: "co",
  PEN: "pe",
  BOB: "bo",
  UYU: "uy",
  PYG: "py",
  VES: "ve",
  GTQ: "gt",
  HNL: "hn",
  NIO: "ni",
  CRC: "cr",
  PAB: "pa",
  DOP: "do",
  CUP: "cu",
  JMD: "jm",
  TTD: "tt",
  BBD: "bb",
  BSD: "bs",
  XCD: "ag",
  HUF: "hu",
  RON: "ro",
  BGN: "bg",
  RSD: "rs",
  MKD: "mk",
  ALL: "al",
  ISK: "is",
  UAH: "ua",
  BYN: "by",
  RUB: "ru",
  BAM: "ba",
  MDL: "md",
  PKR: "pk",
  BDT: "bd",
  LKR: "lk",
  NPR: "np",
  VND: "vn",
  KHR: "kh",
  LAK: "la",
  MMK: "mm",
  BND: "bn",
  MOP: "mo",
  TWD: "tw",
  MNT: "mn",
  KZT: "kz",
  UZS: "uz",
  TJS: "tj",
  TMT: "tm",
  KGS: "kg",
  IRR: "ir",
  IQD: "iq",
  QAR: "qa",
  KWD: "kw",
  OMR: "om",
  BHD: "bh",
  ILS: "il",
  JOD: "jo",
  LBP: "lb",
  SYP: "sy",
  EGP: "eg",
  MAD: "ma",
  TND: "tn",
  DZD: "dz",
  LYD: "ly",
  SDG: "sd",
  ETB: "et",
  KES: "ke",
  UGX: "ug",
  TZS: "tz",
  RWF: "rw",
  GHS: "gh",
  XOF: "sn",
  XAF: "cm",
  MUR: "mu",
  SCR: "sc",
  MZN: "mz",
  AOA: "ao",
  ZMW: "zm",
  BWP: "bw",
  NAD: "na",
  AFN: "af",
  AMD: "am",
  AZN: "az",
  GEL: "ge",
  FJD: "fj",
  PGK: "pg",
  SBD: "sb",
  VUV: "vu",
  WST: "ws",
  TOP: "to",
  GYD: "gy",
  SRD: "sr",
  AWG: "aw",
  ANG: "cw",
  KYD: "ky",
  BMD: "bm",
  FKP: "fk",
  GIP: "gi",
  SHP: "sh",
  CVE: "cv",
  STN: "st",
  GMD: "gm",
  GNF: "gn",
  SLL: "sl",
  LRD: "lr",
  CDF: "cd",
  BIF: "bi",
  SOS: "so",
  DJF: "dj",
  ERN: "er",
  SSP: "ss",
  MWK: "mw",
  LSL: "ls",
  SZL: "sz",
  MGA: "mg",
  KMF: "km",
  YER: "ye",
  BTN: "bt",
  MVR: "mv",
  HTG: "ht",
  MRU: "mr",
  SVC: "sv",
};

function flagUrl(countryOrRegion: string, size: 40 | 80 = 80) {
  return `https://flagcdn.com/w${size}/${countryOrRegion.toLowerCase()}.png`;
}

export function currencyFlagCode(currencyCode: string): string | null {
  return CURRENCY_TO_FLAG[currencyCode.toUpperCase()] || null;
}

interface CurrencyFlagProps {
  code: string;
  /** Legacy emoji / text flag from currency data (unused when image available) */
  flag?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-[18px] w-[18px]",
  md: "h-7 w-7",
  lg: "h-9 w-9",
} as const;

const logoSize = {
  sm: "h-[14px] w-[14px]",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

/**
 * Reliable currency / brand mark — uses flag images (Windows-safe)
 * instead of emoji regional indicators that render as "US" / "EU" text.
 */
export default function CurrencyFlag({ code, size = "lg", className }: CurrencyFlagProps) {
  const [failed, setFailed] = useState(false);
  const upper = code.toUpperCase();
  const box = sizeMap[size];
  const logo = logoSize[size];

  if (upper === "PI") {
    return (
      <img
        src={PURE_PI_ICON_URL}
        alt="Pure Pi"
        className={cn(box, "shrink-0 rounded-full object-cover ring-1 ring-black/5", className)}
      />
    );
  }

  if (upper === "OUSD" || upper === "OUSD_SOL") {
    return (
      <span
        className={cn(
          box,
          "flex shrink-0 items-center justify-center rounded-full bg-[#007AFF]/12 ring-1 ring-[#007AFF]/15",
          className,
        )}
      >
        <BrandLogo animate={false} className={cn(logo, "text-[#007AFF]")} />
      </span>
    );
  }

  if (upper === "MRWN") {
    return (
      <span
        className={cn(
          box,
          "flex shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-700 ring-1 ring-amber-500/20",
          className,
        )}
      >
        M
      </span>
    );
  }

  const region = currencyFlagCode(upper);
  if (region && !failed) {
    return (
      <span
        className={cn(
          box,
          "relative flex shrink-0 overflow-hidden rounded-full bg-black/[0.04] ring-1 ring-black/8",
          className,
        )}
      >
        <img
          src={flagUrl(region, size === "sm" ? 40 : 80)}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  // Fallback: first two letters in a soft chip
  const letters = upper.slice(0, 2);
  return (
    <span
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[10px] font-bold tracking-wide text-[var(--qrp-ink,#1d1d1f)] ring-1 ring-black/5",
        className,
      )}
    >
      {letters}
    </span>
  );
}
