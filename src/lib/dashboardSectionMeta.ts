import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Brain,
  CircleDollarSign,
  
  HandCoins,
  Paintbrush,
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

export type DashboardNavKey = DashboardSection | "opennft" | "ai" | "pro";

export type DashboardSectionNavItem = {
  key: DashboardNavKey;
  label: string;
  icon: LucideIcon;
  description: string;
  /** When set, tab navigates to this route instead of switching a dashboard section. */
  href?: string;
};

export const DASHBOARD_SECTION_NAV: DashboardSectionNavItem[] = [
  { key: "wallet", label: "Wallet", icon: Wallet, description: "Balances & transfers" },
  { key: "savings", label: "Savings", icon: PiggyBank, description: "Grow & move funds" },
  { key: "credit", label: "Credit", icon: Scale, description: "Score & trust" },
  { key: "loans", label: "Loans", icon: HandCoins, description: "Borrow & repay" },
  
  { key: "buy", label: "Buy", icon: CircleDollarSign, description: "Add OpenUSD" },
  { key: "swap", label: "Withdraw OUSD", icon: ArrowLeftRight, description: "OUSD payout" },
  { key: "mining", label: "Mining", icon: Pickaxe, description: "Earn OUSD rewards" },
  { key: "analytics", label: "Analytics", icon: TrendingUp, description: "Insights & trends" },
  { key: "ai", label: "AI", icon: Brain, description: "Financial assistant", href: "/ai" },
  { key: "opennft", label: "OpenNFT", icon: Paintbrush, description: "NFT marketplace", href: "/web3/nft" },
  {
    key: "pro",
    label: "OpenPay Pro",
    icon: BadgeCheck,
    description: "Pro wallet",
    href: "https://openpaypro.space/",
  },
];

export const DASHBOARD_SECTION_TITLES: Record<DashboardSection, string> = {
  wallet: "Wallet",
  savings: "Savings",
  credit: "Credit Profile",
  loans: "Loans",
  cards: "OpenPay Cards",
  buy: "Buy OpenUSD",
  swap: "Withdraw OUSD",
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
