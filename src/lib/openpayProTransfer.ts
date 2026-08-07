/** OpenPay → OpenPay Pro transfer helpers (client-safe, no secrets). */

export const OPENPAY_PRO_PARTNER_USERNAME = "wainfoundation";

/** Pro EVM-style wallet: 0x + 40 hex chars */
export const PRO_WALLET_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const isProWalletAddress = (raw: string) => PRO_WALLET_ADDRESS_RE.test(String(raw || "").trim());

export const looksLikeProWalletInput = (raw: string) =>
  String(raw || "").trim().toLowerCase().startsWith("0x");

export type ProDestinationKind = "username" | "wallet" | "uid" | "invalid" | "empty";

export const classifyProDestination = (raw: string): ProDestinationKind => {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "empty";
  if (looksLikeProWalletInput(cleaned)) {
    return isProWalletAddress(cleaned) ? "wallet" : "invalid";
  }
  if (/^uid_[a-f0-9-]+$/i.test(cleaned)) return "uid";
  const username = cleaned.replace(/^@+/, "");
  if (/^[a-z0-9_]{3,32}$/i.test(username)) return "username";
  return "invalid";
};

/** Normalize Pro destination: wallet (lowercase), uid_, or username without @. */
export const normalizeProDestination = (raw: string) => {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  if (isProWalletAddress(cleaned)) return cleaned.toLowerCase();
  if (/^uid_[a-f0-9-]+$/i.test(cleaned)) return cleaned;
  return cleaned.replace(/^@+/, "").toLowerCase();
};

/** @deprecated use normalizeProDestination */
export const normalizeProUsername = normalizeProDestination;

export const formatProDestinationPreview = (raw: string) => {
  const kind = classifyProDestination(raw);
  const normalized = normalizeProDestination(raw);
  if (!normalized) return "";
  if (kind === "wallet") {
    return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
  }
  if (kind === "uid") return normalized;
  return `@${normalized}`;
};

export const formatProDestinationForApi = (raw: string) => {
  const kind = classifyProDestination(raw);
  const normalized = normalizeProDestination(raw);
  if (!normalized) return "";
  if (kind === "wallet" || kind === "uid") return normalized;
  return `@${normalized}`;
};

export const isProXferNote = (note: string) =>
  String(note || "").trim().toLowerCase().startsWith("pro_xfer:");

export const isProTopupNote = (note: string) =>
  String(note || "").trim().toLowerCase().startsWith("pro_topup_");

export const isOpenPayProPartnerNote = (note: string) =>
  isProXferNote(note) || isProTopupNote(note);

export const parseProXferNote = (note: string): { to: string; ref: string } | null => {
  const match = String(note || "")
    .trim()
    .match(
      /^pro_xfer:(0x[a-fA-F0-9]{40}|@?[A-Za-z0-9_]+|uid_[a-f0-9-]+):([A-Za-z0-9_-]+)/i,
    );
  if (!match) return null;
  return { to: match[1], ref: match[2] };
};

export const buildProXferNote = (toRaw: string, ref: string) => {
  const target = formatProDestinationForApi(toRaw);
  return `pro_xfer:${target}:${ref}`;
};

export const makeProXferRef = () =>
  `r_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const getProDestinationError = (raw: string): string | null => {
  const kind = classifyProDestination(raw);
  if (kind === "empty") return "Enter a Pro @username or 0x wallet address.";
  if (kind === "invalid" && looksLikeProWalletInput(raw)) {
    return "Invalid Pro wallet address. Use 0x followed by 40 hex characters.";
  }
  if (kind === "invalid") return "Invalid OpenPay Pro username.";
  return null;
};

/** Pull a Pro @username or 0x wallet from a scanned QR payload. */
export const extractProDestinationFromQr = (raw: string): string | null => {
  const value = String(raw || "").trim();
  if (!value) return null;

  const walletMatch = value.match(/0x[a-fA-F0-9]{40}/);
  if (walletMatch) return walletMatch[0].toLowerCase();

  const ethMatch = value.match(/^ethereum:(0x[a-fA-F0-9]{40})/i);
  if (ethMatch) return ethMatch[1].toLowerCase();

  try {
    const url = new URL(value);
    const candidates = [
      url.searchParams.get("wallet"),
      url.searchParams.get("address"),
      url.searchParams.get("to"),
      url.searchParams.get("username"),
      url.searchParams.get("pro"),
      url.searchParams.get("pro_to"),
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (isProWalletAddress(candidate)) return candidate.toLowerCase();
      const username = candidate.replace(/^@+/, "").trim();
      if (/^[a-z0-9_]{3,32}$/i.test(username)) return `@${username.toLowerCase()}`;
    }
    const pathUser = url.pathname.split("/").filter(Boolean).pop();
    if (pathUser) {
      const username = pathUser.replace(/^@+/, "").trim();
      if (/^[a-z0-9_]{3,32}$/i.test(username) && !/^(pay|send|transfer|pro)$/i.test(username)) {
        return `@${username.toLowerCase()}`;
      }
    }
  } catch {
    // not a URL
  }

  if (/^@?[a-z0-9_]{3,32}$/i.test(value)) {
    return `@${value.replace(/^@+/, "").toLowerCase()}`;
  }

  if (/^uid_[a-f0-9-]+$/i.test(value)) return value;

  const atMatch = value.match(/@[a-z0-9_]{3,32}/i);
  if (atMatch) return atMatch[0].toLowerCase();

  return null;
};

/** Assets a buyer can pay with from their OpenPay Pro wallet. */
export const PRO_PAY_ASSETS = [
  { key: "OUSD", label: "OUSD", hint: "OpenPay Pro balance" },
  { key: "USDT", label: "USDT", hint: "Pro wallet USDT → OUSD 1:1" },
  { key: "USDC", label: "USDC", hint: "Pro wallet USDC → OUSD 1:1" },
  { key: "SOL", label: "SOL", hint: "Live Solana price → OUSD" },
  { key: "PI", label: "Pi (π)", hint: "Live π price → OUSD" },
] as const;

export type ProPayAsset = (typeof PRO_PAY_ASSETS)[number]["key"];

export const PRO_TOPUP_URL = "https://openpaypro.space/topup";

/** Hosted OpenPay Pro pay link the buyer opens to pay a merchant destination. */
export const buildProPayUrl = (opts: {
  to: string;
  amount: number;
  asset?: ProPayAsset | string;
  note?: string;
  /** Return here after Pro payment (Pro may honor success_url / return_url). */
  successUrl?: string;
}) => {
  const dest = formatProDestinationForApi(opts.to);
  if (!dest) return "";
  const url = new URL(`https://openpaypro.space/pay/${encodeURIComponent(dest)}`);
  url.searchParams.set("amount", String(Number(opts.amount || 0).toFixed(2)));
  url.searchParams.set("asset", String(opts.asset || "OUSD"));
  if (opts.note) url.searchParams.set("note", opts.note);
  if (opts.successUrl) {
    url.searchParams.set("success_url", opts.successUrl);
    url.searchParams.set("return_url", opts.successUrl);
  }
  return url.toString();
};
