import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  Pickaxe,
  PiggyBank,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";

export type DashboardSection =
  | "wallet"
  | "savings"
  | "credit"
  | "loans"
  | "cards"
  | "buy"
  | "swap"
  | "mining"
  | "analytics";

export type DashboardSectionNavItem = {
  key: DashboardSection;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const DASHBOARD_SECTION_NAV: DashboardSectionNavItem[] = [
  { key: "wallet", label: "Wallet", icon: Wallet, description: "Balances & transfers" },
  { key: "savings", label: "Savings", icon: PiggyBank, description: "Grow & move funds" },
  { key: "credit", label: "Credit", icon: Scale, description: "Score & trust" },
  { key: "loans", label: "Loans", icon: HandCoins, description: "Borrow & repay" },
  { key: "cards", label: "Cards", icon: CreditCard, description: "Virtual checkout" },
  { key: "buy", label: "Buy", icon: CircleDollarSign, description: "Add OpenUSD" },
  { key: "swap", label: "Swap", icon: ArrowLeftRight, description: "Withdraw OUSD" },
  { key: "mining", label: "Mining", icon: Pickaxe, description: "Earn OUSD rewards" },
  { key: "analytics", label: "Analytics", icon: TrendingUp, description: "Insights & trends" },
];

export const DASHBOARD_SECTION_TITLES: Record<DashboardSection, string> = {
  wallet: "Wallet",
  savings: "Savings",
  credit: "Credit Profile",
  loans: "Loans",
  cards: "OpenPay Cards",
  buy: "Buy OpenUSD",
  swap: "Swap & Withdraw",
  mining: "Mining",
  analytics: "Analytics",
};

export const getDashboardSectionSubtitle = (
  section: DashboardSection,
  username?: string | null,
): string => {
  switch (section) {
    case "wallet":
      return username ? `@${username} · Personal & merchant balances` : "Personal & merchant balances";
    case "savings":
      return "Earn yield and move funds between wallet and savings";
    case "credit":
      return "Build your score to unlock loans and higher limits";
    case "loans":
      return "Preview terms, apply, and manage repayments";
    case "cards":
      return "Virtual card linked to your OpenPay wallet";
    case "buy":
      return "Top up with Pi, cards, e-wallets, and more";
    case "swap":
      return "Convert OUSD to PI, OUSD, or MRWN payouts";
    case "mining":
      return "Daily rewards, sessions, and staking boosts";
    case "analytics":
      return "Sent, received, top-ups, and activity trends";
    default:
      return "";
  }
};
