import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Bot,
  CircleDollarSign,
  FileText,
  Gift,
  HandCoins,
  Mail,
  Pickaxe,
  PiggyBank,
  QrCode,
  ScanLine,
  ShieldCheck,
  Store,
} from "lucide-react";
import AuthMark from "@/components/AuthMark";
import BrandLogo from "@/components/BrandLogo";
import AuthFooter from "@/components/AuthFooter";
import AssetsSection from "@/components/dashboard/AssetsSection";
import { DigitalRateDisplay } from "@/components/ui/DigitalRateDisplay";
import { Button } from "@/components/ui/button";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { OUSD_TOKEN } from "@/lib/ousdPrice";
import { PI_TOKEN, usePiUsdPrice } from "@/lib/piPrice";
import { BluePage, LightPage, SoftHeader } from "./PhoneChrome";

const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";

export type PreviewFrameId =
  | "auth"
  | "wallet"
  | "assets"
  | "savings"
  | "credit"
  | "loans"
  | "buy"
  | "withdraw"
  | "send"
  | "receive"
  | "request"
  | "mining"
  | "staking"
  | "rates"
  | "menu"
  | "qrpay"
  | "card"
  | "kyc"
  | "ai"
  | "nft"
  | "activity"
  | "send-pro"
  | "profile"
  | "pos"
  | "affiliate"
  | "notifications"
  | "converter"
  | "invoice"
  | "scan";

export type PreviewFrameMeta = {
  id: PreviewFrameId;
  title: string;
  feature: string;
  file: string;
  group: string;
};

export const PREVIEW_FRAMES: PreviewFrameMeta[] = [
  { id: "auth", title: "Auth", feature: "Authenticate with Pi", file: "01-auth.png", group: "Onboarding" },
  { id: "kyc", title: "KYC", feature: "Identity verification", file: "02-kyc.png", group: "Onboarding" },
  { id: "wallet", title: "Wallet", feature: "Dashboard balance", file: "03-wallet.png", group: "Wallet" },
  { id: "assets", title: "Assets", feature: "Token balances", file: "04-assets.png", group: "Wallet" },
  { id: "savings", title: "Savings", feature: "Grow & move funds", file: "05-savings.png", group: "Wallet" },
  { id: "send", title: "Send", feature: "Express Send / Pay", file: "06-send.png", group: "Payments" },
  { id: "receive", title: "Receive", feature: "QR receive money", file: "07-receive.png", group: "Payments" },
  { id: "request", title: "Request", feature: "Request payment", file: "08-request.png", group: "Payments" },
  { id: "invoice", title: "Invoice", feature: "Send invoice", file: "09-invoice.png", group: "Payments" },
  { id: "scan", title: "Scan QR", feature: "Scan to pay", file: "10-scan.png", group: "Payments" },
  { id: "qrpay", title: "QR Pay", feature: "Create QR payments", file: "11-qrpay.png", group: "Payments" },
  { id: "buy", title: "Buy OUSD", feature: "Top up OpenUSD", file: "12-buy.png", group: "Money" },
  { id: "withdraw", title: "Withdraw", feature: "OUSD payout", file: "13-withdraw.png", group: "Money" },
  { id: "send-pro", title: "Send to Pro", feature: "OpenPay → Pro", file: "14-send-pro.png", group: "Money" },
  { id: "converter", title: "Converter", feature: "Currency converter", file: "15-converter.png", group: "Money" },
  { id: "mining", title: "Mining", feature: "Engage Mining + ads", file: "16-mining.png", group: "Earn" },
  { id: "staking", title: "Staking", feature: "Stake & earn", file: "17-staking.png", group: "Earn" },
  { id: "affiliate", title: "Affiliate", feature: "Invite & earn", file: "18-affiliate.png", group: "Earn" },
  { id: "credit", title: "Credit", feature: "Credit score", file: "19-credit.png", group: "Banking" },
  { id: "loans", title: "Loans", feature: "Borrow & repay", file: "20-loans.png", group: "Banking" },
  { id: "card", title: "Virtual Card", feature: "OpenPay card", file: "21-card.png", group: "Banking" },
  { id: "rates", title: "Live Rates", feature: "PI + OUSD rates", file: "22-rates.png", group: "Market" },
  { id: "menu", title: "Menu", feature: "Services hub", file: "23-menu.png", group: "Market" },
  { id: "ai", title: "OpenPay AI", feature: "Financial assistant", file: "24-ai.png", group: "Tools" },
  { id: "nft", title: "OpenNFT", feature: "NFT marketplace", file: "25-nft.png", group: "Tools" },
  { id: "pos", title: "Merchant POS", feature: "In-person payments", file: "26-pos.png", group: "Merchant" },
  { id: "activity", title: "Activity", feature: "Recent transactions", file: "27-activity.png", group: "Account" },
  { id: "notifications", title: "Alerts", feature: "Notifications", file: "28-notifications.png", group: "Account" },
  { id: "profile", title: "Profile", feature: "Account & KYC", file: "29-profile.png", group: "Account" },
];

const Pill = ({ children, active = false }: { children: ReactNode; active?: boolean }) => (
  <span
    className={
      active
        ? "rounded-full bg-white px-3 py-1 text-[11px] font-bold text-paypal-blue shadow"
        : "rounded-full px-3 py-1 text-[11px] font-bold text-white/80"
    }
  >
    {children}
  </span>
);

const WhiteCard = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-[24px] bg-white p-4 text-[#1d1d1f] shadow-sm ${className}`}>{children}</div>
);

export function AuthFrame() {
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-paypal-blue via-[#0a3fa8] to-[#062468] px-5 pb-8 pt-14">
      <div className="mb-6 text-center">
        <AuthMark className="mx-auto mb-4 h-14 w-14" />
        <h1 className="text-2xl font-bold text-white">OpenPay</h1>
        <p className="mt-1 text-sm text-white/75">Sign in to your wallet</p>
        <p className="mt-2 text-[11px] font-medium text-white/55">{APP_VERSION_LABEL}</p>
      </div>
      <div className="rounded-[28px] bg-white p-6 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.35)]">
        <Button className="mb-3 h-12 w-full rounded-2xl bg-[#007AFF] text-[17px] font-semibold text-white hover:bg-[#0066d6]">
          <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-black/5">
            <img src={PURE_PI_ICON_URL} alt="" className="h-5 w-5 rounded-full" />
          </span>
          Authenticate with Pi
        </Button>
        <Button variant="secondary" className="mb-3 h-12 w-full rounded-2xl text-[17px] font-semibold">
          <BrandLogo animate={false} className="mr-2 h-5 w-5 text-[#007AFF]" />
          OpenPay Pro
        </Button>
        <Button
          variant="outline"
          className="mb-3 h-12 w-full rounded-2xl border-0 text-[17px] font-semibold ring-1 ring-black/[0.08]"
        >
          <Mail className="mr-2 h-4 w-4" /> Sign In with Email
        </Button>
        <div className="mt-5 border-t border-border/60 pt-4">
          <AuthFooter />
        </div>
      </div>
    </div>
  );
}

export function WalletFrame() {
  const pi = usePiUsdPrice(30_000);
  return (
    <BluePage>
      <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-12">
        <div className="flex items-center gap-2">
          <BrandLogo variant="white" animate={false} className="h-8 w-8" />
          <div>
            <p className="text-[11px] font-semibold text-white/70">OpenPay</p>
            <p className="text-sm font-bold">@openpay</p>
          </div>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">Wallet</span>
      </div>
      <div className="mx-4 mt-4 rounded-[2rem] bg-gradient-to-br from-paypal-blue to-[#0059c1] p-5 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-white/15 p-1">
            <Pill active>Personal</Pill>
            <Pill>Merchant</Pill>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            PI ${(pi.price || 0).toFixed(4)}
          </span>
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-white/70">Available balance</p>
        <p className="mt-1 text-4xl font-black tracking-[-0.04em]">1,284.50</p>
        <p className="mt-1 text-sm font-semibold text-white/80">OUSD · OpenUSD</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {["Send", "Request", "Top Up"].map((l) => (
            <div key={l} className="rounded-2xl bg-white/15 py-3 text-center text-[12px] font-bold">
              {l}
            </div>
          ))}
        </div>
      </div>
      <div className="mx-4 mt-4 space-y-2 rounded-[1.5rem] bg-white p-3 text-[#1d1d1f]">
        {[
          ["Savings", "300.00 OUSD"],
          ["Mining", "134.50 OUSD"],
          ["Assets", "Token balances"],
        ].map(([a, b]) => (
          <div key={a} className="flex justify-between rounded-2xl bg-[#f2f2f7] px-3.5 py-3">
            <span className="text-[14px] font-semibold">{a}</span>
            <span className="text-[13px] font-bold text-[#007AFF]">{b}</span>
          </div>
        ))}
      </div>
    </BluePage>
  );
}

export function AssetsFrame() {
  return (
    <LightPage className="pt-10">
      <div className="px-4 pb-2">
        <p className="text-[13px] font-semibold text-[#8e8e93]">Dashboard</p>
        <h2 className="text-[22px] font-bold tracking-[-0.03em]">Assets</h2>
      </div>
      <div className="pointer-events-none">
        <AssetsSection
          username="openpay"
          balances={{ walletOusd: 850, savingsOusd: 300, miningOusd: 134.5, merchantOusd: 0 }}
        />
      </div>
    </LightPage>
  );
}

export function SavingsFrame() {
  return (
    <BluePage>
      <SoftHeader title="Savings" light />
      <div className="mx-4 rounded-[2rem] bg-gradient-to-br from-paypal-blue to-[#0059c1] p-5">
        <p className="text-[11px] font-semibold uppercase text-white/70">Savings balance</p>
        <p className="mt-1 text-4xl font-black">300.00</p>
        <p className="mt-1 text-sm text-white/80">OUSD · APY 3.5%</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white py-3 text-center text-[13px] font-black text-paypal-blue">
            Move to Savings
          </div>
          <div className="rounded-2xl bg-white/15 py-3 text-center text-[13px] font-bold">Move to Wallet</div>
        </div>
      </div>
      <div className="mx-4 mt-4">
        <WhiteCard>
          <div className="mb-3 flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-[#34C759]" />
            <p className="font-bold">Grow your OpenUSD</p>
          </div>
          <p className="text-[13px] text-[#8e8e93]">Move funds between wallet and savings anytime.</p>
        </WhiteCard>
      </div>
    </BluePage>
  );
}

export function CreditFrame() {
  return (
    <BluePage>
      <SoftHeader title="Credit" light />
      <div className="mx-4 rounded-[2rem] bg-gradient-to-br from-paypal-blue to-[#0059c1] p-5">
        <p className="text-[11px] font-semibold uppercase text-white/70">Credit score</p>
        <p className="mt-1 text-5xl font-black">86</p>
        <p className="mt-1 text-sm text-white/80">/ 120 · Good standing</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-[72%] rounded-full bg-emerald-400" />
        </div>
        <div className="mt-5 rounded-2xl bg-white py-3 text-center text-[13px] font-black text-paypal-blue">
          + Build credit
        </div>
      </div>
      <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
        {[
          ["Status", "Active"],
          ["Range", "Good"],
          ["Unlock", "Loans"],
        ].map(([a, b]) => (
          <WhiteCard key={a} className="text-center">
            <p className="text-[11px] text-[#8e8e93]">{a}</p>
            <p className="mt-1 text-[14px] font-bold">{b}</p>
          </WhiteCard>
        ))}
      </div>
    </BluePage>
  );
}

export function LoansFrame() {
  return (
    <BluePage>
      <SoftHeader title="Loans" light />
      <div className="mx-4 rounded-[2rem] bg-gradient-to-br from-paypal-blue to-[#0059c1] p-5">
        <p className="text-[11px] font-semibold uppercase text-white/70">Available to borrow</p>
        <p className="mt-1 text-4xl font-black">500.00</p>
        <p className="mt-1 text-sm text-white/80">OUSD · APR 8% · 30 days</p>
        <div className="mt-5 rounded-2xl bg-white py-3 text-center text-[13px] font-black text-paypal-blue">
          + Apply now
        </div>
      </div>
      <div className="mx-4 mt-4">
        <WhiteCard>
          <div className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-[#007AFF]" />
            <p className="font-bold">Loan center</p>
          </div>
          <p className="mt-2 text-[13px] text-[#8e8e93]">Preview terms, apply, and manage repayments.</p>
          <div className="mt-3 rounded-xl bg-[#f2f2f7] px-3 py-2 text-[12px] font-semibold text-[#248A3D]">
            KYC approved · Eligible
          </div>
        </WhiteCard>
      </div>
    </BluePage>
  );
}

export function BuyFrame() {
  return (
    <BluePage>
      <SoftHeader title="Buy OpenUSD" light />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <p className="text-[12px] font-semibold text-[#8e8e93]">Amount</p>
          <p className="mt-1 text-3xl font-black">100.00 OUSD</p>
        </WhiteCard>
        {[
          ["Pi Network", "Pay with π"],
          ["Card / Apple Pay", "Stripe"],
          ["E-Wallet / QRPh", "Local rails"],
          ["USDT / USDC", "Crypto top-up"],
        ].map(([a, b]) => (
          <div key={a} className="flex items-center justify-between rounded-[20px] bg-white/15 px-4 py-3.5 backdrop-blur-sm">
            <div>
              <p className="font-bold">{a}</p>
              <p className="text-[12px] text-white/70">{b}</p>
            </div>
            <CircleDollarSign className="h-5 w-5 text-white/80" />
          </div>
        ))}
      </div>
    </BluePage>
  );
}

export function WithdrawFrame() {
  return (
    <BluePage>
      <div className="border-b border-white/10 px-4 pb-3 pt-12 backdrop-blur-xl">
        <p className="text-xl font-bold">Withdraw OUSD</p>
        <p className="text-[12px] text-white/70">OpenUSD → OUSD payout · 1:1</p>
      </div>
      <div className="mx-4 mt-4 space-y-3">
        <WhiteCard>
          <p className="text-[12px] font-semibold text-[#8e8e93]">Amount</p>
          <p className="mt-1 text-3xl font-black">50.00</p>
          <span className="mt-2 inline-flex rounded-full bg-[#007AFF]/12 px-2.5 py-1 text-[11px] font-bold text-[#007AFF]">
            OUSD selected
          </span>
        </WhiteCard>
        <WhiteCard>
          <p className="text-[12px] font-semibold text-[#8e8e93]">Destination</p>
          <p className="mt-1 font-bold">OpenPay Pro · @alice</p>
        </WhiteCard>
        <div className="rounded-2xl bg-white py-3.5 text-center text-[15px] font-black text-paypal-blue">
          Submit Withdrawal
        </div>
      </div>
    </BluePage>
  );
}

export function SendFrame() {
  return (
    <BluePage>
      <div className="px-4 pt-12">
        <div className="rounded-2xl bg-white/15 px-4 py-3 text-[14px] font-medium text-white/90">
          Name, username…
        </div>
        <p className="mt-6 text-center text-[13px] font-semibold text-white/70">Sending to @merchant</p>
        <p className="mt-2 text-center text-5xl font-black tracking-tight">25.00</p>
        <div className="mt-3 flex justify-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-paypal-blue">OUSD</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">OpenPay</span>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-2xl font-bold">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
            <div key={k} className="rounded-2xl bg-white/10 py-4">
              {k}
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white py-4 text-center text-[15px] font-black text-paypal-blue">Pay</div>
          <div className="rounded-2xl bg-white/15 py-4 text-center text-[15px] font-bold">Request</div>
        </div>
      </div>
    </BluePage>
  );
}

export function ReceiveFrame() {
  return (
    <BluePage>
      <SoftHeader title="Receive" light />
      <div className="mx-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-black">
          O
        </div>
        <p className="mt-3 text-lg font-bold">@openpay</p>
        <p className="text-sm text-white/70">OpenPay Wallet</p>
        <WhiteCard className="mx-auto mt-5 max-w-[280px]">
          <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-[#f2f2f7]">
            <QrCode className="h-28 w-28 text-[#1d1d1f]" />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#8e8e93]">Scan to pay me in OUSD</p>
        </WhiteCard>
        <div className="mt-4 rounded-2xl bg-blue-600 py-3.5 text-[14px] font-black">Open Express Send</div>
      </div>
    </BluePage>
  );
}

export function RequestFrame() {
  return (
    <BluePage>
      <SoftHeader title="Request" light />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">From</p>
          <p className="mt-1 text-lg font-bold">@friend</p>
        </WhiteCard>
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">Amount</p>
          <p className="mt-1 text-3xl font-black">40.00 OUSD</p>
        </WhiteCard>
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">Note</p>
          <p className="mt-1 font-semibold">Dinner split</p>
        </WhiteCard>
        <div className="rounded-2xl bg-white py-3.5 text-center text-[15px] font-black text-paypal-blue">
          Send request
        </div>
      </div>
    </BluePage>
  );
}

export function InvoiceFrame() {
  return (
    <LightPage>
      <SoftHeader title="Send Invoice" />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#007AFF]" />
            <p className="font-bold">Invoice #1042</p>
          </div>
          <p className="mt-3 text-3xl font-black">120.00 OUSD</p>
          <p className="mt-1 text-[13px] text-[#8e8e93]">Due in 7 days · @client</p>
        </WhiteCard>
        <WhiteCard>
          <p className="text-[13px] font-semibold">Line items</p>
          <div className="mt-2 space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span>Design package</span>
              <span className="font-bold">100.00</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="font-bold">20.00</span>
            </div>
          </div>
        </WhiteCard>
        <div className="rounded-2xl bg-[#007AFF] py-3.5 text-center text-[15px] font-black text-white">
          Send invoice
        </div>
      </div>
    </LightPage>
  );
}

export function ScanFrame() {
  return (
    <div className="relative h-full overflow-hidden bg-[#0a0a0c]">
      <SoftHeader title="Scan QR" light />
      <div className="mx-auto mt-10 flex h-64 w-64 items-center justify-center rounded-[28px] border-2 border-white/40">
        <ScanLine className="h-16 w-16 text-white/80" />
      </div>
      <p className="mt-6 text-center text-sm font-semibold text-white/70">Align QR code within the frame</p>
      <div className="absolute inset-x-4 bottom-10 rounded-2xl bg-white py-3.5 text-center text-[15px] font-black text-paypal-blue">
        Enter code manually
      </div>
    </div>
  );
}

export function QrPayFrame() {
  return (
    <LightPage bg="bg-[#eef1f6]">
      <div className="px-4 pt-12">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">OpenPay</p>
        <h1 className="text-[28px] font-bold tracking-[-0.03em]">QR Pay</h1>
        <p className="mt-1 text-[14px] text-[#636366]">Create QR payments & get paid</p>
      </div>
      <div className="mx-4 mt-5 rounded-[28px] bg-white/80 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-[#8e8e93]">Overview</p>
            <p className="text-2xl font-black">$842.00</p>
          </div>
          <div className="rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-bold text-white">New</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[#636366]">
          {["Links", "Orders", "API"].map((t) => (
            <div key={t} className="rounded-2xl bg-[#f2f2f7] py-3">
              {t}
            </div>
          ))}
        </div>
      </div>
      <div className="mx-4 mt-4 space-y-2">
        {["Product · $25", "Donation · Any", "Service · $80"].map((row) => (
          <div key={row} className="flex items-center justify-between rounded-[20px] bg-white px-4 py-3.5 ring-1 ring-black/5">
            <span className="text-[14px] font-semibold">{row}</span>
            <QrCode className="h-5 w-5 text-[#007AFF]" />
          </div>
        ))}
      </div>
    </LightPage>
  );
}

export function MiningFrame() {
  return (
    <LightPage bg="bg-[#f8fbff]">
      <div className="px-4 pt-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-paypal-dark">Mining</h1>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#003087] via-paypal-blue to-[#0070ba] p-8 text-white shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-white/20">
              <Pickaxe className="h-10 w-10 fill-current" />
            </div>
            <h2 className="text-2xl font-black">Status: Standby</h2>
            <p className="mt-2 rounded-full bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-widest">
              1.00 OPEN / DAY
            </p>
            <p className="mt-3 max-w-[280px] text-xs font-semibold text-white/80">
              Mining requires KYC + Pi Browser. Watch 2 rewarded ads to engage.
            </p>
            <div className="mt-7 w-full max-w-[240px] rounded-[1.25rem] bg-white py-4 text-center text-lg font-black uppercase tracking-wider text-[#003087]">
              Engage Mining
            </div>
          </div>
        </div>
      </div>
    </LightPage>
  );
}

export function StakingFrame() {
  return (
    <LightPage>
      <SoftHeader title="Staking" />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">Available balance</p>
          <p className="mt-1 text-3xl font-black">850.00 OUSD</p>
        </WhiteCard>
        <WhiteCard>
          <p className="mb-2 text-[13px] font-semibold">Lock duration</p>
          <div className="flex flex-wrap gap-2">
            {["7d", "30d", "90d"].map((d, i) => (
              <span
                key={d}
                className={
                  i === 1
                    ? "rounded-full bg-[#007AFF] px-3 py-1.5 text-[12px] font-bold text-white"
                    : "rounded-full bg-[#f2f2f7] px-3 py-1.5 text-[12px] font-bold"
                }
              >
                {d}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[#8e8e93]">Reward rate · 4.2% est.</p>
        </WhiteCard>
        <div className="rounded-2xl bg-[#007AFF] py-3.5 text-center text-[15px] font-black text-white">
          Stake now
        </div>
      </div>
    </LightPage>
  );
}

export function AffiliateFrame() {
  return (
    <LightPage>
      <SoftHeader title="Affiliate" />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-[#007AFF]" />
            <p className="font-bold">Invite friends</p>
          </div>
          <p className="mt-2 text-[13px] text-[#8e8e93]">Earn rewards when they join OpenPay.</p>
          <div className="mt-3 rounded-xl bg-[#f2f2f7] px-3 py-2 font-mono text-[13px] font-bold">
            openpy.space/auth?ref=openpay
          </div>
        </WhiteCard>
        <div className="grid grid-cols-2 gap-3">
          <WhiteCard className="text-center">
            <p className="text-[11px] text-[#8e8e93]">Invites</p>
            <p className="text-2xl font-black">18</p>
          </WhiteCard>
          <WhiteCard className="text-center">
            <p className="text-[11px] text-[#8e8e93]">Earned</p>
            <p className="text-2xl font-black">42 OUSD</p>
          </WhiteCard>
        </div>
        <div className="rounded-2xl bg-[#007AFF] py-3.5 text-center text-[15px] font-black text-white">
          Share link
        </div>
      </div>
    </LightPage>
  );
}

export function RatesFrame() {
  const pi = usePiUsdPrice(30_000);
  return (
    <LightPage className="px-4 pt-12">
      <div className="mb-4 flex items-center gap-3">
        <BrandLogo className="h-8 w-8" animate={false} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Menu</p>
          <h2 className="text-[20px] font-bold">Live Rates</h2>
        </div>
      </div>
      <div className="pointer-events-none">
        <DigitalRateDisplay
          open
          liveRateClosed={false}
          rates={{
            piToOusd: pi.price > 0 ? pi.price : 0.004,
            usdToOusd: 1,
            currencyTag: "$",
            currencyCode: "USD",
            currencyRate: 1,
          }}
        />
      </div>
    </LightPage>
  );
}

export function MenuFrame() {
  return (
    <BluePage>
      <div className="px-4 pt-12">
        <h1 className="text-3xl font-bold">Services</h1>
        <p className="mt-1 text-sm text-white/75">Everything in OpenPay</p>
      </div>
      <div className="mx-4 mt-5 space-y-3">
        {[
          ["Transactions", "Send · Request · Invoice"],
          ["Secure banking", "Wallet · KYC · Card · Mining"],
          ["Merchant", "POS · QR Pay · Buttons"],
          ["Earn", "Affiliate · Staking · Ads"],
        ].map(([t, s]) => (
          <div key={t} className="rounded-[2rem] border border-blue-400/40 bg-white px-4 py-4 text-[#1d1d1f]">
            <p className="text-[16px] font-bold">{t}</p>
            <p className="mt-1 text-[13px] text-[#8e8e93]">{s}</p>
          </div>
        ))}
      </div>
    </BluePage>
  );
}

export function AiFrame() {
  return (
    <LightPage bg="bg-[#F4F1EA]">
      <div className="border-b border-black/5 bg-[#F4F1EA]/90 px-4 pb-3 pt-12">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">Financial assistant</p>
        <h1 className="text-xl font-bold">OpenPay AI</h1>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-6">
        <div className="mb-4 self-start rounded-[20px] bg-white px-4 py-3 text-[14px] shadow-sm">
          Hi! I can help with balance, send money, KYC, and mining.
        </div>
        <div className="mb-4 self-end rounded-[20px] bg-[#007AFF] px-4 py-3 text-[14px] text-white">
          What’s my wallet balance?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {["Send money", "Check KYC", "Start mining", "Live rates"].map((c) => (
            <div key={c} className="rounded-2xl bg-white/80 px-3 py-2.5 text-center text-[12px] font-semibold ring-1 ring-black/5">
              {c}
            </div>
          ))}
        </div>
        <div className="mt-auto mb-2 flex items-center gap-2 rounded-full bg-white px-4 py-3 ring-1 ring-black/5">
          <Bot className="h-4 w-4 text-[#8e8e93]" />
          <span className="text-[13px] text-[#8e8e93]">Message OpenPay AI…</span>
        </div>
      </div>
    </LightPage>
  );
}

export function NftFrame() {
  return (
    <div className="h-full overflow-y-auto bg-[#08080a] text-white">
      <div className="flex items-center justify-between px-4 pb-3 pt-12">
        <h1 className="text-xl font-bold">Open NFT</h1>
        <div className="rounded-full bg-[hsl(217_91%_60%)] px-3 py-1.5 text-[12px] font-bold">Mint NFT</div>
      </div>
      <div className="mx-4 rounded-2xl bg-white/10 px-4 py-3 text-[13px] text-white/60">Search Open NFT</div>
      <div className="mx-4 mt-4 flex gap-2 overflow-hidden">
        {["Art", "Music", "Collectibles", "Pi"].map((c, i) => (
          <span
            key={c}
            className={
              i === 0
                ? "rounded-full bg-white px-3 py-1 text-[12px] font-bold text-black"
                : "rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold"
            }
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mx-4 mt-5 grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
            <div className="aspect-square bg-gradient-to-br from-[#007AFF]/40 to-[#5856D6]/40" />
            <div className="p-2.5">
              <p className="truncate text-[13px] font-bold">Collectible #{n}</p>
              <p className="text-[11px] text-white/50">12.00 OUSD</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardFrame() {
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-paypal-blue to-[#072a7a] text-white">
      <SoftHeader title="OpenPay Virtual Card" light />
      <div className="mx-4 mt-2 aspect-[1.6/1] rounded-[1.5rem] bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 shadow-2xl ring-1 ring-white/20">
        <div className="flex items-start justify-between">
          <BrandLogo variant="white" animate={false} className="h-8 w-8" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Virtual</span>
        </div>
        <p className="mt-10 font-mono text-lg tracking-[0.2em]">•••• •••• •••• 4242</p>
        <div className="mt-6 flex justify-between text-[12px]">
          <div>
            <p className="text-white/60">CARDHOLDER</p>
            <p className="font-bold">OPENPAY USER</p>
          </div>
          <div>
            <p className="text-white/60">EXP</p>
            <p className="font-bold">12/28</p>
          </div>
        </div>
      </div>
      <div className="mx-4 mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/15 py-3 text-center text-[13px] font-bold">Lock Card</div>
        <div className="rounded-2xl bg-white/15 py-3 text-center text-[13px] font-bold">Hide Details</div>
      </div>
    </div>
  );
}

export function KycFrame() {
  return (
    <LightPage bg="bg-[#f8fbff]">
      <SoftHeader title="Identity verification" />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#007AFF]" />
            <p className="font-bold">Verify your identity</p>
          </div>
          <p className="mt-2 text-[13px] text-[#8e8e93]">Secure KYC · Banking standard</p>
        </WhiteCard>
        <div className="grid grid-cols-2 gap-3">
          {["Personal", "Financial", "ID docs", "Face"].map((s, i) => (
            <WhiteCard key={s} className="text-center">
              <p className="text-[11px] font-bold text-[#007AFF]">Step {i + 1}</p>
              <p className="mt-1 text-[14px] font-bold">{s}</p>
            </WhiteCard>
          ))}
        </div>
        <div className="rounded-2xl bg-paypal-blue py-3.5 text-center text-[15px] font-black text-white">
          Continue
        </div>
        <div className="rounded-2xl bg-white py-3 text-center text-[13px] font-semibold text-[#007AFF] ring-1 ring-[#007AFF]/20">
          Quick Verification with PiVerify
        </div>
      </div>
    </LightPage>
  );
}

export function ActivityFrame() {
  return (
    <LightPage>
      <SoftHeader title="Activity" />
      <div className="mx-4 space-y-2">
        <p className="px-1 text-[13px] font-semibold text-[#8e8e93]">Recent activity</p>
        {[
          ["Sent to @alice", "-25.00 OUSD", "Send"],
          ["Received from @bob", "+80.00 OUSD", "Receive"],
          ["Mining claim", "+1.00 OUSD", "Mine"],
          ["Top up card", "+100.00 OUSD", "Buy"],
        ].map(([t, a, b]) => (
          <div key={t} className="flex items-center gap-3 rounded-[20px] bg-white px-3.5 py-3 ring-1 ring-black/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#007AFF]/12 text-[#007AFF]">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{t}</p>
              <p className="text-[11px] text-[#8e8e93]">{b}</p>
            </div>
            <p className="text-[14px] font-bold">{a}</p>
          </div>
        ))}
      </div>
    </LightPage>
  );
}

export function SendProFrame() {
  return (
    <BluePage>
      <SoftHeader title="Send to Pro" light />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">Pro destination</p>
          <p className="mt-1 text-lg font-bold">@alice</p>
          <p className="text-[12px] text-[#8e8e93]">or 0x wallet address</p>
        </WhiteCard>
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">Amount</p>
          <p className="mt-1 text-3xl font-black">10.00 OUSD</p>
        </WhiteCard>
        <div className="rounded-2xl bg-white py-3.5 text-center text-[15px] font-black text-paypal-blue">
          Transfer to OpenPay Pro
        </div>
        <p className="text-center text-[11px] text-white/70">Settles via Partner inbound API</p>
      </div>
    </BluePage>
  );
}

export function ProfileFrame() {
  return (
    <LightPage>
      <SoftHeader title="Profile" />
      <div className="mx-4 space-y-3">
        <WhiteCard className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#007AFF]/15 text-2xl font-black text-[#007AFF]">
            OP
          </div>
          <p className="mt-3 text-lg font-bold">@openpay</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#34C759]/15 px-2.5 py-1 text-[11px] font-bold text-[#248A3D]">
            <ShieldCheck className="h-3 w-3" /> KYC approved
          </span>
        </WhiteCard>
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">Display name</p>
          <p className="mt-1 font-bold">OpenPay User</p>
        </WhiteCard>
        <div className="rounded-2xl bg-[#007AFF] py-3.5 text-center text-[15px] font-black text-white">
          Save Profile
        </div>
      </div>
    </LightPage>
  );
}

export function PosFrame() {
  return (
    <LightPage>
      <SoftHeader title="Merchant POS" />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">Charge amount</p>
          <p className="mt-1 text-4xl font-black">18.50</p>
          <p className="text-[13px] font-semibold text-[#007AFF]">OUSD</p>
        </WhiteCard>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#007AFF] py-4 text-center text-[14px] font-black text-white">
            Charge
          </div>
          <div className="rounded-2xl bg-white py-4 text-center text-[14px] font-bold ring-1 ring-black/10">
            Show QR
          </div>
        </div>
        <WhiteCard>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[#007AFF]" />
            <p className="font-bold">Today</p>
          </div>
          <p className="mt-2 text-2xl font-black">342.00 OUSD</p>
          <p className="text-[12px] text-[#8e8e93]">12 payments</p>
        </WhiteCard>
      </div>
    </LightPage>
  );
}

export function NotificationsFrame() {
  return (
    <LightPage>
      <SoftHeader title="Notifications" />
      <div className="mx-4 space-y-2">
        {[
          ["Payment received", "80.00 OUSD from @bob"],
          ["Mining ready", "Claim your session rewards"],
          ["KYC update", "Your verification was approved"],
        ].map(([t, s]) => (
          <div key={t} className="flex items-start gap-3 rounded-[20px] bg-white px-3.5 py-3 ring-1 ring-black/5">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#007AFF]/12">
              <Bell className="h-4 w-4 text-[#007AFF]" />
            </div>
            <div>
              <p className="text-[14px] font-bold">{t}</p>
              <p className="text-[12px] text-[#8e8e93]">{s}</p>
            </div>
          </div>
        ))}
      </div>
    </LightPage>
  );
}

export function ConverterFrame() {
  return (
    <LightPage>
      <SoftHeader title="Currency converter" />
      <div className="mx-4 space-y-3">
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">From · PI</p>
          <div className="mt-1 flex items-center gap-2">
            <img src={PI_TOKEN.logo} alt="" className="h-8 w-8 rounded-full" />
            <p className="text-3xl font-black">100</p>
          </div>
        </WhiteCard>
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#007AFF] text-white">
            <ArrowLeftRight className="h-4 w-4" />
          </div>
        </div>
        <WhiteCard>
          <p className="text-[12px] text-[#8e8e93]">To · OUSD</p>
          <div className="mt-1 flex items-center gap-2">
            <img src={OUSD_TOKEN.logoUrl} alt="" className="h-8 w-8 rounded-full" />
            <p className="text-3xl font-black">7.90</p>
          </div>
        </WhiteCard>
      </div>
    </LightPage>
  );
}

export function renderPreviewFrame(id: PreviewFrameId) {
  switch (id) {
    case "auth":
      return <AuthFrame />;
    case "wallet":
      return <WalletFrame />;
    case "assets":
      return <AssetsFrame />;
    case "savings":
      return <SavingsFrame />;
    case "credit":
      return <CreditFrame />;
    case "loans":
      return <LoansFrame />;
    case "buy":
      return <BuyFrame />;
    case "withdraw":
      return <WithdrawFrame />;
    case "send":
      return <SendFrame />;
    case "receive":
      return <ReceiveFrame />;
    case "request":
      return <RequestFrame />;
    case "invoice":
      return <InvoiceFrame />;
    case "scan":
      return <ScanFrame />;
    case "qrpay":
      return <QrPayFrame />;
    case "mining":
      return <MiningFrame />;
    case "staking":
      return <StakingFrame />;
    case "affiliate":
      return <AffiliateFrame />;
    case "rates":
      return <RatesFrame />;
    case "menu":
      return <MenuFrame />;
    case "ai":
      return <AiFrame />;
    case "nft":
      return <NftFrame />;
    case "card":
      return <CardFrame />;
    case "kyc":
      return <KycFrame />;
    case "activity":
      return <ActivityFrame />;
    case "send-pro":
      return <SendProFrame />;
    case "profile":
      return <ProfileFrame />;
    case "pos":
      return <PosFrame />;
    case "notifications":
      return <NotificationsFrame />;
    case "converter":
      return <ConverterFrame />;
    default:
      return null;
  }
}
