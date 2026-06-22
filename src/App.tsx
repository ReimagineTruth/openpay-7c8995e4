import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import AdminMrwainAuth from "./pages/AdminMrwainAuth";
import AuthCallbackPage from "./pages/AuthCallback";
import AuthCallback from "./pages/AuthCallback";
import TwoFactorAuthPage from "./pages/TwoFactorAuthPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ForgotMpinPage from "./pages/ForgotMpinPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Dashboard from "./pages/Dashboard";
import DashboardSwitcher from "./components/DashboardSwitcher";
import SendMoney from "./pages/SendMoney";
import QrScannerPage from "./pages/QrScannerPage";
import TopUp from "./pages/TopUp";
import TopUpEwalletQrPh from "./pages/TopUpEwalletQrPh";
import TopUpPaypal from "./pages/TopUpPaypal";
import TopUpDebit from "./pages/TopUpDebit";
import TopUpCredit from "./pages/TopUpCredit";
import TopUpApplePay from "./pages/TopUpApplePay";
import TopUpGooglePay from "./pages/TopUpGooglePay";
import TopUpStripe from "./pages/TopUpStripe";
import TopUpStripeReturnPage from "./pages/TopUpStripeReturnPage";
import TopUpVenmo from "./pages/TopUpVenmo";
import TopUpUSDT from "./pages/TopUpUSDT";
import TopUpUSDC from "./pages/TopUpUSDC";
import TopUpMRWN from "./pages/TopUpMRWN";
import TopUpOUSD from "./pages/TopUpOUSD";
import TopUpOUSDSol from "./pages/TopUpOUSDSol";
import TopUpSolanaPay from "./pages/TopUpSolanaPay";
import ReceivePage from "./pages/ReceivePage";
import Contacts from "./pages/Contacts";
import MenuPage from "./pages/MenuPage";
import CurrencyConverterPage from "./pages/CurrencyConverterPage";
import ActivityPage from "./pages/ActivityPage";
import RequestMoney from "./pages/RequestMoney";
import DisputesPage from "./pages/DisputesPage";
import SendInvoice from "./pages/SendInvoice";
import HelpCenter from "./pages/HelpCenter";
import HelpWikiPage from "./pages/HelpWikiPage";
import BlogPage from "./pages/BlogPage";
import BlogPostPage from "./pages/BlogPostPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import AffiliatePage from "./pages/AffiliatePage";
import AdminAffiliatePage from "./pages/AdminAffiliatePage";
import MiningPage from "./pages/MiningPage";
import StakingPage from "./pages/StakingPage";
import ButtonsPage from "./pages/ButtonsPage";
import ButtonsPaymentLinksPage from "./pages/buttons/ButtonsPaymentLinksPage";
import ButtonsCartPage from "./pages/buttons/ButtonsCartPage";
import ButtonsDonatePage from "./pages/buttons/ButtonsDonatePage";
import ButtonsSubscribePage from "./pages/buttons/ButtonsSubscribePage";
import ButtonsEmbedsPage from "./pages/buttons/ButtonsEmbedsPage";
import DownloadPage from "./pages/DownloadPage";
import OpenPayGuidePage from "./pages/OpenPayGuidePage";
import OpenPayAIPage from "./pages/OpenPayAIPage";
import PublicLedgerPage from "./pages/PublicLedgerPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RegulatoryStatusPage from "./pages/RegulatoryStatusPage";
import AboutOpenPayPage from "./pages/AboutOpenPayPage";
import LegalPage from "./pages/LegalPage";
import OpenPayDocumentationPage from "./pages/OpenPayDocumentationPage";
import OpenPayApiDocsPage from "./pages/OpenPayApiDocsPage";
import OpenPayPosDocsPage from "./pages/OpenPayPosDocsPage";
import OpenPayMerchantPortalDocsPage from "./pages/OpenPayMerchantPortalDocsPage";
import OpenPartnerPage from "./pages/OpenPartnerPage";
import PiWhitepaperPage from "./pages/PiWhitepaperPage";
import PiMicaWhitepaperPage from "./pages/PiMicaWhitepaperPage";
import WhitepaperPage from "./pages/WhitepaperPage";
import GdprPage from "./pages/GdprPage";
import PaymentLinksCreatePage from "./pages/PaymentLinksCreatePage";
import MerchantProductCatalogPage from "./pages/MerchantProductCatalogPage";
import MerchantProductCreatePage from "./pages/MerchantProductCreatePage";
import PiAuthPage from "./pages/PiAuthPage";
import SetupProfilePage from "./pages/SetupProfilePage";
import PiAdsPage from "./pages/PiAdsPage";
import OnboardingPage from "./pages/OnboardingPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSwapWithdrawalsPage from "./pages/AdminSwapWithdrawalsPage";
import AdminLoanApplicationsPage from "./pages/AdminLoanApplicationsPage";
import AdminTopUpRequestsPage from "./pages/AdminTopUpRequestsPage";
import AdminMasterTopUp from "./pages/AdminMasterTopUp";
import MerchantOnboardingPage from "./pages/MerchantOnboardingPage";
import OpenPayOfficialPage from "./pages/OpenPayOfficialPage";
import RemittanceMerchantPage from "./pages/RemittanceMerchantPage";
import RemittanceCenterPage from "./pages/RemittanceCenterPage";
import MerchantPosPage from "./pages/MerchantPosPage";
import MerchantCheckoutPage from "./pages/MerchantCheckoutPage";
import MerchantCheckoutThankYouPage from "./pages/MerchantCheckoutThankYouPage";
import PosThankYouPage from "./pages/PosThankYouPage";
import PublicWalletPaymentPage from "./pages/PublicWalletPaymentPage";
import UsernamePayPage from "./pages/UsernamePayPage";
import OpenAppPage from "./pages/OpenAppPage";
import OpenPayDesktopPage from "./pages/OpenPayDesktopPage";
import VirtualCardPage from "./pages/VirtualCardPage";
import KycPage from "./pages/KycPage";
import KycStatusPage from "./pages/KycStatusPage";
import AdminKycReview from "./pages/AdminKycReview";
import AdminKycMetricsPage from "./pages/AdminKycMetricsPage";
import AdminOpenPayMetricsPage from "./pages/AdminOpenPayMetricsPage";
import LiveCustomerServicePage from "./pages/LiveCustomerServicePage";
import SwapWithdrawalPage from "./pages/SwapWithdrawalPage";
import ConfirmPinPage from "./pages/ConfirmPinPage";
import SmartContractApiPage from "./pages/SmartContractApiPage";
import DeveloperDashboardPage from "./pages/DeveloperDashboardPage";
import AppDeveloperDashboardPage from "./pages/AppDeveloperDashboardPage";
import AppPaymentCheckoutPage from "./pages/AppPaymentCheckoutPage";
import AppPayApprovePage from "./pages/AppPayApprovePage";
import AppPaymentSuccessPage from "./pages/AppPaymentSuccessPage";
import NotFoundPage from "./pages/NotFoundPage";
import QrPayDashboardPage from "./pages/QrPayDashboardPage";
import QrPayCreatePage from "./pages/QrPayCreatePage";
import QrPayApiDashboardPage from "./pages/QrPayApiDashboardPage";
import QrPayCheckoutPage from "./pages/QrPayCheckoutPage";
import QrPaySuccessPage from "./pages/QrPaySuccessPage";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { useRealtimePushNotifications } from "./hooks/useRealtimePushNotifications";
import AppSecurityGate from "./components/AppSecurityGate";
import AppFooter from "./components/AppFooter";
import AuthMark from "./components/AuthMark";
import AppLanguageTranslate from "./components/AppLanguageTranslate";
import SupportWidget from "./components/SupportWidget";
import SupportPage from "./pages/SupportPage";
import TopUpHistoryPage from "./pages/TopUpHistoryPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { CookieConsentProvider } from "./contexts/CookieConsentContext";
import { ThankYouModalProvider } from "./contexts/ThankYouModalContext";
import ThankYouModal from "./components/ThankYouModal";
import GlobalThankYouModal from "./components/GlobalThankYouModal";
import PageTransition from "./components/PageTransition";
import { isSolanaPayEnabled } from "@/lib/solanaPayAccess";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeLoaderReady = useRef(false);
  const [showRouteSplash, setShowRouteSplash] = useState(true);
  const navigateRef = useRef(navigate);
  
  // Update the ref whenever navigate changes
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      routeLoaderReady.current = true;
      setShowRouteSplash(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!routeLoaderReady.current) {
      return;
    }

    // Don't show route splash for dashboard and auth routes to prevent conflicts
    const excludedRoutes = ['/dashboard', '/auth', '/'];
    const isExcludedRoute = excludedRoutes.some(route => 
      location.pathname === route || location.pathname.startsWith(route + '/')
    );

    if (isExcludedRoute) {
      return;
    }

    setShowRouteSplash(true);
    const timer = window.setTimeout(() => setShowRouteSplash(false), 500);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  // Handle OAuth callbacks
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email, 'current path:', location.pathname);
      
      if (event === 'SIGNED_IN' && session) {
        // Clear OAuth hash fragments
        if (window.location.hash) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Only redirect to dashboard if user is on an auth/landing page.
        // Token refreshes and re-emitted SIGNED_IN events should NEVER
        // bounce a user away from the page they're currently using.
        const authPaths = ['/', '/auth', '/sign-in', '/signin', '/signup', '/auth/callback'];
        const isOnAuthPage = authPaths.includes(location.pathname);

        if (isOnAuthPage) {
          console.log('Redirecting to dashboard from auth page:', location.pathname);
          navigateRef.current('/dashboard', { replace: true });
        }
      } else if (event === 'SIGNED_OUT') {
        // Only redirect if not already on sign-in page and not on a public path
        const publicPaths = ['/', '/auth', '/sign-in', '/signin', '/signup', '/terms', 'privacy', 'about-openpay', 'legal', 'help-center'];
        const isPublicPath = publicPaths.some(path => location.pathname === path) || 
                            location.pathname.startsWith('/pay/') ||
                            location.pathname.startsWith('/forgot') ||
                            location.pathname.startsWith('/reset') ||
                            location.pathname.startsWith('/two-factor');
        
        if (!isPublicPath && location.pathname !== '/sign-in' && !location.pathname.includes('/signin')) {
          console.log('Redirecting to sign-in from:', location.pathname);
          navigateRef.current('/sign-in', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [location.pathname]);

  const LegacyAdminMrwainRedirect = () => {
    const current = useLocation();
    return <Navigate to={`/sign-in${current.search || ""}`} replace />;
  };

  return (
    <>
      <PageTransition key={location.pathname}>
        <main>
        <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<PiAuthPage />} />
        <Route path="/setup-profile" element={<SetupProfilePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
         <Route path="/pi-ads" element={<PiAdsPage />} />
         <Route path="/sign-in" element={<AdminMrwainAuth />} />
         <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/forgot-mpin" element={<ForgotMpinPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/two-factor" element={<TwoFactorAuthPage />} />
        <Route path="/admin-mrwain" element={<LegacyAdminMrwainRedirect />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin-swap-withrawals" element={<AdminSwapWithdrawalsPage />} />
        <Route path="/admin-loan-applications" element={<AdminLoanApplicationsPage />} />
        <Route path="/admin-topup-requests" element={<AdminTopUpRequestsPage />} />
        <Route path="/master-topup" element={<AdminMasterTopUp />} />
        <Route path="/signin" element={<Navigate to="/sign-in?mode=signin" replace />} />
        <Route path="/signup" element={<Navigate to="/sign-in?mode=signup" replace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardSwitcher />
          </ProtectedRoute>
        } />
        <Route path="/send" element={
          <ProtectedRoute>
            <SendMoney />
          </ProtectedRoute>
        } />
        <Route path="/scan-qr" element={
          <ProtectedRoute>
            <QrScannerPage />
          </ProtectedRoute>
        } />
        <Route path="/topup" element={
          <ProtectedRoute>
            <TopUp />
          </ProtectedRoute>
        } />
        <Route path="/topup-ewallet-qrph" element={
          <ProtectedRoute>
            <TopUpEwalletQrPh />
          </ProtectedRoute>
        } />
        <Route path="/topup-paypal" element={
          <ProtectedRoute>
            <TopUpPaypal />
          </ProtectedRoute>
        } />
        <Route path="/topup-debit" element={
          <ProtectedRoute>
            <TopUpDebit />
          </ProtectedRoute>
        } />
        <Route path="/topup-credit" element={
          <ProtectedRoute>
            <TopUpCredit />
          </ProtectedRoute>
        } />
        <Route path="/topup-apple-pay" element={
          <ProtectedRoute>
            <TopUpApplePay />
          </ProtectedRoute>
        } />
        <Route path="/topup-google-pay" element={
          <ProtectedRoute>
            <TopUpGooglePay />
          </ProtectedRoute>
        } />
        <Route path="/topup-stripe" element={
          <ProtectedRoute>
            <TopUpStripe />
          </ProtectedRoute>
        } />
        <Route path="/topup/stripe/return" element={
          <ProtectedRoute>
            <TopUpStripeReturnPage />
          </ProtectedRoute>
        } />
        <Route path="/topup-venmo" element={
          <ProtectedRoute>
            <TopUpVenmo />
          </ProtectedRoute>
        } />
        <Route path="/topup-usdt" element={
          <ProtectedRoute>
            <TopUpUSDT />
          </ProtectedRoute>
        } />
        <Route path="/topup-usdc" element={
          <ProtectedRoute>
            <TopUpUSDC />
          </ProtectedRoute>
        } />
        <Route path="/topup-mrwn" element={
          <ProtectedRoute>
            <TopUpMRWN />
          </ProtectedRoute>
        } />
        <Route path="/topup-ousd" element={
          <ProtectedRoute>
            <TopUpOUSD />
          </ProtectedRoute>
        } />
        <Route path="/topup-ousd-sol" element={
          <ProtectedRoute>
            <TopUpOUSDSol />
          </ProtectedRoute>
        } />
        {isSolanaPayEnabled() ? <Route path="/topup-solana-pay" element={
          <ProtectedRoute>
            <TopUpSolanaPay />
          </ProtectedRoute>
        } /> : null}
        <Route path="/receive" element={
          <ProtectedRoute>
            <ReceivePage />
          </ProtectedRoute>
        } />
        <Route path="/contacts" element={
          <ProtectedRoute>
            <Contacts />
          </ProtectedRoute>
        } />
        <Route path="/menu" element={
          <ProtectedRoute>
            <MenuPage />
          </ProtectedRoute>
        } />
        <Route path="/currency-converter" element={
          <ProtectedRoute>
            <CurrencyConverterPage />
          </ProtectedRoute>
        } />
        <Route path="/remittance-center" element={
          <ProtectedRoute>
            <RemittanceCenterPage />
          </ProtectedRoute>
        } />
        <Route path="/activity" element={
          <ProtectedRoute>
            <ActivityPage />
          </ProtectedRoute>
        } />
        <Route path="/ai" element={
          <ProtectedRoute>
            <OpenPayAIPage />
          </ProtectedRoute>
        } />
        <Route path="/request-payment" element={
          <ProtectedRoute>
            <RequestMoney />
          </ProtectedRoute>
        } />
        <Route path="/send-invoice" element={
          <ProtectedRoute>
            <SendInvoice />
          </ProtectedRoute>
        } />
        <Route path="/disputes" element={
          <ProtectedRoute>
            <DisputesPage />
          </ProtectedRoute>
        } />
        <Route path="/help-center" element={<HelpCenter />} />
        <Route path="/help" element={<HelpWikiPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/affiliate" element={
          <ProtectedRoute>
            <AffiliatePage />
          </ProtectedRoute>
        } />
        <Route path="/admin/affiliate" element={
          <ProtectedRoute>
            <AdminAffiliatePage />
          </ProtectedRoute>
        } />
        <Route path="/mining" element={
          <ProtectedRoute>
            <MiningPage />
          </ProtectedRoute>
        } />
        <Route path="/staking" element={
          <ProtectedRoute>
            <StakingPage />
          </ProtectedRoute>
        } />
        <Route path="/buttons" element={
          <ProtectedRoute>
            <ButtonsPage />
          </ProtectedRoute>
        } />
        <Route path="/buttons/payment-links" element={
          <ProtectedRoute>
            <ButtonsPaymentLinksPage />
          </ProtectedRoute>
        } />
        <Route path="/buttons/cart" element={<ButtonsCartPage />} />
        <Route path="/buttons/donate" element={<ButtonsDonatePage />} />
        <Route path="/buttons/subscribe" element={<ButtonsSubscribePage />} />
        <Route path="/buttons/embeds" element={<ButtonsEmbedsPage />} />
        <Route path="/ledger" element={<PublicLedgerPage />} />
        <Route path="/openledger" element={<Navigate to="/ledger" replace />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/openpay-guide" element={<OpenPayGuidePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/regulatory-status" element={<RegulatoryStatusPage />} />
        <Route path="/about-openpay" element={<AboutOpenPayPage />} />
        <Route path="/openpay-documentation" element={<OpenPayDocumentationPage />} />
        <Route path="/openpay-api-docs" element={<OpenPayApiDocsPage />} />
        <Route path="/openpay-pos-docs" element={<OpenPayPosDocsPage />} />
        <Route path="/openpay-merchant-portal-docs" element={<OpenPayMerchantPortalDocsPage />} />
        <Route path="/open-partner" element={<OpenPartnerPage />} />
        <Route path="/pi-whitepaper" element={<PiWhitepaperPage />} />
        <Route path="/pi-mica-whitepaper" element={<PiMicaWhitepaperPage />} />
        <Route path="/whitepaper" element={<WhitepaperPage />} />
        <Route path="/gdpr" element={<GdprPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/merchant-onboarding" element={<MerchantOnboardingPage />} />
        <Route path="/merchant-products" element={<MerchantProductCatalogPage />} />
        <Route path="/merchant-products/create" element={<MerchantProductCreatePage />} />
        <Route path="/merchant-pos" element={<MerchantPosPage />} />
        <Route path="/qr-pay" element={<ProtectedRoute><QrPayDashboardPage /></ProtectedRoute>} />
        <Route path="/qr-pay/new" element={<ProtectedRoute><QrPayCreatePage /></ProtectedRoute>} />
        <Route path="/qr-pay/api" element={<ProtectedRoute><QrPayApiDashboardPage /></ProtectedRoute>} />
        <Route path="/qr-pay/:token" element={<QrPayCheckoutPage />} />
        <Route path="/qr-pay/:token/success" element={<QrPaySuccessPage />} />
        <Route path="/payment-links/create" element={<PaymentLinksCreatePage />} />
        <Route path="/payment-link/:token" element={<MerchantCheckoutPage />} />
        <Route path="/merchant-checkout" element={<MerchantCheckoutPage />} />
        <Route path="/public-payment" element={<PublicWalletPaymentPage />} />
        <Route path="/pay/:username" element={<UsernamePayPage />} />
        <Route path="/merchant-checkout/thank-you" element={<MerchantCheckoutThankYouPage />} />
        <Route path="/pos-thank-you" element={<PosThankYouPage />} />
        <Route path="/virtual-card" element={<VirtualCardPage />} />
        <Route path="/kyc" element={<KycPage />} />
        <Route path="/kyc-status" element={<KycStatusPage />} />
        <Route path="/admin-kyc-review" element={<AdminKycReview />} />
        <Route path="/admin-kyc-metrics" element={<AdminKycMetricsPage />} />
        <Route path="/admin-openpay-metrics" element={<AdminOpenPayMetricsPage />} />

        <Route path="/remittance-merchant" element={<RemittanceMerchantPage />} />
        <Route path="/openpay-official" element={<OpenPayOfficialPage />} />
        <Route path="/openapp" element={<OpenAppPage />} />
        <Route path="/openpay-desktop" element={<OpenPayDesktopPage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/live-customer-service" element={<LiveCustomerServicePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/topup-history" element={<TopUpHistoryPage />} />
        <Route path="/swap-withdrawal" element={<SwapWithdrawalPage />} />
        <Route path="/confirm-pin" element={<ConfirmPinPage />} />
        <Route path="/smart-contract-api" element={<SmartContractApiPage />} />
        <Route path="/developer-dashboard" element={<DeveloperDashboardPage />} />
        <Route path="/app-developer-dashboard" element={
          <ProtectedRoute>
            <AppDeveloperDashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/app-payment/checkout" element={<AppPaymentCheckoutPage />} />
        <Route path="/app-payment/success" element={<AppPaymentSuccessPage />} />
        <Route path="/app-pay-approve/:id" element={<AppPayApprovePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </main>
      </PageTransition>
      <AppSecurityGate />
      {location.pathname !== "/support" ? <AppFooter /> : null}
      {!showRouteSplash ? <SupportWidget /> : null}

      {showRouteSplash && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
          <div className="text-center">
            <AuthMark className="mx-auto mb-6 h-10 w-10" />
            <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
            <p className="mt-1 text-sm text-white/80">Loading page...</p>
            <p className="mt-1 text-xs font-medium tracking-normal text-white/65">Powered by Pi Network</p>
            <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
          </div>
        </div>
      )}
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <CookieConsentProvider>
        <CurrencyProvider>
          <ThankYouModalProvider>
            <TooltipProvider>
              <AppLanguageTranslate />
              <Toaster />
              <Sonner />
              <AppWithNotifications />
            </TooltipProvider>
          </ThankYouModalProvider>
        </CurrencyProvider>
      </CookieConsentProvider>
    </QueryClientProvider>
  );
};

const AppWithNotifications = () => {
  useRealtimePushNotifications();
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
      <GlobalThankYouModal />
    </BrowserRouter>
  );
};

export default App;
