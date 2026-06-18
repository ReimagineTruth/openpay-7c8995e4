import { useEffect, useState } from "react";
import Dashboard from "@/pages/Dashboard";
import Web3Dashboard from "@/components/web3/Web3Dashboard";
import { getUiMode, subscribeUiMode, type UiMode } from "@/lib/uiMode";

/**
 * Wraps the dashboard so switching between "original" and "web3" UI modes
 * fully remounts the chosen variant (via `key`). This avoids React's
 * "rendered fewer hooks than previous render" error that caused a blank
 * white screen when toggling modes inline.
 */
const DashboardSwitcher = () => {
  const [mode, setMode] = useState<UiMode>(() => getUiMode());
  const [fading, setFading] = useState(false);

  useEffect(() => {
    return subscribeUiMode((next) => {
      if (next === mode) return;
      setFading(true);
      // brief fade-out, then swap and fade back in
      window.setTimeout(() => {
        setMode(next);
        setFading(false);
      }, 220);
    });
  }, [mode]);

  return (
    <div
      className={`transition-opacity duration-300 ease-out ${fading ? "opacity-0" : "opacity-100"}`}
      style={{ backgroundColor: mode === "web3" ? "#000" : undefined, minHeight: "100vh" }}
    >
      {mode === "web3" ? <Web3Dashboard key="web3" /> : <Dashboard key="orig" />}
    </div>
  );
};

export default DashboardSwitcher;
