import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Save, QrCode, Power, Wrench, Loader2, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  QR_PAY_PLATFORM_DEFAULTS,
  type QrPayPlatformSettings,
} from "@/lib/qrPayPlatformSettings";

export type { QrPayPlatformSettings };

const DEFAULTS = QR_PAY_PLATFORM_DEFAULTS;

const METHOD_TOGGLES: { key: keyof QrPayPlatformSettings; label: string; desc: string }[] = [
  { key: "allow_pi", label: "Pi Network", desc: "Pay with π in Pi Browser" },
  { key: "allow_wallet", label: "OpenPay Wallet", desc: "Internal OpenPay balance" },
  { key: "allow_virtual_card", label: "Virtual Card", desc: "OpenPay virtual card" },
  { key: "allow_google_pay", label: "Google Pay", desc: "PayMongo Google Pay" },
  { key: "allow_apple_pay", label: "Apple Pay", desc: "Coming-soon / stub toggle" },
  { key: "allow_paypal", label: "PayPal", desc: "Coming-soon / stub toggle" },
  { key: "allow_moonpay", label: "MoonPay", desc: "Coming-soon / stub toggle" },
  { key: "allow_qr_ph", label: "QR PH", desc: "PayMongo QR Ph" },
  { key: "allow_gcash", label: "GCash", desc: "PayMongo GCash" },
  { key: "allow_maya", label: "Maya", desc: "PayMongo Maya (PayMaya)" },
  { key: "allow_grab_pay", label: "GrabPay", desc: "PayMongo GrabPay" },
  { key: "allow_shopee_pay", label: "ShopeePay", desc: "PayMongo ShopeePay" },
  { key: "allow_billease", label: "BillEase BNPL", desc: "Buy now, pay later" },
  { key: "allow_bank", label: "Online Banking", desc: "BPI, UBP, BDO, Landbank, Metrobank" },
  { key: "allow_pro", label: "OpenPay Pro", desc: "Pro settlement checkout option" },
  { key: "allow_guest", label: "Guest checkout", desc: "Allow paying without OpenPay sign-in" },
];

export default function AdminQrPayPage() {
  const nav = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [s, setS] = useState<QrPayPlatformSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: isAdmin, error } = await (supabase as any).rpc("is_openpay_core_admin");
      if (error || !isAdmin) {
        toast.error("Admin access required");
        nav("/dashboard", { replace: true });
        return;
      }
      setAllowed(true);
      const { data, error: loadErr } = await (supabase as any).rpc("qr_pay_get_platform_settings");
      if (loadErr) {
        toast.error(loadErr.message || "Failed to load QR Pay settings — run the SQL migration first");
      } else if (data) {
        setS({ ...DEFAULTS, ...data });
      }
      setLoading(false);
    })();
  }, [nav]);

  const setFlag = (key: keyof QrPayPlatformSettings, value: boolean | string) => {
    setS((prev) => ({ ...prev, [key]: value }));
  };

  const setAllMethods = (on: boolean) => {
    setS((prev) => {
      const next = { ...prev };
      for (const m of METHOD_TOGGLES) {
        (next as any)[m.key] = on;
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("qr_pay_set_platform_settings", {
      p_maintenance_mode: s.maintenance_mode,
      p_maintenance_message: s.maintenance_message,
      p_allow_pi: s.allow_pi,
      p_allow_wallet: s.allow_wallet,
      p_allow_virtual_card: s.allow_virtual_card,
      p_allow_moonpay: s.allow_moonpay,
      p_allow_google_pay: s.allow_google_pay,
      p_allow_apple_pay: s.allow_apple_pay,
      p_allow_paypal: s.allow_paypal,
      p_allow_qr_ph: s.allow_qr_ph,
      p_allow_gcash: s.allow_gcash,
      p_allow_maya: s.allow_maya,
      p_allow_grab_pay: s.allow_grab_pay,
      p_allow_shopee_pay: s.allow_shopee_pay,
      p_allow_billease: s.allow_billease,
      p_allow_bank: s.allow_bank,
      p_allow_guest: s.allow_guest,
      p_allow_pro: s.allow_pro,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Save failed");
      return;
    }
    if (data) setS({ ...DEFAULTS, ...data });
    toast.success("QR Pay platform settings saved");
  };

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-28 pt-4">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => nav(-1)} aria-label="Back">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">QR Pay Admin</h1>
            <p className="text-xs text-muted-foreground">Global payment method controls</p>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 space-y-4">
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-700">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Maintenance</h2>
                  <p className="text-xs text-muted-foreground">
                    Turns off every QR Pay method until you disable this.
                  </p>
                </div>
              </div>
              <ToggleRow
                icon={<Power className="h-4 w-4" />}
                title="Maintenance mode"
                desc="Hide all payment methods on checkout and create."
                checked={s.maintenance_mode}
                onChange={(v) => setFlag("maintenance_mode", v)}
              />
              <div className="mt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Customer message</Label>
                <Input
                  value={s.maintenance_message}
                  onChange={(e) => setFlag("maintenance_message", e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Payment methods</h2>
                    <p className="text-xs text-muted-foreground">
                      Platform AND merchant toggle must both be on.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mb-4 flex gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setAllMethods(true)}>
                  Enable all
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setAllMethods(false)}>
                  Disable all
                </Button>
              </div>
              <div className="space-y-4">
                {METHOD_TOGGLES.map((m) => (
                  <ToggleRow
                    key={m.key}
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title={m.label}
                    desc={m.desc}
                    checked={Boolean(s[m.key])}
                    onChange={(v) => setFlag(m.key, v)}
                    disabled={s.maintenance_mode}
                  />
                ))}
              </div>
              {s.updated_at && (
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Last updated {new Date(s.updated_at).toLocaleString()}
                </p>
              )}
            </section>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <Button className="h-12 w-full gap-2 rounded-xl" onClick={() => void save()} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <p className="text-xs leading-snug text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
