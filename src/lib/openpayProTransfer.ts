/** OpenPay → OpenPay Pro transfer helpers (client-safe, no secrets). */

export const OPENPAY_PRO_PARTNER_USERNAME = "wainfoundation";

export const normalizeProUsername = (raw: string) => {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  if (/^uid_[a-f0-9-]+$/i.test(cleaned)) return cleaned;
  return cleaned.replace(/^@+/, "").toLowerCase();
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
    .match(/^pro_xfer:(@?[A-Za-z0-9_]+|uid_[a-f0-9-]+):([A-Za-z0-9_-]+)/i);
  if (!match) return null;
  return { to: match[1], ref: match[2] };
};

export const buildProXferNote = (toRaw: string, ref: string) => {
  const to = normalizeProUsername(toRaw);
  const target = to.startsWith("uid_") ? to : `@${to}`;
  return `pro_xfer:${target}:${ref}`;
};

export const makeProXferRef = () =>
  `r_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
