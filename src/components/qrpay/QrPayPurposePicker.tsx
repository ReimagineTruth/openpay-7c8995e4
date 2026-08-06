import { useMemo, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
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
import {
  QR_PAY_PURPOSE_CATEGORIES,
  getPurposeCategory,
  getQrPayPurpose,
  type QrPayPurposeId,
} from "@/lib/qrPayPurposes";

interface Props {
  value: QrPayPurposeId;
  onChange: (id: QrPayPurposeId) => void;
}

/**
 * Apple Settings–style purpose picker: inset trigger + searchable categorized sheet.
 */
export default function QrPayPurposePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = getQrPayPurpose(value) || getQrPayPurpose("product")!;
  const selectedCat = getPurposeCategory(selected.id);
  const SelectedIcon = selected.icon;

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return QR_PAY_PURPOSE_CATEGORIES;
    return QR_PAY_PURPOSE_CATEGORIES.map((cat) => ({
      ...cat,
      purposes: cat.purposes.filter(
        (p) =>
          p.label.toLowerCase().includes(term) ||
          p.hint.toLowerCase().includes(term) ||
          cat.label.toLowerCase().includes(term),
      ),
    })).filter((cat) => cat.purposes.length > 0);
  }, [term]);

  const pick = (id: QrPayPurposeId) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch("");
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="ios-currency-trigger w-full">
          <span className={`ios-glyph ${selectedCat?.tone || "ios-glyph-blue"}`}>
            <SelectedIcon className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
              {selected.label}
            </span>
            <span className="block truncate text-[12px] text-[#86868b]">
              {selectedCat ? `${selectedCat.emoji} ${selectedCat.label}` : selected.hint}
              {" · "}
              {selected.hint}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.25} />
        </button>
      </DialogTrigger>

      <DialogContent className="ios-currency-sheet gap-0 overflow-hidden p-0 sm:max-w-[400px]">
        <div className="mx-auto mt-2 hidden h-1 w-9 rounded-full bg-black/15 max-[640px]:block" />
        <DialogHeader className="space-y-0 px-4 pb-2 pt-3 text-center sm:pt-5">
          <DialogTitle className="text-[17px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
            Payment purpose
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-[#8e8e93]">
            Choose what you’re charging for
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#8e8e93]"
              strokeWidth={2.25}
            />
            <Input
              placeholder="Search goods, bills, tips…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ios-search-field h-9 rounded-[10px] border-0 bg-[#767680]/12 pl-9 text-[15px] shadow-none placeholder:text-[#8e8e93] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        <ScrollArea className="h-[min(58vh,440px)]">
          <div className="space-y-5 px-4 pb-6">
            {filtered.map((cat) => (
              <div key={cat.id}>
                <p className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8e8e93]">
                  <span className="mr-1 normal-case tracking-normal" aria-hidden>
                    {cat.emoji}
                  </span>
                  {cat.label}
                </p>
                <div className="ios-list-group overflow-hidden">
                  {cat.purposes.map((p, i) => {
                    const Icon = p.icon;
                    const active = p.id === value;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pick(p.id)}
                        className={`ios-list-row relative flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-black/[0.06] ${
                          active ? "bg-[#007AFF]/[0.08]" : "bg-white hover:bg-black/[0.02]"
                        }`}
                      >
                        {i > 0 && <span className="ios-list-sep" aria-hidden />}
                        <span className={`ios-glyph ${cat.tone}`}>
                          <Icon className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
                            {p.label}
                          </span>
                          <span className="block truncate text-[12px] text-[#8e8e93]">{p.hint}</span>
                        </span>
                        {active ? (
                          <Check className="h-[18px] w-[18px] shrink-0 text-[#007AFF]" strokeWidth={2.75} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="rounded-[12px] bg-white py-10 text-center text-[15px] text-[#8e8e93]">
                No Results
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
