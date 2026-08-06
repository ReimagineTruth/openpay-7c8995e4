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
  fontFamily: "\"Apple Color Emoji\", \"Segoe UI Emoji\", \"Noto Color Emoji\", sans-serif",
};
const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";
const TOP_PRIORITY_CODES = ["OUSD", "PI", "USD", "EUR"];

const CurrencySelector = () => {
  const { currencies, currency, setCurrency } = useCurrency();
  const livePiUsd = usePiUsdPrice().price;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const codeLabel = (code: string) => (code === "PI" ? "PI" : code === "OUSD" ? "OPEN USD" : `PI ${code}`);
  const nameLabel = (code: string, name: string) => {
    if (code === "PI") return `Pure Pi · $${livePiUsd.toFixed(4)}`;
    if (code === "OUSD") return "OpenPay USD · 1 OUSD = $1.00";
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

  const Icon = ({ code, flag }: { code: string; flag: string }) => {
    if (code === "PI")
      return <img src={PURE_PI_ICON_URL} alt="Pure Pi" className="h-9 w-9 rounded-full object-cover" />;
    if (code === "OUSD")
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#007AFF]/12">
          <BrandLogo className="h-5 w-5 text-[#007AFF]" />
        </span>
      );
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] text-[22px] leading-none" style={emojiFlagStyle}>
        {flag}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full bg-[#f2f2f7] px-3 py-1.5 text-[13px] font-semibold tracking-[-0.01em] text-[#1d1d1f] transition-colors hover:bg-[#eaeaef]">
          {currency.code === "PI" ? (
            <img src={PURE_PI_ICON_URL} alt="Pure Pi" className="h-[18px] w-[18px] rounded-full object-cover" />
          ) : currency.code === "OUSD" ? (
            <BrandLogo className="h-[18px] w-[18px] text-[#007AFF]" />
          ) : (
            <span className="text-base leading-none" style={emojiFlagStyle}>{currency.flag}</span>
          )}
          <span>{codeLabel(currency.code)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#8e8e93]" strokeWidth={2.25} />
        </button>
      </DialogTrigger>

      <DialogContent className="ios-currency-sheet gap-0 overflow-hidden p-0 sm:max-w-[380px]">
        <DialogHeader className="space-y-0 px-4 pb-2 pt-3 text-center sm:pt-5">
          <DialogTitle className="text-[17px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
            Currency
          </DialogTitle>
          <DialogDescription className="sr-only">Choose your preferred currency.</DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#8e8e93]" strokeWidth={2.25} />
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ios-search-field h-9 rounded-[10px] border-0 bg-[#767680]/12 pl-9 text-[15px] shadow-none placeholder:text-[#8e8e93] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        <ScrollArea className="h-[min(52vh,380px)]">
          <div className="px-4 pb-5">
            <div className="ios-list-group overflow-hidden">
              {list.map((c, i) => {
                const active = c.code === currency.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setCurrency(c);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`ios-list-row relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-black/[0.06] ${
                      active ? "bg-[#007AFF]/[0.08]" : "bg-white hover:bg-black/[0.02]"
                    }`}
                  >
                    {i > 0 && <span className="ios-list-sep" aria-hidden />}
                    <Icon code={c.code} flag={c.flag} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">{codeLabel(c.code)}</p>
                      <p className="truncate text-[12px] leading-snug text-[#8e8e93]">{nameLabel(c.code, c.name)}</p>
                    </div>
                    {active ? (
                      <Check className="h-[18px] w-[18px] shrink-0 text-[#007AFF]" strokeWidth={2.75} />
                    ) : (
                      <span className="text-[13px] font-medium text-[#8e8e93]">{symbolOf(c.code, c.symbol)}</span>
                    )}
                  </button>
                );
              })}
              {list.length === 0 && (
                <p className="bg-white py-10 text-center text-[15px] text-[#8e8e93]">No Results</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CurrencySelector;
