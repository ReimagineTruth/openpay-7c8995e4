import {
  Wallet,
  Send,
  QrCode,
  CircleDollarSign,
  PiggyBank,
  CreditCard,
  Pickaxe,
  Store,
  Users,
  ShieldCheck,
  ArrowLeftRight,
  Bot,
  TrendingUp,
  FileText,
  BookOpen,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export type FeatureQuestStep = {
  id: string;
  title: string;
  description: string;
  cta: string;
  route: string;
  icon: LucideIcon;
  category: "Essentials" | "Grow" | "Earn" | "Business" | "Advanced";
};

export const FEATURE_QUEST_STEPS: FeatureQuestStep[] = [
  {
    id: "wallet",
    title: "Explore your Wallet",
    description: "See your balance, recent activity and quick actions in one place.",
    cta: "Open wallet",
    route: "/dashboard",
    icon: Wallet,
    category: "Essentials",
  },
  {
    id: "send",
    title: "Send your first payment",
    description: "Pay any OpenPay user instantly by @username, contact or wallet.",
    cta: "Try Send",
    route: "/send",
    icon: Send,
    category: "Essentials",
  },
  {
    id: "receive",
    title: "Receive with QR Pay",
    description: "Get paid with a personal QR code — no wallet address needed.",
    cta: "Open QR Pay",
    route: "/qr-pay",
    icon: QrCode,
    category: "Essentials",
  },
  {
    id: "buy",
    title: "Top up OpenUSD",
    description: "Add funds with Pi, cards, e-wallets, USDT, USDC and more.",
    cta: "Buy OpenUSD",
    route: "/topup",
    icon: CircleDollarSign,
    category: "Essentials",
  },
  {
    id: "kyc",
    title: "Verify your identity",
    description: "Complete KYC to unlock higher limits, loans and merchant tools.",
    cta: "Start KYC",
    route: "/kyc",
    icon: UserCheck,
    category: "Essentials",
  },
  {
    id: "2fa",
    title: "Turn on Two-Factor Auth",
    description: "Protect your account with an extra layer of security.",
    cta: "Enable 2FA",
    route: "/two-factor",
    icon: ShieldCheck,
    category: "Essentials",
  },
  {
    id: "savings",
    title: "Grow with Savings",
    description: "Move funds into savings and earn daily interest automatically.",
    cta: "Open Savings",
    route: "/dashboard?section=savings",
    icon: PiggyBank,
    category: "Grow",
  },
  {
    id: "swap",
    title: "Swap & Withdraw",
    description: "Convert OUSD to PI or MRWN and withdraw to your wallet.",
    cta: "Try Swap",
    route: "/swap-withdrawal",
    icon: ArrowLeftRight,
    category: "Grow",
  },
  {
    id: "card",
    title: "Activate a Virtual Card",
    description: "Spend your OpenPay balance anywhere online in seconds.",
    cta: "Get card",
    route: "/virtual-card",
    icon: CreditCard,
    category: "Grow",
  },
  {
    id: "mining",
    title: "Start daily Mining",
    description: "Earn OUSD rewards every 24 hours via Pi Ad Network.",
    cta: "Open Mining",
    route: "/mining",
    icon: Pickaxe,
    category: "Earn",
  },
  {
    id: "affiliate",
    title: "Invite friends",
    description: "Share your affiliate link and earn on every referral.",
    cta: "Open Affiliate",
    route: "/affiliate",
    icon: Users,
    category: "Earn",
  },
  {
    id: "analytics",
    title: "See your Analytics",
    description: "Track sent, received, top-ups and spending trends.",
    cta: "View analytics",
    route: "/dashboard?section=analytics",
    icon: TrendingUp,
    category: "Grow",
  },
  {
    id: "merchant",
    title: "Become a Merchant",
    description: "Accept payments in-store with POS, catalog and payment links.",
    cta: "Open Merchant",
    route: "/merchant-onboarding",
    icon: Store,
    category: "Business",
  },
  {
    id: "invoice",
    title: "Send an Invoice",
    description: "Bill customers with a professional OpenPay invoice.",
    cta: "New invoice",
    route: "/send-invoice",
    icon: FileText,
    category: "Business",
  },
  {
    id: "ai",
    title: "Chat with OpenPay AI",
    description: "Get instant help and smart actions from the built-in assistant.",
    cta: "Open AI",
    route: "/ai",
    icon: Bot,
    category: "Advanced",
  },
  {
    id: "ledger",
    title: "Peek at the OpenLedger",
    description: "See the transparent public ledger of OpenPay activity.",
    cta: "Open Ledger",
    route: "/ledger",
    icon: BookOpen,
    category: "Advanced",
  },
];

export const FEATURE_QUEST_STORAGE_KEY = "openpay:feature-quest:completed:v1";
export const FEATURE_QUEST_INTRO_KEY = "openpay:feature-quest:intro-dismissed:v1";
export const FEATURE_QUEST_CLAIMED_KEY = "openpay:feature-quest:claimed:v1";

export function getCompletedSteps(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FEATURE_QUEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function markStepCompleted(id: string): string[] {
  const list = new Set(getCompletedSteps());
  list.add(id);
  const arr = Array.from(list);
  try {
    window.localStorage.setItem(FEATURE_QUEST_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
  return arr;
}

export function resetFeatureQuest() {
  try {
    window.localStorage.removeItem(FEATURE_QUEST_STORAGE_KEY);
    window.localStorage.removeItem(FEATURE_QUEST_CLAIMED_KEY);
  } catch {
    /* ignore */
  }
}
