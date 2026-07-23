import { useNavigate } from "react-router-dom";
import { Home, QrCode, Menu } from "lucide-react";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

interface BottomNavProps {
  active: "home" | "contacts" | "scan" | "menu";
}

const BottomNav = ({ active }: BottomNavProps) => {
  const navigate = useNavigate();
  const hidden = useHideOnScroll();

  const items = [
    { key: "home" as const, label: "Home", icon: Home, path: "/dashboard" },
    { key: "scan" as const, label: "Scan QR", icon: QrCode, path: "/scan-qr?returnTo=/send" },
    { key: "menu" as const, label: "Menu", icon: Menu, path: "/menu" },
  ];

  return (
    <div
      className={`safe-bottom-nav fixed left-0 right-0 z-30 px-3 transition-all duration-300 ease-out sm:px-4 ${
        hidden ? "translate-y-[140%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-white/60 bg-white/95 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-[#0f172a]/95">
        <div className="flex min-w-0 items-center justify-around gap-1 px-1.5 py-2.5 sm:px-2 sm:py-3">
          {items.map(({ key, label, icon: Icon, path }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigate(path)}
                className={`dash-nav-item flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 active:scale-95 sm:gap-1.5 sm:py-2.5 ${
                  isActive
                    ? "dash-nav-item-active bg-gradient-to-b from-secondary/90 to-secondary/50 text-paypal-blue shadow-inner"
                    : "text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                <Icon
                  className={`dash-nav-icon h-5 w-5 shrink-0 transition-transform sm:h-6 sm:w-6 ${
                    isActive ? "scale-110 drop-shadow-[0_2px_6px_rgba(0,87,216,0.35)]" : ""
                  }`}
                />
                <span
                  className={`max-w-full truncate text-[10px] tracking-tight sm:text-[11px] ${
                    isActive
                      ? "font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-paypal-blue to-blue-600"
                      : "font-semibold"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
