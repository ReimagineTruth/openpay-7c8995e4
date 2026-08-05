import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getStoredAppTheme, persistAndApplyAppTheme } from "@/lib/appTheme";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    getStoredAppTheme() === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    persistAndApplyAppTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
};

export default ThemeToggle;
