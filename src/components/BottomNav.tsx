import { useNavigate } from "react-router-dom";
import { Home, QrCode, Menu } from "lucide-react";

interface BottomNavProps {
  active: "home" | "contacts" | "scan" | "menu";
}

const BottomNav = ({ active }: BottomNavProps) => {
  const navigate = useNavigate();

  const items = [
    { key: "home" as const, label: "Home", icon: Home, path: "/dashboard" },
    { key: "scan" as const, label: "Scan QR", icon: QrCode, path: "/scan-qr?returnTo=/send" },
    { key: "menu" as const, label: "Menu", icon: Menu, path: "/menu" },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-30 px-4">
      <div className="mx-auto max-w-md bg-white/95 backdrop-blur-md rounded-[2rem] shadow-2xl border border-white/60 overflow-hidden">
        <div className="flex items-center justify-around px-2 py-3">
          {items.map(({ key, label, icon: Icon, path }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => navigate(path)}
                className={`dash-nav-item flex min-w-[85px] flex-col items-center gap-1.5 rounded-2xl py-2.5 active:scale-95 ${
                  isActive
                    ? "dash-nav-item-active bg-gradient-to-b from-secondary/90 to-secondary/50 text-paypal-blue shadow-inner"
                    : "text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                <Icon
                  className={`dash-nav-icon w-6 h-6 transition-transform ${
                    isActive ? "scale-110 drop-shadow-[0_2px_6px_rgba(0,87,216,0.35)]" : ""
                  }`}
                />
                <span
                  className={`text-[11px] tracking-tight ${
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
