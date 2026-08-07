import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image";
import { Download, Loader2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { usePiUsdPrice } from "@/lib/piPrice";
import { PhoneChrome } from "@/components/app-store-previews/PhoneChrome";
import {
  PREVIEW_FRAMES,
  renderPreviewFrame,
  type PreviewFrameId,
  type PreviewFrameMeta,
} from "@/components/app-store-previews/featureFrames";

const DARK_FRAMES = new Set<PreviewFrameId>([
  "auth",
  "wallet",
  "savings",
  "credit",
  "loans",
  "buy",
  "withdraw",
  "send",
  "receive",
  "request",
  "send-pro",
  "menu",
  "card",
  "scan",
  "nft",
]);

const FrameCard = ({
  frame,
  busy,
  onDownload,
}: {
  frame: PreviewFrameMeta;
  busy: string | null;
  onDownload: (frame: PreviewFrameMeta) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">
            {frame.group}
          </p>
          <h3 className="text-[16px] font-bold">{frame.title}</h3>
          <p className="text-[12px] text-[#8e8e93]">{frame.feature}</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => onDownload(frame)}
          disabled={!!busy}
          className="h-9 rounded-full bg-[#007AFF] text-white hover:bg-[#0066d6]"
        >
          {busy === frame.id ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          PNG
        </Button>
      </div>
      <PhoneChrome frameRef={ref} previewId={frame.id} statusLight={DARK_FRAMES.has(frame.id)}>
        {renderPreviewFrame(frame.id)}
      </PhoneChrome>
    </section>
  );
};

const AppStorePreviewsPage = () => {
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [runAll, setRunAll] = useState(false);
  const piPrice = usePiUsdPrice(30_000);

  const groups = useMemo(() => {
    const set = new Set(PREVIEW_FRAMES.map((f) => f.group));
    return ["All", ...Array.from(set)];
  }, []);

  const capture = useCallback(async (frame: PreviewFrameMeta) => {
    const node = document.querySelector(
      `[data-preview-id="${frame.id}"]`,
    ) as HTMLDivElement | null;
    if (!node) return;
    setBusy(frame.id);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#000000",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = frame.file;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (!runAll) return;
    let cancelled = false;
    (async () => {
      setFilter("All");
      await new Promise((r) => setTimeout(r, 250));
      for (const frame of PREVIEW_FRAMES) {
        if (cancelled) break;
        await capture(frame);
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!cancelled) setRunAll(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [runAll, capture]);

  return (
    <div className="min-h-[100dvh] bg-[#F2F2F7] text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-9 w-9" animate={false} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                OpenPay · US App Store
              </p>
              <h1 className="text-[17px] font-bold tracking-[-0.02em]">
                All feature previews · {PREVIEW_FRAMES.length}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" className="h-10 rounded-full">
              <Link to="/auth">Open Auth</Link>
            </Button>
            <Button
              type="button"
              onClick={() => setRunAll(true)}
              disabled={!!busy || runAll}
              className="h-10 rounded-full bg-[#007AFF] text-white hover:bg-[#0066d6]"
            >
              {busy || runAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download all PNGs
            </Button>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setFilter(g)}
              className={
                filter === g
                  ? "shrink-0 rounded-full bg-[#007AFF] px-3.5 py-1.5 text-[12px] font-bold text-white"
                  : "shrink-0 rounded-full bg-[#e5e5ea] px-3.5 py-1.5 text-[12px] font-semibold text-[#1d1d1f]"
              }
            >
              {g}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <p className="mb-6 max-w-3xl text-[14px] leading-relaxed text-[#636366]">
          Exact OpenPay feature UIs for App Store Connect ({PREVIEW_FRAMES.length} screens). Live PI ≈ $
          {piPrice.price > 0 ? piPrice.price.toFixed(4) : "—"}. Filter by group, then download PNGs.
        </p>

        <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
          {PREVIEW_FRAMES.map((frame) => {
            const visible = filter === "All" || frame.group === filter;
            return (
              <div key={frame.id} className={visible ? undefined : "hidden"} aria-hidden={!visible}>
                <FrameCard frame={frame} busy={busy} onDownload={(f) => void capture(f)} />
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default AppStorePreviewsPage;
