import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import CookieConsentDialog from "@/components/CookieConsentDialog";
import {
  hasAcceptedCookies,
  canUseFunctionalCookies,
  canUseAnalyticsCookies,
  canUseMarketingCookies,
  loadUserPreferences,
  saveUserPreferences,
  saveCookieConsent,
} from "@/lib/userPreferencesStorage";

interface CookieConsentContextType {
  hasAcceptedCookies: boolean;
  canUseFunctionalCookies: boolean;
  canUseAnalyticsCookies: boolean;
  canUseMarketingCookies: boolean;
  showCookieDialog: boolean;
  acceptAllCookies: () => void;
  showCookieSettings: () => void;
  hideCookieDialog: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  }
  return context;
};

interface CookieConsentProviderProps {
  children: ReactNode;
}

export const CookieConsentProvider = ({ children }: CookieConsentProviderProps) => {
  const [showCookieDialog, setShowCookieDialog] = useState(false);
  const [cookieConsent, setCookieConsent] = useState({
    hasAcceptedCookies: false,
    canUseFunctionalCookies: false,
    canUseAnalyticsCookies: false,
    canUseMarketingCookies: false,
  });

  const refreshConsentState = () => {
    const hasConsent = hasAcceptedCookies();
    setCookieConsent({
      hasAcceptedCookies: hasConsent,
      canUseFunctionalCookies: canUseFunctionalCookies(),
      canUseAnalyticsCookies: canUseAnalyticsCookies(),
      canUseMarketingCookies: canUseMarketingCookies(),
    });
    return hasConsent;
  };

  useEffect(() => {
    // Auto cookie consent modal is disabled for now.
    refreshConsentState();
  }, []);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      refreshConsentState();
    }
    setShowCookieDialog(open);
  };

  const acceptAllCookies = () => {
    // Save cookie consent with timestamp to prevent banner from reappearing
    saveCookieConsent({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    });

    // Also update user preferences for compatibility
    saveUserPreferences({
      cookiesAccepted: true,
      analyticsConsent: true,
      marketingConsent: true,
    });

    setCookieConsent({
      hasAcceptedCookies: true,
      canUseFunctionalCookies: true,
      canUseAnalyticsCookies: true,
      canUseMarketingCookies: true,
    });

    setShowCookieDialog(false);
  };

  const showCookieSettings = () => {
    setShowCookieDialog(true);
  };

  const hideCookieDialog = () => {
    setShowCookieDialog(false);
  };

  const value: CookieConsentContextType = {
    ...cookieConsent,
    showCookieDialog,
    acceptAllCookies,
    showCookieSettings,
    hideCookieDialog,
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      <CookieConsentDialog
        open={showCookieDialog}
        onOpenChange={handleDialogOpenChange}
      />
    </CookieConsentContext.Provider>
  );
};
