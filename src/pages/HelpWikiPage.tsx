import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Wallet, Send, QrCode, CreditCard, Store, Link2, Pickaxe, Coins,
  ShieldCheck, Users, Bell, Globe, Banknote, Receipt, Sparkles, BookOpen, PlayCircle,
  ExternalLink, Plus, Pencil, Trash2, Save, X, HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Feature = {
  id: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  iconName?: string;
  short: string;
  overview: string;
  steps: string[];
  demoPath?: string;
  demoLabel?: string;
  youtubeId?: string;
  faqs?: { q: string; a: string }[];
  source?: "builtin" | "db";
  dbId?: string;
  published?: boolean;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet, Send, QrCode, CreditCard, Store, Link2, Pickaxe, Coins, ShieldCheck, Users,
  Bell, Globe, Banknote, Receipt, Sparkles, BookOpen, HelpCircle,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

const BUILTIN_FEATURES: Feature[] = [
  { id: "wallet", title: "Your OpenPay Wallet", category: "Basics", icon: Wallet, short: "Hold balance, top up, and spend across the OpenPay network.", overview: "Your wallet is the heart of OpenPay. It stores your balance in your preferred currency and lets you send, receive, top up, withdraw, and pay merchants instantly.", steps: ["Open the Dashboard to see your live balance.","Tap Top up to add funds via Pi, Stripe, PayPal, Apple Pay, USDT, USDC, OUSD, Solana Pay, or local methods.","Use Send / Request / Scan from the floating bottom nav.","All movements are logged in Activity and the public OpenLedger."], demoPath: "/dashboard", demoLabel: "Open Dashboard", youtubeId: "dQw4w9WgXcQ", source: "builtin" },
  { id: "send", title: "Send Money", category: "Payments", icon: Send, short: "Send to a username, phone, email, or scan a QR.", overview: "Send funds to anyone with an OpenPay account in seconds, with optional notes and emoji.", steps: ["Tap Send from the Dashboard.","Search a contact, paste a username (@handle), or scan a QR.","Enter amount, add a note, confirm with MPIN/biometrics.","Receipt is saved to Activity and a notification is sent to both sides."], demoPath: "/send", demoLabel: "Try Send Money", youtubeId: "5qap5aO4i9A", source: "builtin" },
  { id: "qr-pay", title: "QR Pay — Create & Accept", category: "Payments", icon: QrCode, short: "Generate a payment QR for products, donations, tips, or digital goods.", overview: "QR Pay turns any phone into a checkout. Create a payment page with product details, images, custom amounts, and delivery collection — share the link or print the QR.", steps: ["Go to QR Pay → New.","Pick a type: Product, Digital download, Donation, or Tip.","Add title, image, price (or allow custom amount), and items.","Choose accepted methods: Pi, Wallet, Virtual Card, or Guest.","Share the link/QR. Track sales live in the QR Pay Dashboard."], demoPath: "/qr-pay/new", demoLabel: "Create a QR Payment", youtubeId: "9bZkp7q19f0", source: "builtin" },
  { id: "scan", title: "Open Scan", category: "Payments", icon: QrCode, short: "Universal scanner for OpenPay, QR Pay, and external Pi links.", overview: "Open Scan recognizes OpenPay usernames, QR Pay tokens, openpay:// deep links, Pi payment URIs, and standard URLs.", steps: ["Tap Scan from the bottom nav.","Point at any QR.","Confirm the action prompted on screen."], demoPath: "/scan", demoLabel: "Open the Scanner", source: "builtin" },
  { id: "virtual-card", title: "Virtual Card", category: "Payments", icon: CreditCard, short: "Issue a virtual card backed by your wallet balance.", overview: "Generate a virtual card to pay online merchants, QR Pay checkouts, and any OpenPay-enabled store.", steps: ["Open Virtual Card from the menu.","Tap Activate.","Use card number + CVC at checkout.","Lock the card in one tap if needed."], demoPath: "/virtual-card", demoLabel: "View My Card", source: "builtin" },
  { id: "topup", title: "Top Up", category: "Basics", icon: Banknote, short: "Fund your wallet from 15+ providers.", overview: "Add money via Pi, Stripe (card), PayPal, Venmo, Apple Pay, Google Pay, USDT, USDC, OUSD (Solana), Solana Pay, or local e-wallets.", steps: ["Tap Top up from the Dashboard.","Choose a provider.","Follow provider flow.","Balance updates instantly when confirmed."], demoPath: "/top-up", demoLabel: "Top Up Wallet", source: "builtin" },
  { id: "merchant", title: "Merchant Portal", category: "Business", icon: Store, short: "Stripe/PayPal-style portal: POS, catalog, API keys, payouts.", overview: "Run a real business on OpenPay.", steps: ["Onboard at Merchant Onboarding.","Create products in your catalog.","Run sales from POS or share a checkout link.","Generate API keys for headless integrations."], demoPath: "/merchant-onboarding", demoLabel: "Become a Merchant", source: "builtin" },
  { id: "mining", title: "Mining (Ad-gated)", category: "Earn", icon: Pickaxe, short: "Earn daily rewards by watching a rewarded ad.", overview: "Activate a 24-hour mining cycle by watching a Pi Ad Network rewarded ad.", steps: ["Open Mining.","Tap Watch ad to activate.","Return after 24h to claim and restart."], demoPath: "/mining", demoLabel: "Start Mining", source: "builtin" },
  { id: "openledger", title: "OpenLedger (Transparency)", category: "Trust", icon: Globe, short: "Public, real-time ledger of every transaction on OpenPay.", overview: "Every payment, top up, withdrawal, QR Pay sale, and merchant transfer is recorded.", steps: ["Open OpenLedger.","Filter by type or search a transaction ID.","Click an entry to see receipt details."], demoPath: "/ledger", demoLabel: "Browse OpenLedger", source: "builtin" },
  { id: "api", title: "Smart Contract / Developer API", category: "Developers", icon: Sparkles, short: "Build apps with OAuth 2.0, REST API keys, and webhooks.", overview: "OpenPay's Smart Contract API lets developers create payments, subscriptions, and payouts.", steps: ["Open Developer Dashboard.","Create an app, copy your keys.","Read the API docs.","Subscribe to webhooks for live events."], demoPath: "/openpay-api-docs", demoLabel: "Read API Docs", source: "builtin" },
];

const CATEGORIES = ["All", "Basics", "Payments", "Business", "Earn", "Trust", "Developers"];

type EditorState = {
  open: boolean;
  id?: string;
  slug: string;
  title: string;
  category: string;
  iconName: string;
  short: string;
  overview: string;
  steps: string;
  demoPath: string;
  demoLabel: string;
  youtubeId: string;
  published: boolean;
};

const emptyEditor = (): EditorState => ({
  open: true, slug: "", title: "", category: "Basics", iconName: "BookOpen",
  short: "", overview: "", steps: "", demoPath: "", demoLabel: "", youtubeId: "", published: true,
});

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const HelpWikiPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [isAdmin, setIsAdmin] = useState(false);
  const [dbFeatures, setDbFeatures] = useState<Feature[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: adm } = await supabase.rpc("is_openpay_core_admin" as any);
      setIsAdmin(adm === true);
    })();
    void loadDb();
  }, []);

  const loadDb = async () => {
    const { data, error } = await (supabase as any)
      .from("help_articles")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) return;
    const mapped: Feature[] = (data || []).map((r: any) => ({
      id: r.slug,
      dbId: r.id,
      title: r.title,
      category: r.category || "Basics",
      icon: ICON_MAP[r.icon_name] || BookOpen,
      iconName: r.icon_name,
      short: r.short || "",
      overview: r.overview || "",
      steps: Array.isArray(r.steps) ? r.steps : [],
      demoPath: r.demo_path || undefined,
      demoLabel: r.demo_label || undefined,
      youtubeId: r.youtube_id || undefined,
      faqs: Array.isArray(r.faqs) ? r.faqs : [],
      source: "db",
      published: r.published,
    }));
    setDbFeatures(mapped);
  };

  const allFeatures = useMemo(() => {
    const dbSlugs = new Set(dbFeatures.map((f) => f.id));
    return [...dbFeatures, ...BUILTIN_FEATURES.filter((f) => !dbSlugs.has(f.id))];
  }, [dbFeatures]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allFeatures.filter((f) => {
      const inCat = category === "All" || f.category === category;
      if (!inCat) return false;
      if (!q) return true;
      return f.title.toLowerCase().includes(q) || f.short.toLowerCase().includes(q) || f.overview.toLowerCase().includes(q);
    });
  }, [allFeatures, query, category]);

  const openNew = () => setEditor(emptyEditor());
  const openEdit = (f: Feature) => {
    if (f.source !== "db") {
      // Clone builtin into editor as a new DB article
      setEditor({
        open: true, slug: `${f.id}-custom`, title: f.title, category: f.category, iconName: f.iconName || "BookOpen",
        short: f.short, overview: f.overview, steps: f.steps.join("\n"),
        demoPath: f.demoPath || "", demoLabel: f.demoLabel || "", youtubeId: f.youtubeId || "", published: true,
      });
      return;
    }
    setEditor({
      open: true, id: f.dbId, slug: f.id, title: f.title, category: f.category, iconName: f.iconName || "BookOpen",
      short: f.short, overview: f.overview, steps: f.steps.join("\n"),
      demoPath: f.demoPath || "", demoLabel: f.demoLabel || "", youtubeId: f.youtubeId || "", published: f.published !== false,
    });
  };

  const handleSave = async () => {
    if (!editor) return;
    const slug = (editor.slug || slugify(editor.title)).trim();
    if (!slug || !editor.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload: any = {
      slug, title: editor.title.trim(), category: editor.category, icon_name: editor.iconName,
      short: editor.short, overview: editor.overview,
      steps: editor.steps.split("\n").map((s) => s.trim()).filter(Boolean),
      demo_path: editor.demoPath || null, demo_label: editor.demoLabel || null,
      youtube_id: editor.youtubeId || null, published: editor.published,
    };
    let error;
    if (editor.id) {
      ({ error } = await (supabase as any).from("help_articles").update(payload).eq("id", editor.id));
    } else {
      ({ error } = await (supabase as any).from("help_articles").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditor(null);
    void loadDb();
  };

  const handleDelete = async (f: Feature) => {
    if (!f.dbId) return;
    if (!confirm(`Delete "${f.title}"?`)) return;
    const { error } = await (supabase as any).from("help_articles").delete().eq("id", f.dbId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    void loadDb();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full" aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-paypal-dark">OpenPay Help & Wiki</h1>
            <p className="text-xs text-muted-foreground">Every feature, explained — with demos and videos.</p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openNew} className="bg-paypal-blue hover:bg-paypal-blue/90">
              <Plus className="mr-1 h-4 w-4" /> New article
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6">
        <section className="paypal-surface mb-6 rounded-3xl p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-paypal-blue">
            <BookOpen className="h-4 w-4" /> OpenPay Wiki
          </div>
          <h2 className="mt-2 text-2xl font-bold text-paypal-dark">Learn OpenPay in minutes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Step-by-step guides, live demos, and tutorials for every feature.</p>
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search features" className="pl-9" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${category === c ? "bg-paypal-blue text-white" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                {c}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {filtered.length === 0 && <p className="py-12 text-center text-muted-foreground">No features match your search.</p>}
          {filtered.map((f) => {
            const Icon = f.icon;
            return (
              <article key={`${f.source}-${f.id}`} id={f.id} className="paypal-surface scroll-mt-24 overflow-hidden rounded-3xl">
                <div className="flex flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paypal-blue/10">
                        <Icon className="h-6 w-6 text-paypal-blue" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-paypal-dark">{f.title}</h3>
                          <Badge variant="secondary" className="text-[10px]">{f.category}</Badge>
                          {f.source === "db" && f.published === false && (
                            <Badge className="bg-amber-500 text-white text-[10px]">Draft</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{f.short}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(f)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {f.source === "db" && (
                            <Button size="sm" variant="outline" onClick={() => handleDelete(f)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                      {f.demoPath && (
                        <Button size="sm" onClick={() => navigate(f.demoPath!)} className="bg-paypal-blue hover:bg-paypal-blue/90">
                          <PlayCircle className="mr-1 h-4 w-4" />{f.demoLabel || "Try it"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {f.overview && <p className="text-sm leading-relaxed text-foreground/90">{f.overview}</p>}

                  <div className="grid gap-4 md:grid-cols-2">
                    {f.steps.length > 0 && (
                      <div className="rounded-2xl border border-border bg-background/60 p-4">
                        <h4 className="mb-2 text-sm font-semibold text-paypal-dark">How to use</h4>
                        <ol className="space-y-1.5 text-sm text-foreground/90">
                          {f.steps.map((s, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-paypal-blue text-[11px] font-bold text-white">{i + 1}</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {f.youtubeId && (
                      <div className="overflow-hidden rounded-2xl border border-border bg-black">
                        <div className="relative aspect-video">
                          <iframe src={`https://www.youtube.com/embed/${f.youtubeId}`} title={`${f.title} tutorial`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen loading="lazy" className="absolute inset-0 h-full w-full" />
                        </div>
                        <a href={`https://www.youtube.com/watch?v=${f.youtubeId}`} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                          <span>Watch on YouTube</span><ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {f.faqs && f.faqs.length > 0 && (
                    <Accordion type="single" collapsible className="rounded-2xl border border-border bg-background/60 px-4">
                      {f.faqs.map((faq, i) => (
                        <AccordionItem key={i} value={`faq-${f.id}-${i}`} className="border-b-0">
                          <AccordionTrigger className="text-sm">{faq.q}</AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="paypal-surface mt-8 rounded-3xl p-6 text-center">
          <h3 className="text-lg font-bold text-paypal-dark">Still need help?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Talk to a human or browse the full Help Center.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => navigate("/help-center")}>Help Center</Button>
            <Button variant="outline" onClick={() => navigate("/support")}>Contact Support</Button>
            <Button variant="outline" onClick={() => navigate("/openpay-documentation")}>Full Documentation</Button>
            <Button variant="outline" onClick={() => navigate("/openpay-api-docs")}>API Docs</Button>
          </div>
        </section>
      </main>

      {/* Admin editor */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editor?.id ? "Edit article" : "New article"}</DialogTitle>
          </DialogHeader>
          {editor && (
            <div className="grid gap-3 text-foreground">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Title *</Label>
                  <Input value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value, slug: editor.slug || slugify(e.target.value) })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value })} placeholder="auto-from-title" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Category</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })}>
                    {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Icon</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editor.iconName} onChange={(e) => setEditor({ ...editor, iconName: e.target.value })}>
                    {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Short blurb</Label>
                <Input value={editor.short} onChange={(e) => setEditor({ ...editor, short: e.target.value })} />
              </div>
              <div>
                <Label>Overview</Label>
                <Textarea value={editor.overview} rows={3} onChange={(e) => setEditor({ ...editor, overview: e.target.value })} />
              </div>
              <div>
                <Label>Steps (one per line)</Label>
                <Textarea value={editor.steps} rows={5} onChange={(e) => setEditor({ ...editor, steps: e.target.value })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Demo path</Label>
                  <Input value={editor.demoPath} onChange={(e) => setEditor({ ...editor, demoPath: e.target.value })} placeholder="/qr-pay" />
                </div>
                <div>
                  <Label>Demo button label</Label>
                  <Input value={editor.demoLabel} onChange={(e) => setEditor({ ...editor, demoLabel: e.target.value })} placeholder="Try it" />
                </div>
              </div>
              <div>
                <Label>YouTube video ID</Label>
                <Input value={editor.youtubeId} onChange={(e) => setEditor({ ...editor, youtubeId: e.target.value })} placeholder="e.g. dQw4w9WgXcQ" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editor.published} onChange={(e) => setEditor({ ...editor, published: e.target.checked })} />
                Published (visible to all users)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}><X className="mr-1 h-4 w-4" />Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-paypal-blue hover:bg-paypal-blue/90">
              <Save className="mr-1 h-4 w-4" />{saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HelpWikiPage;
