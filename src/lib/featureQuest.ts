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
  Coins,
  ShieldAlert,
  Pointer,
  Smartphone,
  Handshake,
  Bell,
  Settings,
  Image,
  Palette,
  Trophy,
  Gift,
  MessageSquare,
  ScanLine,
  DollarSign,
  Package,
  Monitor,
  Clapperboard,
  Sparkles,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type FeatureQuestStep = {
  id: string;
  title: string;
  description: string;
  cta: string;
  route: string;
  icon: LucideIcon;
  category: "Essentials" | "Payments" | "Grow" | "Earn" | "Merchant" | "NFT & Web3" | "Developer" | "Account";
};

export const FEATURE_QUEST_STEPS: FeatureQuestStep[] = [
  // Essentials
  { id: "wallet", title: "Explore your Wallet", description: "See your balance, recent activity and quick actions in one place.", cta: "Open wallet", route: "/dashboard", icon: Wallet, category: "Essentials" },
  { id: "profile", title: "Complete your Profile", description: "Add your name, username and avatar so people can find you.", cta: "Open profile", route: "/profile", icon: Users, category: "Essentials" },
  { id: "kyc", title: "Verify your Identity", description: "Complete KYC to unlock higher limits, loans and merchant tools.", cta: "Start KYC", route: "/kyc", icon: UserCheck, category: "Essentials" },
  { id: "2fa", title: "Turn on Two-Factor Auth", description: "Protect your account with an extra layer of security.", cta: "Enable 2FA", route: "/two-factor", icon: ShieldCheck, category: "Essentials" },
  { id: "notifications", title: "Enable Notifications", description: "Get real-time alerts for payments, requests and rewards.", cta: "Open notifications", route: "/notifications", icon: Bell, category: "Essentials" },
  { id: "settings", title: "Personalize Settings", description: "Set your currency, language and privacy preferences.", cta: "Open settings", route: "/settings", icon: Settings, category: "Essentials" },

  // Payments
  { id: "send", title: "Send your first payment", description: "Pay any OpenPay user instantly by @username or wallet.", cta: "Try Send", route: "/send", icon: Send, category: "Payments" },
  { id: "receive", title: "Receive money", description: "Share your handle or QR code to get paid in seconds.", cta: "Open Receive", route: "/receive", icon: DollarSign, category: "Payments" },
  { id: "request", title: "Request a payment", description: "Ask friends or clients to pay you with a shareable link.", cta: "New request", route: "/request-payment", icon: CircleDollarSign, category: "Payments" },
  { id: "invoice", title: "Send an Invoice", description: "Bill customers with a professional OpenPay invoice.", cta: "New invoice", route: "/send-invoice", icon: FileText, category: "Payments" },
  { id: "scan", title: "Scan a QR code", description: "Pay merchants and users instantly by scanning a QR.", cta: "Open Scanner", route: "/scan-qr", icon: ScanLine, category: "Payments" },
  { id: "contacts", title: "Add Contacts", description: "Save your frequent payees for one-tap payments.", cta: "Open Contacts", route: "/contacts", icon: Users, category: "Payments" },
  { id: "converter", title: "Try the Currency Converter", description: "Convert between 30+ supported currencies in real time.", cta: "Convert", route: "/currency-converter", icon: ArrowLeftRight, category: "Payments" },

  // Grow — top up & swap
  { id: "buy", title: "Top up OpenUSD", description: "Add funds with Pi, cards, e-wallets, USDT, USDC and more.", cta: "Buy OpenUSD", route: "/topup", icon: CircleDollarSign, category: "Grow" },
  { id: "topup-history", title: "View Top-Up History", description: "Track every top-up across every payment provider.", cta: "Open history", route: "/topup-history", icon: BookOpen, category: "Grow" },
  { id: "swap", title: "Swap & Withdraw", description: "Convert OUSD to PI or MRWN and withdraw to your wallet.", cta: "Try Swap", route: "/swap-withdrawal", icon: ArrowLeftRight, category: "Grow" },
  { id: "savings", title: "Grow with Savings", description: "Move funds into savings and earn daily interest automatically.", cta: "Open Savings", route: "/dashboard?section=savings", icon: PiggyBank, category: "Grow" },
  { id: "card", title: "Activate a Virtual Card", description: "Spend your OpenPay balance anywhere online in seconds.", cta: "Get card", route: "/virtual-card", icon: CreditCard, category: "Grow" },
  { id: "analytics", title: "See your Analytics", description: "Track sent, received, top-ups and spending trends.", cta: "View analytics", route: "/dashboard?section=analytics", icon: TrendingUp, category: "Grow" },

  // Earn
  { id: "mining", title: "Start daily Mining", description: "Earn OUSD rewards every 24 hours via Pi Ad Network.", cta: "Open Mining", route: "/mining", icon: Pickaxe, category: "Earn" },
  { id: "staking", title: "Stake for yield", description: "Lock OUSD in staking positions and earn passive rewards.", cta: "Open Staking", route: "/staking", icon: Coins, category: "Earn" },
  { id: "affiliate", title: "Invite friends", description: "Share your affiliate link and earn on every referral.", cta: "Open Affiliate", route: "/affiliate", icon: Handshake, category: "Earn" },
  { id: "pi-ads", title: "Watch a Pi Ad", description: "Support the ecosystem and boost your mining rewards.", cta: "Open Ads", route: "/pi-ads", icon: Clapperboard, category: "Earn" },

  // Merchant
  { id: "merchant", title: "Become a Merchant", description: "Onboard your business and unlock merchant tools.", cta: "Start onboarding", route: "/merchant-onboarding", icon: Store, category: "Merchant" },
  { id: "products", title: "Create a Product", description: "List products in your OpenPay catalog for checkout.", cta: "Open catalog", route: "/merchant-products", icon: Package, category: "Merchant" },
  { id: "pos", title: "Try Merchant POS", description: "Accept in-person payments with the OpenPay POS terminal.", cta: "Open POS", route: "/merchant-pos", icon: Monitor, category: "Merchant" },
  { id: "payment-link", title: "Create a Payment Link", description: "Get paid with a link — no code required.", cta: "New link", route: "/payment-links/create", icon: FileText, category: "Merchant" },
  { id: "qr-pay", title: "Launch QR Pay", description: "Generate a branded QR code for your storefront.", cta: "Open QR Pay", route: "/qr-pay", icon: QrCode, category: "Merchant" },
  { id: "buttons", title: "Add Pay Buttons", description: "Drop-in OpenPay buttons for websites and apps.", cta: "Get buttons", route: "/buttons", icon: Pointer, category: "Merchant" },
  { id: "remittance", title: "Open a Remittance Center", description: "Become an agent and process cross-border payouts.", cta: "Open Remittance", route: "/remittance-merchant", icon: Handshake, category: "Merchant" },

  // NFT & Web3
  { id: "nft-market", title: "Browse the NFT Marketplace", description: "Discover trending drops from OpenPay creators.", cta: "Open marketplace", route: "/web3/nft", icon: Image, category: "NFT & Web3" },
  { id: "nft-create", title: "Mint your first NFT", description: "Turn your art into a collectible with one tap.", cta: "Create NFT", route: "/web3/nft/create", icon: Palette, category: "NFT & Web3" },
  { id: "nft-store", title: "Set up your NFT Store", description: "Customize your creator storefront and start selling.", cta: "Open store", route: "/web3/nft/store", icon: Store, category: "NFT & Web3" },
  { id: "nft-stores", title: "Follow Top Creators", description: "Browse NFT stores and follow your favorite artists.", cta: "Explore stores", route: "/web3/nft/stores", icon: Sparkles, category: "NFT & Web3" },
  { id: "nft-chat", title: "Join the NFT Chat", description: "Talk with creators and collectors in real time.", cta: "Open chat", route: "/web3/nft/chat", icon: MessageSquare, category: "NFT & Web3" },
  { id: "nft-howto", title: "Learn NFT How-To", description: "Master minting, listing and selling on OpenPay.", cta: "Read guide", route: "/web3/nft/how-to", icon: BookOpen, category: "NFT & Web3" },

  // Developer
  { id: "developer", title: "Open Developer Dashboard", description: "Create API keys and manage your OpenPay apps.", cta: "Open dashboard", route: "/app-developer-dashboard", icon: Smartphone, category: "Developer" },
  { id: "ledger", title: "Peek at the OpenLedger", description: "See the transparent public ledger of OpenPay activity.", cta: "Open Ledger", route: "/ledger", icon: BookOpen, category: "Developer" },
  { id: "smart-contract", title: "Explore Smart Contract API", description: "Integrate OpenPay into your dApps and contracts.", cta: "Open API", route: "/smart-contract-api", icon: FileText, category: "Developer" },
  { id: "api-docs", title: "Read the API Docs", description: "Everything you need to build on OpenPay.", cta: "Open docs", route: "/openpay-api-docs", icon: BookOpen, category: "Developer" },

  // Account & support
  { id: "ai", title: "Chat with OpenPay AI", description: "Get instant help and smart actions from the built-in assistant.", cta: "Open AI", route: "/ai", icon: Bot, category: "Account" },
  { id: "activity", title: "Review Activity", description: "Browse every transaction and download receipts.", cta: "Open activity", route: "/activity", icon: TrendingUp, category: "Account" },
  { id: "disputes", title: "File a Dispute", description: "Learn how to raise a claim with a transaction ID.", cta: "Open disputes", route: "/disputes", icon: ShieldAlert, category: "Account" },
  { id: "support", title: "Reach Live Support", description: "Chat with the OpenPay support team anytime.", cta: "Contact support", route: "/live-customer-service", icon: HelpCircle, category: "Account" },
  { id: "help", title: "Browse the Help Center", description: "Read guides for every OpenPay feature.", cta: "Open help", route: "/help-center", icon: HelpCircle, category: "Account" },
];

import { supabase } from "@/integrations/supabase/client";

export const FEATURE_QUEST_STORAGE_KEY = "openpay:feature-quest:completed:v2";
export const FEATURE_QUEST_INTRO_KEY = "openpay:feature-quest:intro-dismissed:v2";
export const FEATURE_QUEST_CLAIMED_KEY = "openpay:feature-quest:claimed:v2";

function readLocalCompleted(): string[] {
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

function writeLocalCompleted(arr: string[]) {
  try {
    window.localStorage.setItem(FEATURE_QUEST_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function readLocalClaimed(): boolean {
  try {
    return window.localStorage.getItem(FEATURE_QUEST_CLAIMED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalClaimed(claimed: boolean) {
  try {
    if (claimed) window.localStorage.setItem(FEATURE_QUEST_CLAIMED_KEY, "1");
    else window.localStorage.removeItem(FEATURE_QUEST_CLAIMED_KEY);
  } catch {
    /* ignore */
  }
}

// Backwards compatible sync read (local cache only)
export function getCompletedSteps(): string[] {
  return readLocalCompleted();
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function loadFeatureQuestProgress(): Promise<{ completed: string[]; claimed: boolean }> {
  const localCompleted = readLocalCompleted();
  const localClaimed = readLocalClaimed();
  const uid = await getUserId();
  if (!uid) return { completed: localCompleted, claimed: localClaimed };

  try {
    const { data, error } = await supabase
      .from("feature_quest_progress" as any)
      .select("completed_steps, claimed")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;

    const remoteCompleted: string[] = Array.isArray((data as any)?.completed_steps)
      ? (data as any).completed_steps
      : [];
    const remoteClaimed: boolean = Boolean((data as any)?.claimed);

    // Merge local + remote so nothing is lost across devices
    const merged = Array.from(new Set([...remoteCompleted, ...localCompleted]));
    const claimed = remoteClaimed || localClaimed;

    writeLocalCompleted(merged);
    writeLocalClaimed(claimed);

    // Push merged state back if it differs from remote
    if (
      merged.length !== remoteCompleted.length ||
      claimed !== remoteClaimed ||
      !data
    ) {
      await supabase.from("feature_quest_progress" as any).upsert(
        {
          user_id: uid,
          completed_steps: merged,
          claimed,
          claimed_at: claimed ? new Date().toISOString() : null,
        },
        { onConflict: "user_id" },
      );
    }

    return { completed: merged, claimed };
  } catch {
    return { completed: localCompleted, claimed: localClaimed };
  }
}

export function markStepCompleted(id: string): string[] {
  const list = new Set(readLocalCompleted());
  list.add(id);
  const arr = Array.from(list);
  writeLocalCompleted(arr);
  // Fire-and-forget backend sync
  void (async () => {
    const uid = await getUserId();
    if (!uid) return;
    try {
      await supabase.from("feature_quest_progress" as any).upsert(
        { user_id: uid, completed_steps: arr },
        { onConflict: "user_id" },
      );
    } catch {
      /* ignore */
    }
  })();
  return arr;
}

export async function setFeatureQuestClaimed(claimed: boolean): Promise<void> {
  writeLocalClaimed(claimed);
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase.from("feature_quest_progress" as any).upsert(
      {
        user_id: uid,
        claimed,
        claimed_at: claimed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );
  } catch {
    /* ignore */
  }
}

export function resetFeatureQuest() {
  try {
    window.localStorage.removeItem(FEATURE_QUEST_STORAGE_KEY);
    window.localStorage.removeItem(FEATURE_QUEST_CLAIMED_KEY);
  } catch {
    /* ignore */
  }
  void (async () => {
    const uid = await getUserId();
    if (!uid) return;
    try {
      await supabase.from("feature_quest_progress" as any).upsert(
        { user_id: uid, completed_steps: [], claimed: false, claimed_at: null },
        { onConflict: "user_id" },
      );
    } catch {
      /* ignore */
    }
  })();
}

