import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";

import BottomNav from "@/components/BottomNav";

import { Send, ArrowLeftRight, CircleDollarSign, FileText, Wallet, Activity, HelpCircle, Info, Scale, LogOut, Clapperboard, ShieldAlert, FileCheck, Lock, Users, Store, BookOpen, Download, Megaphone, Smartphone, CreditCard, ShieldCheck, Handshake, Monitor, Copy, X, TrendingUp, Pickaxe, Coins, Pointer, UserCheck, History, MessageSquare, Bot, QrCode, Bell, Settings, ExternalLink, RefreshCw } from "lucide-react";

import { toast } from "sonner";

import { clearAllAppSecurityUnlocks } from "@/lib/appSecurity";

import { canAccessRemittanceMerchant, isRemittanceUiEnabled } from "@/lib/remittanceAccess";

import { getShowApkBanner, setShowApkBanner, getShowOpenAppBanner, setShowOpenAppBanner } from "@/lib/userPreferencesStorage";

import { useCurrency } from "@/contexts/CurrencyContext";

import { PI_TO_USD } from "@/contexts/CurrencyContext";

import { CompactDigitalRateDisplay } from "@/components/ui/DigitalRateDisplay";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import BrandLogo from "@/components/BrandLogo";

import { QRCodeSVG } from "qrcode.react";



type BeforeInstallPromptEvent = Event & {

  prompt: () => Promise<void>;

  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;

};



const MenuPage = () => {
  const { liveRateClosed } = useCurrency();

  const OPENPAY_APK_URL = "https://median.co/share/rdzamax#apk";

  const OPENPAY_DESKTOP_EXE_URL = String(import.meta.env.VITE_OPENPAY_DESKTOP_EXE_URL || "").trim();

  const navigate = useNavigate();

  const remittanceUiEnabled = isRemittanceUiEnabled();

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const [canInstall, setCanInstall] = useState(false);

  const [showApkModal, setShowApkModal] = useState(false);

  const [showApkBanner, setShowApkBanner] = useState(() => {

    return getShowApkBanner();

  });



  const [showOpenAppBanner, setShowOpenAppBanner] = useState(() => {

    return getShowOpenAppBanner();

  });



  const hideApkBanner = () => {

    setShowApkBanner(false);

  };



  const hideOpenAppBanner = () => {

    setShowOpenAppBanner(false);

  };

  const [welcomeClaimedAt, setWelcomeClaimedAt] = useState<string | null>(null);

  const [claimingWelcome, setClaimingWelcome] = useState(false);

  const [hasRemittanceAccess, setHasRemittanceAccess] = useState(false);

  const [canOpenAdminDashboard, setCanOpenAdminDashboard] = useState(false);

  const [canOpenMasterTopUp, setCanOpenMasterTopUp] = useState(false);



  useEffect(() => {

    const handler = (event: Event) => {

      event.preventDefault();

      setInstallPrompt(event as BeforeInstallPromptEvent);

      setCanInstall(true);

    };

    window.addEventListener("beforeinstallprompt", handler);

    

    // Listen for APK modal open event from Dashboard

    const openApkModalHandler = () => {

      setShowApkModal(true);

    };

    window.addEventListener('openApkModal', openApkModalHandler);

    

    return () => {

      window.removeEventListener("beforeinstallprompt", handler);

      window.removeEventListener('openApkModal', openApkModalHandler);

    };

  }, []);



  useEffect(() => {

    const loadWelcomeStatus = async () => {

      const {

        data: { user },

      } = await supabase.auth.getUser();

      if (!user) return;



      const { data: profile } = await supabase

        .from("profiles")

        .select("username")

        .eq("id", user.id)

        .single();

      const normalizedUsername = String(profile?.username || "")

        .trim()

        .toLowerCase()

        .replace(/^@/, "");

      const isWainFoundation = normalizedUsername === "wainfoundation";

      setCanOpenAdminDashboard(normalizedUsername === "openpay" || isWainFoundation);

      setCanOpenMasterTopUp(isWainFoundation);

      if (remittanceUiEnabled) {

        setHasRemittanceAccess(canAccessRemittanceMerchant(user.id, profile?.username || null));

      }



      const { data: wallet } = await supabase

        .from("wallets")

        .select("welcome_bonus_claimed_at")

        .eq("user_id", user.id)

        .single();

      setWelcomeClaimedAt(wallet?.welcome_bonus_claimed_at || null);

    };

    loadWelcomeStatus();

  }, [remittanceUiEnabled]);



  const handleInstall = async () => {

    if (!installPrompt) {

      window.open(OPENPAY_APK_URL, "_blank", "noopener,noreferrer");

      return;

    }

    await installPrompt.prompt();

    const choice = await installPrompt.userChoice;

    setCanInstall(choice.outcome === "accepted" ? false : true);

    if (choice.outcome === "accepted") {

      setInstallPrompt(null);

      return;

    }

    window.open(OPENPAY_APK_URL, "_blank", "noopener,noreferrer");

  };



  const handleDesktopExe = () => {

    if (!OPENPAY_DESKTOP_EXE_URL) {

      toast.message("OpenPay Desktop EXE coming soon");

      return;

    }

    window.open(OPENPAY_DESKTOP_EXE_URL, "_blank", "noopener,noreferrer");

  };



  const handleOpenApkModal = () => {

    setShowApkModal(true);

  };



  const handleDownloadApk = () => {

    window.open(OPENPAY_APK_URL, "_blank", "noopener,noreferrer");

  };



  const handleCopyApkLink = async () => {

    try {

      await navigator.clipboard.writeText(OPENPAY_APK_URL);

      toast.success("APK link copied");

    } catch {

      toast.error("Copy failed");

    }

  };



  const handleCopyMegaKey = async () => {

    // No longer needed since we're using median.co instead of Mega

    toast.success("Download link copied - No key needed!");

  };



  const handleLogout = async () => {

    clearAllAppSecurityUnlocks();

    await supabase.auth.signOut();

    toast.success("Logged out");

    navigate("/auth");

  };



  const handleClaimWelcome = async () => {

    setClaimingWelcome(true);

    const { data, error } = await supabase.rpc("claim_welcome_bonus");

    setClaimingWelcome(false);

    if (error) {

      toast.error(error.message);

      return;

    }

    const claimed = (data as { claimed?: boolean } | null)?.claimed;

    if (claimed) {

      toast.success("Welcome bonus claimed");

    } else {

      toast.message("Welcome bonus already claimed");

    }



    const {

      data: { user },

    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: wallet } = await supabase

      .from("wallets")

      .select("welcome_bonus_claimed_at")

      .eq("user_id", user.id)

      .single();

    setWelcomeClaimedAt(wallet?.welcome_bonus_claimed_at || null);

  };



  const sections = [

    {

      title: "Transactions",

      layout: "grid-top",

      items: [

        { icon: Send, label: "Express Send", action: () => navigate("/send") },

        { icon: ArrowLeftRight, label: "Transfer", action: () => navigate("/topup") },

        { icon: ArrowLeftRight, label: "Swap", action: () => navigate("/swap-withdrawal") },

        { icon: CircleDollarSign, label: "Request", action: () => navigate("/request-payment") },

        { icon: FileText, label: "Invoice", action: () => navigate("/send-invoice") },

        { icon: History, label: "Top-Up History", action: () => navigate("/topup-history") },

      ],

    },

    {

      title: "Secure banking",

      layout: "grid-card",

      color: "bg-green-50 dark:bg-green-950/30",

      textColor: "text-green-900 dark:text-green-100",

      items: [

        { icon: Wallet, label: "Wallet", action: () => navigate("/dashboard") },

        { icon: TrendingUp, label: "Analytics", action: () => navigate("/dashboard?section=analytics") },

        { icon: Bot, label: "OpenPay AI", action: () => navigate("/ai") },

        { icon: Users, label: "User profile", action: () => navigate("/profile") },

        { icon: ShieldCheck, label: "Two-Factor Auth", action: () => navigate("/two-factor") },

        { icon: UserCheck, label: "KYC Verification", action: () => navigate("/kyc") },

        { icon: CreditCard, label: "Virtual Card", action: () => navigate("/virtual-card") },

        { icon: ArrowLeftRight, label: "Currency converter", action: () => navigate("/currency-converter") },

        { icon: Pickaxe, label: "Mining", action: () => navigate("/mining") },

        { icon: Coins, label: "Staking", action: () => navigate("/staking") },

      ],

    },

    {

      title: "Merchant services",

      layout: "grid-card",

      color: "bg-blue-50 dark:bg-blue-950/30",

      textColor: "text-blue-900 dark:text-blue-100",

        items: [

          { icon: Store, label: "Merchant Portal", action: () => navigate("/merchant-onboarding") },

          { icon: Store, label: "Product Catalog", action: () => navigate("/merchant-products") },

          { icon: Store, label: "Merchant POS", action: () => navigate("/merchant-pos") },

          { icon: FileText, label: "Payment Link Creator", action: () => navigate("/payment-links/create") },

          { icon: Pointer, label: "Buttons", subtitle: "OpenPay", action: () => navigate("/buttons") },

          ...(remittanceUiEnabled

            ? [{

                icon: Store,

              label: "Remittance Center",

              action: () => {

                if (hasRemittanceAccess) {

                  navigate("/remittance-merchant");

                  return;

                }

                toast.message("Coming soon");

              },

              disabled: !hasRemittanceAccess,

              subtitle: hasRemittanceAccess ? "Developer access enabled" : "Under development",

            }]

          : []),

      ],

    },

    {

      title: "Earning & Rewards",

      layout: "grid-card",

      color: "bg-orange-50 dark:bg-orange-950/30",

      textColor: "text-orange-900 dark:text-orange-100",

      items: [

        { icon: Users, label: "Affiliate", action: () => navigate("/affiliate") },

        { icon: Clapperboard, label: "Pi Ad Network", action: () => navigate("/pi-ads") },

        {

          icon: CircleDollarSign,

          label: welcomeClaimedAt ? "Bonus Claimed" : "Claim $1",

          action: () => handleClaimWelcome(),

          disabled: Boolean(welcomeClaimedAt) || claimingWelcome,

        },

        { icon: Megaphone, label: "Announcements", action: () => navigate("/announcements") },

        { icon: Megaphone, label: "Blog", action: () => window.open("https://www.openpy.space/blog", "_blank", "noopener,noreferrer") },

      ],

    },

    {

      title: "Activity & Records",

      layout: "grid-card",

      color: "bg-gray-50 dark:bg-gray-900/50",

      textColor: "text-gray-900 dark:text-gray-100",

      items: [

        { icon: Activity, label: "Activity", action: () => navigate("/activity") },

        { icon: BookOpen, label: "OpenLedger", action: () => navigate("/ledger") },

        { icon: ShieldAlert, label: "Disputes", action: () => navigate("/disputes") },

        { icon: HelpCircle, label: "Help Center", action: () => navigate("/help-center") },

        { icon: MessageSquare, label: "Telegram Support", action: () => window.open("https://t.me/openpayofficial", "_blank", "noopener,noreferrer") },

        { icon: Megaphone, label: "Announcements", action: () => navigate("/announcements") },

        { icon: Megaphone, label: "Blog", action: () => window.open("https://www.openpy.space/blog", "_blank", "noopener,noreferrer") },

        { icon: Smartphone, label: "Official Page", action: () => navigate("/openpay-official") },

        { icon: Store, label: "Guide", action: () => navigate("/openpay-guide") },

        { icon: Handshake, label: "Open Partner", action: () => navigate("/open-partner") },

      ],

    },

    {

      title: "Utility & Apps",

      layout: "grid-card",

      color: "bg-purple-50 dark:bg-purple-950/30",

      textColor: "text-purple-900 dark:text-purple-100",

      items: [

        { icon: Smartphone, label: "OpenApp Utilities", action: () => navigate("/openapp") },

        { icon: Monitor, label: "Pi Browser", action: () => navigate("/openpay-desktop") },

        { icon: Monitor, label: "Desktop EXE", action: () => handleDesktopExe() },

        { icon: Download, label: "Install APK", action: () => handleOpenApkModal() },

        { icon: Smartphone, label: "Tablet APK", action: () => handleOpenApkModal() },

        { icon: Smartphone, label: "iOS App", action: () => toast.message("Coming soon"), disabled: true },

      ],

    },

    {

      title: "Legal & Docs",

      layout: "grid-card",

      color: "bg-slate-50 dark:bg-slate-900/50",

      textColor: "text-slate-900 dark:text-slate-100",

      items: [

        { icon: BookOpen, label: "Documentation", action: () => navigate("/openpay-documentation") },

        { icon: FileText, label: "OUSD Whitepaper", action: () => navigate("/whitepaper") },

        { icon: FileText, label: "Pi Whitepaper", action: () => navigate("/pi-whitepaper") },

        { icon: FileText, label: "MiCA Whitepaper", action: () => navigate("/pi-mica-whitepaper") },

        { icon: ShieldCheck, label: "Regulatory", action: () => navigate("/regulatory-status") },

        { icon: ShieldCheck, label: "GDPR", action: () => navigate("/gdpr") },

        { icon: Info, label: "About", action: () => navigate("/about-openpay") },

        { icon: FileCheck, label: "Terms", action: () => navigate("/terms") },

        { icon: Lock, label: "Privacy", action: () => navigate("/privacy") },

        { icon: Scale, label: "Legal", action: () => navigate("/legal") },

      ],

    },

    {

      title: "API & Developer",

      layout: "grid-card",

      color: "bg-indigo-50 dark:bg-indigo-950/30",

      textColor: "text-indigo-900 dark:text-indigo-100",

      items: [

        { icon: BookOpen, label: "API Docs", action: () => navigate("/openpay-api-docs") },

        { icon: BookOpen, label: "POS Docs", action: () => navigate("/openpay-pos-docs") },

        { icon: BookOpen, label: "Merchant Docs", action: () => navigate("/openpay-merchant-portal-docs") },

      ],

    },

    ...(canOpenAdminDashboard

      ? [{

          title: "Admin Control",

          layout: "grid-card",

          color: "bg-red-50 dark:bg-red-950/30",

          textColor: "text-red-900 dark:text-red-100",

          items: [

            { icon: ShieldCheck, label: "Dashboard", action: () => navigate("/admin-dashboard") },

            { icon: ShieldCheck, label: "KYC Review", action: () => navigate("/admin-kyc-review") },

            { icon: ShieldCheck, label: "Withdrawals", action: () => navigate("/admin-swap-withrawals") },

            { icon: ShieldCheck, label: "Loans", action: () => navigate("/admin-loan-applications") },

            { icon: ShieldCheck, label: "Top Ups", action: () => navigate("/admin-topup-requests") },

            ...(canOpenMasterTopUp

              ? [{ icon: ShieldCheck, label: "Master Top Up", action: () => navigate("/master-topup") }]

              : []),

          ],

        }]

      : []),

    {

      title: "Quick Links",

      layout: "grid-card",

      color: "bg-teal-50",

      textColor: "text-teal-900",

      items: [

        { icon: QrCode, label: "QR Scanner", action: () => navigate("/qr-scanner") },

        { icon: Bell, label: "Notifications", action: () => navigate("/notifications") },

        { icon: Settings, label: "Settings", action: () => navigate("/settings") },

        { icon: Download, label: "Downloads", action: () => handleOpenApkModal() },

        { icon: ExternalLink, label: "Support", action: () => window.open("https://t.me/openpayofficial", "_blank", "noopener,noreferrer") },

        { icon: RefreshCw, label: "Refresh", action: () => window.location.reload() },

      ],

    },

  ];



  return (

    <div className="min-h-screen bg-paypal-blue px-4 pt-8 pb-10 text-white animate-fadeIn">

      <div className="px-4 pt-8">

        <h1 className="text-3xl font-bold text-white mb-8 animate-slideInDown">Services</h1>

        

        {/* Compact Rate Display */}

        <CompactDigitalRateDisplay

          rates={{

            piToOusd: PI_TO_USD,

            usdToOusd: 1

          }}

          liveRateClosed={liveRateClosed}

          className="mb-6 animate-fadeIn"

        />

        

        {/* APK Promotion Banner */}

        {showApkBanner && (

          <div className="mb-8 animate-in-up hover-lift-enhanced">
            <div className="bg-white rounded-[2.5rem] p-6 border-2 border-blue-500 shadow-xl relative transition-all duration-300 hover:shadow-2xl">
              <button
                onClick={hideApkBanner}
                className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-300 z-10 hover:scale-110 hover-lift"
                aria-label="Close APK banner"
              >
                <X className="h-4 w-4 transition-transform duration-300 hover:rotate-90" />
              </button>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 border-2 border-blue-600 animate-pulse-slow hover-lift">
                    <Smartphone className="h-7 w-7 text-white transition-transform duration-300 hover:scale-110" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-black text-xl mb-1 animate-fadeIn">🚀 Get OpenPay Mobile App</h3>
                    <p className="text-sm text-gray-700 mb-3 animate-fadeIn" style={{ animationDelay: "0.1s" }}>Download the official OpenPay APK for Android</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full border border-blue-200 animate-fadeIn hover-lift" style={{ animationDelay: "0.2s" }}>New Features</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200 animate-fadeIn hover-lift" style={{ animationDelay: "0.3s" }}>Enhanced Security</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-shrink-0">
                  <button
                    onClick={handleOpenApkModal}
                    className="bg-blue-500 px-6 py-3 rounded-xl border-2 border-blue-600 hover:bg-blue-600 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-105 hover-lift hover-glow btn-press w-full sm:w-auto"
                  >
                    <Download className="h-5 w-5 text-white transition-transform duration-300" />
                    <span className="text-sm font-semibold text-white">Download APK</span>
                  </button>
                  <button
                    onClick={handleOpenApkModal}
                    className="text-xs text-gray-600 hover:text-gray-800 transition-all duration-300 hover:scale-105 hover-lift text-center sm:text-right"
                  >
                    View QR Code →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {sections.map((section, sectionIndex) => (
          <div key={section.title} className="mb-8 animate-in-up hover-lift-enhanced" style={{ animationDelay: `${sectionIndex * 0.1}s` }}>

            {section.layout === "grid-top" ? (

              <div className="flex justify-between items-start gap-2 mb-4 px-1">

                {section.items.map(({ icon: Icon, label, action, disabled }, itemIndex) => (

                  <button

                    key={label}

                    onClick={action}

                    disabled={disabled}

                    className={`flex flex-col items-center gap-2 flex-1 transition-all duration-300 ios-active stagger-item hover:scale-110 hover-lift ${

                      disabled ? "opacity-40 cursor-not-allowed" : "hover-glow"

                    }`}

                    style={{ animationDelay: `${itemIndex * 0.05}s` }}

                  >

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-paypal-blue shadow-sm border-2 border-paypal-blue transition-transform duration-300 hover:scale-110 hover:rotate-6">

                      <Icon className="h-6 w-6 text-white transition-transform duration-300" />

                    </div>

                    <span className="text-[11px] font-bold text-center leading-tight text-white transition-colors duration-300">{label}</span>

                  </button>

                ))}

              </div>

            ) : (

              <div className="bg-white overflow-hidden rounded-[2.5rem] border-2 border-blue-500 shadow-xl transition-all duration-300 hover:shadow-2xl hover-lift-enhanced">

                <div className={`px-6 py-4 ${section.color || "bg-blue-50"} transition-colors duration-300`}>

                  <h2 className={`text-lg font-black tracking-tight ${section.textColor || "text-black"} transition-colors duration-300`}>{section.title}</h2>

                </div>

                <div className="p-4 grid grid-cols-4 gap-y-8 gap-x-2 bg-white">

                  {section.items.map(({ icon: Icon, label, action, disabled, subtitle }, itemIndex) => (

                    <button

                      key={label}

                      onClick={action}

                      disabled={disabled}

                      className={`flex flex-col items-center gap-2 transition-all duration-300 ios-active stagger-item ${

                        disabled ? "opacity-40 cursor-not-allowed" : "hover:scale-110 hover-lift hover-glow"

                      }`}

                      style={{ animationDelay: `${itemIndex * 0.05}s` }}

                    >

                      <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-blue-500 shadow-sm border-2 border-blue-600 transition-all duration-300 hover:scale-110 hover:rotate-6">

                        <Icon className="h-7 w-7 text-white transition-transform duration-300" />

                      </div>

                      <div className="flex flex-col items-center gap-0.5 px-1">

                        <span className="text-[10px] font-bold text-center leading-tight text-black line-clamp-2 transition-colors duration-300">{label}</span>

                        {subtitle && <span className="text-[8px] text-gray-600 text-center leading-tight line-clamp-1 transition-colors duration-300">{subtitle}</span>}

                      </div>

                    </button>

                  ))}

                </div>

              </div>

            )}

          </div>

        ))}



        <button

          onClick={handleLogout}

          className="mt-4 w-full flex items-center justify-center gap-3 rounded-2xl bg-red-50 py-4 text-red-600 font-bold transition hover:bg-red-100"

        >

          <LogOut className="h-5 w-5" />

          <span>Log Out</span>

        </button>

      </div>



      <BottomNav active="menu" />



      <Dialog open={showApkModal} onOpenChange={setShowApkModal}>

        <DialogContent className="rounded-3xl p-0 sm:max-w-2xl [&>button]:hidden">

          <div className="relative bg-white px-6 py-6 text-foreground">

            <button

              type="button"

              onClick={() => setShowApkModal(false)}

              className="absolute right-4 top-4 rounded-full p-1 text-foreground/70 hover:bg-black/5"

              aria-label="Close APK modal"

            >

              <X className="h-5 w-5" />

            </button>



            <div className="mx-auto flex max-w-md flex-col items-center text-center">

              <BrandLogo className="h-16 w-16 rounded-2xl" />

              <p className="mt-2 text-3xl font-bold">OpenPay</p>

              <p className="mt-6 text-xl text-foreground/85">

                Scan this QR to open OpenPay on your Android phone or tablet, then download and install the APK.

              </p>



              <div className="mt-5 rounded-2xl bg-white p-2">

                <QRCodeSVG

                  value={OPENPAY_APK_URL}

                  size={180}

                  bgColor="#ffffff"

                  fgColor="#000000"

                  includeMargin

                />

              </div>



              <button

                type="button"

                onClick={() => void handleCopyApkLink()}

                className="mt-4 h-12 w-full rounded-xl bg-gray-700 px-4 text-lg font-semibold text-white hover:bg-gray-600"

              >

                <span className="inline-flex items-center gap-2">

                  <Copy className="h-4 w-4 text-white" />

                  Copy download link

                </span>

              </button>



              <button

                type="button"

                onClick={() => void handleCopyMegaKey()}

                className="mt-3 h-12 w-full rounded-xl bg-gray-700 px-4 text-lg font-semibold text-white hover:bg-gray-600"

              >

                <span className="inline-flex items-center gap-2">

                  <Copy className="h-4 w-4 text-white" />

                  Copy download link again

                </span>

              </button>



              <button

                type="button"

                onClick={handleDownloadApk}

                className="mt-6 h-12 w-full rounded-xl bg-neutral-200 px-4 text-lg font-semibold hover:bg-neutral-300"

              >

                <span className="inline-flex items-center gap-2">

                  <Download className="h-4 w-4" />

                  Download Android Phone/Tablet APK

                </span>

              </button>



              <p className="mt-4 text-sm text-foreground/80">

                Download the OpenPay APK to enjoy all features on your Android device!

              </p>

              {canInstall && (

                <button

                  type="button"

                  onClick={() => void handleInstall()}

                  className="mt-3 h-11 w-full rounded-xl border border-neutral-300 px-4 text-base font-semibold hover:bg-neutral-100"

                >

                  Use browser install prompt

                </button>

              )}

            </div>

          </div>

        </DialogContent>

      </Dialog>

    </div>

  );

};



export default MenuPage;

