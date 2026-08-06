import type { LucideIcon } from "lucide-react";
import {
  Package,
  Wrench,
  RefreshCw,
  BadgeCheck,
  FileText,
  ClipboardList,
  ShoppingBag,
  Download,
  KeyRound,
  BookOpen,
  GraduationCap,
  Music,
  Video,
  FolderDown,
  Code2,
  Heart,
  Coffee,
  Megaphone,
  HandHeart,
  Landmark,
  Calendar,
  Ticket,
  CalendarCheck,
  MessageSquare,
  Hotel,
  Plane,
  Zap,
  Droplets,
  Wifi,
  Smartphone,
  Tv,
  Flame,
  Shield,
  CreditCard,
  Home,
  Building2,
  ScrollText,
  School,
  Send,
  Layers,
  PiggyBank,
  Scale,
  Banknote,
  Briefcase,
  UserRound,
  HardHat,
  Truck,
  Wallet,
  Gift,
  Users,
  Stethoscope,
  Coins,
  Hexagon,
  Image,
  ArrowLeftRight,
  Repeat2,
  TrendingUp,
} from "lucide-react";

/** Backend CHECK constraint values */
export type QrPayApiType = "product" | "digital" | "donation" | "tip";

export type QrPayPurposeId =
  | "product"
  | "service"
  | "subscription"
  | "membership"
  | "invoice"
  | "quote"
  | "preorder"
  | "digital_product"
  | "software_license"
  | "ebook"
  | "online_course"
  | "music"
  | "video"
  | "download"
  | "api_access"
  | "donation"
  | "tip"
  | "crowdfunding"
  | "charity"
  | "fundraising"
  | "appointment"
  | "event_ticket"
  | "reservation"
  | "consultation"
  | "hotel_booking"
  | "travel_booking"
  | "electricity_bill"
  | "water_bill"
  | "internet_bill"
  | "mobile_bill"
  | "cable_tv_bill"
  | "gas_bill"
  | "insurance_bill"
  | "credit_card_bill"
  | "mortgage"
  | "property_tax"
  | "government_fees"
  | "tuition"
  | "payment_request"
  | "installment"
  | "deposit"
  | "balance_payment"
  | "loan_repayment"
  | "business_payment"
  | "freelancer"
  | "contractor"
  | "vendor"
  | "payroll"
  | "gift"
  | "split_bill"
  | "rent"
  | "utilities"
  | "school_fees"
  | "medical"
  | "crypto_payment"
  | "token_purchase"
  | "nft_purchase"
  | "p2p_trade"
  | "token_swap"
  | "staking"
  | "trading_deposit";

export interface QrPayPurpose {
  id: QrPayPurposeId;
  label: string;
  hint: string;
  apiType: QrPayApiType;
  icon: LucideIcon;
  /** Default display title when merchant leaves title blank */
  defaultTitle?: string;
}

export interface QrPayPurposeCategory {
  id: string;
  label: string;
  emoji: string;
  tone: string;
  purposes: QrPayPurpose[];
}

export const QR_PAY_PURPOSE_CATEGORIES: QrPayPurposeCategory[] = [
  {
    id: "commerce",
    label: "Commerce",
    emoji: "🛍️",
    tone: "ios-glyph-blue",
    purposes: [
      { id: "product", label: "Product", hint: "Physical goods", apiType: "product", icon: Package, defaultTitle: "Product" },
      { id: "service", label: "Service", hint: "Work or labor", apiType: "product", icon: Wrench, defaultTitle: "Service" },
      { id: "subscription", label: "Subscription", hint: "Recurring plan", apiType: "product", icon: RefreshCw, defaultTitle: "Subscription" },
      { id: "membership", label: "Membership", hint: "Club or access", apiType: "product", icon: BadgeCheck, defaultTitle: "Membership" },
      { id: "invoice", label: "Invoice", hint: "Bill for work done", apiType: "product", icon: FileText, defaultTitle: "Invoice" },
      { id: "quote", label: "Quote / Estimate", hint: "Proposed price", apiType: "product", icon: ClipboardList, defaultTitle: "Quote" },
      { id: "preorder", label: "Pre-order", hint: "Pay before release", apiType: "product", icon: ShoppingBag, defaultTitle: "Pre-order" },
    ],
  },
  {
    id: "digital",
    label: "Digital",
    emoji: "💻",
    tone: "ios-glyph-indigo",
    purposes: [
      { id: "digital_product", label: "Digital Product", hint: "Files & apps", apiType: "digital", icon: Download, defaultTitle: "Digital product" },
      { id: "software_license", label: "Software License", hint: "Keys & seats", apiType: "digital", icon: KeyRound, defaultTitle: "Software license" },
      { id: "ebook", label: "eBook", hint: "Digital book", apiType: "digital", icon: BookOpen, defaultTitle: "eBook" },
      { id: "online_course", label: "Online Course", hint: "Lessons & training", apiType: "digital", icon: GraduationCap, defaultTitle: "Online course" },
      { id: "music", label: "Music", hint: "Audio & tracks", apiType: "digital", icon: Music, defaultTitle: "Music" },
      { id: "video", label: "Video", hint: "Films & clips", apiType: "digital", icon: Video, defaultTitle: "Video" },
      { id: "download", label: "Download", hint: "File delivery", apiType: "digital", icon: FolderDown, defaultTitle: "Download" },
      { id: "api_access", label: "API Access", hint: "Developer access", apiType: "digital", icon: Code2, defaultTitle: "API access" },
    ],
  },
  {
    id: "donations",
    label: "Donations",
    emoji: "❤️",
    tone: "ios-glyph-pink",
    purposes: [
      { id: "donation", label: "Donation", hint: "Any amount", apiType: "donation", icon: Heart, defaultTitle: "Support our project" },
      { id: "tip", label: "Tip", hint: "Say thanks", apiType: "tip", icon: Coffee, defaultTitle: "Leave a tip" },
      { id: "crowdfunding", label: "Crowdfunding", hint: "Campaign goal", apiType: "donation", icon: Megaphone, defaultTitle: "Crowdfunding" },
      { id: "charity", label: "Charity", hint: "Nonprofit cause", apiType: "donation", icon: HandHeart, defaultTitle: "Charity donation" },
      { id: "fundraising", label: "Fundraising", hint: "Raise funds", apiType: "donation", icon: Landmark, defaultTitle: "Fundraising" },
    ],
  },
  {
    id: "booking",
    label: "Booking",
    emoji: "📅",
    tone: "ios-glyph-orange",
    purposes: [
      { id: "appointment", label: "Appointment", hint: "Scheduled visit", apiType: "product", icon: Calendar, defaultTitle: "Appointment" },
      { id: "event_ticket", label: "Event Ticket", hint: "Entry pass", apiType: "product", icon: Ticket, defaultTitle: "Event ticket" },
      { id: "reservation", label: "Reservation", hint: "Hold a spot", apiType: "product", icon: CalendarCheck, defaultTitle: "Reservation" },
      { id: "consultation", label: "Consultation", hint: "Advice session", apiType: "product", icon: MessageSquare, defaultTitle: "Consultation" },
      { id: "hotel_booking", label: "Hotel Booking", hint: "Stay payment", apiType: "product", icon: Hotel, defaultTitle: "Hotel booking" },
      { id: "travel_booking", label: "Travel Booking", hint: "Trip payment", apiType: "product", icon: Plane, defaultTitle: "Travel booking" },
    ],
  },
  {
    id: "bills",
    label: "Bills",
    emoji: "💳",
    tone: "ios-glyph-teal",
    purposes: [
      { id: "electricity_bill", label: "Electricity Bill", hint: "Power utility", apiType: "product", icon: Zap, defaultTitle: "Electricity bill" },
      { id: "water_bill", label: "Water Bill", hint: "Water utility", apiType: "product", icon: Droplets, defaultTitle: "Water bill" },
      { id: "internet_bill", label: "Internet Bill", hint: "ISP payment", apiType: "product", icon: Wifi, defaultTitle: "Internet bill" },
      { id: "mobile_bill", label: "Mobile Bill", hint: "Phone plan", apiType: "product", icon: Smartphone, defaultTitle: "Mobile bill" },
      { id: "cable_tv_bill", label: "Cable TV Bill", hint: "TV service", apiType: "product", icon: Tv, defaultTitle: "Cable TV bill" },
      { id: "gas_bill", label: "Gas Bill", hint: "Gas utility", apiType: "product", icon: Flame, defaultTitle: "Gas bill" },
      { id: "insurance_bill", label: "Insurance Bill", hint: "Policy payment", apiType: "product", icon: Shield, defaultTitle: "Insurance" },
      { id: "credit_card_bill", label: "Credit Card Bill", hint: "Card payoff", apiType: "product", icon: CreditCard, defaultTitle: "Credit card bill" },
      { id: "mortgage", label: "Mortgage Payment", hint: "Home loan", apiType: "product", icon: Home, defaultTitle: "Mortgage payment" },
      { id: "property_tax", label: "Property Tax", hint: "Local tax", apiType: "product", icon: Building2, defaultTitle: "Property tax" },
      { id: "government_fees", label: "Government Fees", hint: "Official fees", apiType: "product", icon: ScrollText, defaultTitle: "Government fees" },
      { id: "tuition", label: "Tuition Fees", hint: "School payment", apiType: "product", icon: School, defaultTitle: "Tuition" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    emoji: "💰",
    tone: "ios-glyph-green",
    purposes: [
      { id: "payment_request", label: "Payment Request", hint: "Ask to be paid", apiType: "product", icon: Send, defaultTitle: "Payment request" },
      { id: "installment", label: "Installment Payment", hint: "Part of a plan", apiType: "product", icon: Layers, defaultTitle: "Installment" },
      { id: "deposit", label: "Deposit", hint: "Down payment", apiType: "product", icon: PiggyBank, defaultTitle: "Deposit" },
      { id: "balance_payment", label: "Balance Payment", hint: "Remaining due", apiType: "product", icon: Scale, defaultTitle: "Balance payment" },
      { id: "loan_repayment", label: "Loan Repayment", hint: "Pay back a loan", apiType: "product", icon: Banknote, defaultTitle: "Loan repayment" },
    ],
  },
  {
    id: "business",
    label: "Business",
    emoji: "🏢",
    tone: "ios-glyph-blue",
    purposes: [
      { id: "business_payment", label: "Business Payment", hint: "B2B transfer", apiType: "product", icon: Briefcase, defaultTitle: "Business payment" },
      { id: "freelancer", label: "Freelancer Payment", hint: "Independent work", apiType: "product", icon: UserRound, defaultTitle: "Freelancer payment" },
      { id: "contractor", label: "Contractor Payment", hint: "Contract work", apiType: "product", icon: HardHat, defaultTitle: "Contractor payment" },
      { id: "vendor", label: "Vendor Payment", hint: "Supplier invoice", apiType: "product", icon: Truck, defaultTitle: "Vendor payment" },
      { id: "payroll", label: "Payroll", hint: "Staff wages", apiType: "product", icon: Wallet, defaultTitle: "Payroll" },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    emoji: "👤",
    tone: "ios-glyph-pink",
    purposes: [
      { id: "gift", label: "Gift", hint: "Send money as a gift", apiType: "donation", icon: Gift, defaultTitle: "Gift" },
      { id: "split_bill", label: "Split Bill", hint: "Share a cost", apiType: "tip", icon: Users, defaultTitle: "Split bill" },
      { id: "rent", label: "Rent", hint: "Housing payment", apiType: "product", icon: Home, defaultTitle: "Rent" },
      { id: "utilities", label: "Utilities", hint: "Home utilities", apiType: "product", icon: Zap, defaultTitle: "Utilities" },
      { id: "school_fees", label: "School Fees", hint: "Education", apiType: "product", icon: School, defaultTitle: "School fees" },
      { id: "medical", label: "Medical Payment", hint: "Health costs", apiType: "product", icon: Stethoscope, defaultTitle: "Medical payment" },
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    emoji: "🪙",
    tone: "ios-glyph-orange",
    purposes: [
      { id: "crypto_payment", label: "Crypto Payment", hint: "Pay with crypto", apiType: "product", icon: Coins, defaultTitle: "Crypto payment" },
      { id: "token_purchase", label: "Token Purchase", hint: "Buy tokens", apiType: "product", icon: Hexagon, defaultTitle: "Token purchase" },
      { id: "nft_purchase", label: "NFT Purchase", hint: "Collectible buy", apiType: "digital", icon: Image, defaultTitle: "NFT purchase" },
      { id: "p2p_trade", label: "P2P Trade", hint: "Peer exchange", apiType: "product", icon: ArrowLeftRight, defaultTitle: "P2P trade" },
      { id: "token_swap", label: "Token Swap", hint: "Exchange tokens", apiType: "product", icon: Repeat2, defaultTitle: "Token swap" },
      { id: "staking", label: "Staking", hint: "Stake deposit", apiType: "product", icon: Layers, defaultTitle: "Staking" },
      { id: "trading_deposit", label: "Trading Deposit", hint: "Fund trading", apiType: "product", icon: TrendingUp, defaultTitle: "Trading deposit" },
    ],
  },
];

const PURPOSE_MAP = new Map<string, QrPayPurpose>(
  QR_PAY_PURPOSE_CATEGORIES.flatMap((c) => c.purposes.map((p) => [p.id, p])),
);

export function getQrPayPurpose(id: string | null | undefined): QrPayPurpose | undefined {
  if (!id) return undefined;
  return PURPOSE_MAP.get(id) || PURPOSE_MAP.get(id as QrPayPurposeId);
}

export function getPurposeCategory(purposeId: string): QrPayPurposeCategory | undefined {
  return QR_PAY_PURPOSE_CATEGORIES.find((c) => c.purposes.some((p) => p.id === purposeId));
}

export function isFlexibleApiType(apiType: string | null | undefined): boolean {
  return apiType === "donation" || apiType === "tip";
}

export function isFlexiblePurpose(purposeId: string | null | undefined): boolean {
  const p = getQrPayPurpose(purposeId);
  if (p) return isFlexibleApiType(p.apiType);
  return isFlexibleApiType(purposeId);
}

export function resolveApiType(purposeOrType: string | null | undefined): QrPayApiType {
  const p = getQrPayPurpose(purposeOrType);
  if (p) return p.apiType;
  if (purposeOrType === "digital" || purposeOrType === "donation" || purposeOrType === "tip" || purposeOrType === "product") {
    return purposeOrType;
  }
  return "product";
}

export function purposeTitlePlaceholder(purposeId: string): string {
  const p = getQrPayPurpose(purposeId);
  if (!p) return "e.g. Morning Coffee Combo";
  if (p.apiType === "donation") return p.defaultTitle || "Support our project";
  if (p.apiType === "tip") return p.defaultTitle || "Leave a tip";
  return `e.g. ${p.defaultTitle || p.label}`;
}

export function defaultTitleForPurpose(purposeId: string): string {
  const p = getQrPayPurpose(purposeId);
  if (!p) return "QR Payment";
  return p.defaultTitle || p.label;
}
