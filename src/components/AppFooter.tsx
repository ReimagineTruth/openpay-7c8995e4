import { useLocation } from "react-router-dom";
import { APP_VERSION_LABEL } from "@/lib/appVersion";

const AppFooter = () => {
  const location = useLocation();
  if (location.pathname.startsWith("/scan-qr")) return null;

  return (
    <footer className="px-4 pb-8 pt-6 text-center text-xs text-muted-foreground">
      <p>Copyright © 2026 OpenPay by Mrwain Organization. All rights reserved.</p>
      <p className="mt-1.5 text-[11px] font-medium tracking-[-0.01em] text-[#8e8e93]">
        OpenPay {APP_VERSION_LABEL}
      </p>
    </footer>
  );
};

export default AppFooter;
