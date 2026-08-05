import { useMemo, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { usePiUsdPrice } from "@/lib/piPrice";
import { ChevronDown, Search, Check } from "lucide-react";
import BrandLogo from "./BrandLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const emojiFlagStyle = {
  fontFamily: "\"Segoe UI Emoji\", \"Apple Color Emoji\", \"Noto Color Emoji\", sans-serif",
};
const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";
const TOP_PRIORITY_CODES = ["OUSD", "PI", "USD", "EUR"];

interface CurrencyPickerProps {
  /** Selected currency code, e.g. "PI" */
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

/**
 * Controlled version of the dashboard CurrencySelector — same searchable
 * dialog and Pi/OUSD ordering, but drives a local value instead of the
 * global app currency.
 */
export default function CurrencyPicker({ value, onChange, className = "" }: CurrencyPickerProps) {
  const { currencies } = useCurrency();
  const livePiUsd = usePiUsdPrice().price;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = currencies.find((c) => c.code === value) || currencies[0];

  const codeLabel = (code: string) => (code === "PI" ? "PI" : code === "OUSD" ? "OPEN USD" : `PI ${code}`);
  const nameLabel = (code: string, name: string) => {
    if (code === "PI") return `Pure Pi (live $${livePiUsd.toFixed(4)})`;
    if (code === "OUSD") return "OpenPay USD Stablecoin (1 OUSD = $1.00)";
    return `PI ${name}`;
  };
  const symbolOf = (code: string, symbol: string) => (code === "PI" ? "π" : symbol);

  const term = search.trim().toLowerCase();
  const list = useMemo(() => {
    const filtered = currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term) ||
        `pi ${c.code}`.toLowerCase().includes(term) ||
        `pi ${c.name}`.toLowerCase().includes(term) ||
        (c.code === "OUSD" && "openusd open usd openpay usd 1 usd".includes(term))
    );
    return [...filtered].sort((a, b) => {
      const ar = TOP_PRIORITY_CODES.indexOf(a.code);
      const br = TOP_PRIORITY_CODES.indexOf(b.code);
      const an = ar === -1 ? Number.MAX_SAFE_INTEGER : ar;
      const bn = br === -1 ? Number.MAX_SAFE_INTEGER : br;
      if (an !== bn) return an - bn;
      return a.code.localeCompare(b.code);
    });
  }, [currencies, term]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setSearch("");
  };

  const Icon = ({ code, flag, size = 7 }: { code: string; flag: string; size?: number }) => {
    if (code === "PI")
      return <img src={PURE_PI_ICON_URL} alt="Pure Pi" className={`h-${size} w-${size} rounded-full object-cover`} />;
    if (code === "OUSD")
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paypal-blue/10">
          <BrandLogo className="h-5 w-5 text-paypal-blue" />
        </span>
      );
    return <span className="text-2xl leading-none" style={emojiFlagStyle}>{flag}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm font-medium transition-colors hover:bg-muted/60 ${className}`}
        >
          {selected?.code === "PI" ? (
            <img src={PURE_PI_ICON_URL} alt="Pure Pi" className="h-5 w-5 rounded-full object-cover" />
          ) : selected?.code === "OUSD" ? (
            <BrandLogo className="h-5 w-5 text-paypal-blue" />
          ) : (
            <span className="text-lg leading-none" style={emojiFlagStyle}>{selected?.flag}</span>
          )}
          <span className="flex-1 truncate text-foreground">{selected ? codeLabel(selected.code) : "Select"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="px-4 pb-2 pt-4">
          <DialogTitle className="text-lg font-bold text-foreground">Select Currency</DialogTitle>
          <DialogDescription className="sr-only">Choose the checkout currency.</DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search currency..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl pl-9"
            />
          </div>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="px-2 pb-2">
            {list.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pick(c.code)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  c.code === value ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon code={c.code} flag={c.flag} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{codeLabel(c.code)}</p>
                  <p className="truncate text-xs text-muted-foreground">{nameLabel(c.code, c.name)}</p>
                </div>
                {c.code === value ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">{symbolOf(c.code, c.symbol)}</span>
                )}
              </button>
            ))}
            {list.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No currencies found</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
