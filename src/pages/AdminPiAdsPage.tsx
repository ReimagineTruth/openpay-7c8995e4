import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Megaphone, Power, Clock, Gauge } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PiAdsSettings = {
  enabled: boolean;
  interstitial_enabled: boolean;
  rewarded_enabled: boolean;
  interstitial_interval_minutes: number;
  max_ads_per_hour: number;
  max_ads_per_day: number;
  updated_at?: string;
};

const DEFAULTS: PiAdsSettings = {
  enabled: true,
  interstitial_enabled: true,
  rewarded_enabled: true,
  interstitial_interval_minutes: 5,
  max_ads_per_hour: 12,
  max_ads_per_day: 60,
};

const AdminPiAdsPage = () => {
  const nav = useNavigate();
  const [s, setS] = useState<PiAdsSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("pi_ads_get_settings");
    if (error) {
      toast.error(error.message);
    } else if (data) {
      setS({
        enabled: !!data.enabled,
        interstitial_enabled: !!data.interstitial_enabled,
        rewarded_enabled: !!data.rewarded_enabled,
        interstitial_interval_minutes: Number(data.interstitial_interval_minutes ?? 5),
        max_ads_per_hour: Number(data.max_ads_per_hour ?? 12),
        max_ads_per_day: Number(data.max_ads_per_day ?? 60),
        updated_at: data.updated_at,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("pi_ads_set_settings", {
      p_enabled: s.enabled,
      p_interstitial_enabled: s.interstitial_enabled,
      p_rewarded_enabled: s.rewarded_enabled,
      p_interstitial_interval_minutes: Math.max(1, Math.min(1440, Math.floor(s.interstitial_interval_minutes || 5))),
      p_max_ads_per_hour: Math.max(0, Math.min(240, Math.floor(s.max_ads_per_hour || 0))),
      p_max_ads_per_day: Math.max(0, Math.min(2000, Math.floor(s.max_ads_per_day || 0))),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pi Ad Network settings saved");
    if (data) setS((prev) => ({ ...prev, ...data }));
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Back">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Pi Ad Network Admin</h1>
      </div>

      <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Global controls</h2>
            <p className="text-xs text-muted-foreground">
              These settings apply to every OpenPay user inside Pi Browser.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading settings…</p>
        ) : (
          <div className="mt-6 space-y-5">
            <ToggleRow
              icon={<Power className="h-4 w-4" />}
              title="Enable Pi Ad Network"
              desc="Master switch. When off, no ads (interstitial or rewarded) are shown anywhere."
              checked={s.enabled}
              onChange={(v) => setS({ ...s, enabled: v })}
            />
            <ToggleRow
              icon={<Megaphone className="h-4 w-4" />}
              title="Interstitial ads"
              desc="Auto-shown ads while users browse the app."
              checked={s.interstitial_enabled}
              onChange={(v) => setS({ ...s, interstitial_enabled: v })}
              disabled={!s.enabled}
            />
            <ToggleRow
              icon={<Megaphone className="h-4 w-4" />}
              title="Rewarded ads"
              desc="Ads users watch to unlock mining and other rewards."
              checked={s.rewarded_enabled}
              onChange={(v) => setS({ ...s, rewarded_enabled: v })}
              disabled={!s.enabled}
            />

            <NumberRow
              icon={<Clock className="h-4 w-4" />}
              title="Interstitial interval (minutes)"
              desc="Minimum minutes between two auto-shown interstitial ads for the same user."
              value={s.interstitial_interval_minutes}
              onChange={(v) => setS({ ...s, interstitial_interval_minutes: v })}
              min={1}
              max={1440}
              disabled={!s.enabled || !s.interstitial_enabled}
            />
            <NumberRow
              icon={<Gauge className="h-4 w-4" />}
              title="Max ads per hour"
              desc="Hard cap on interstitial ads shown per user each hour. Set 0 to disable interstitials by cap."
              value={s.max_ads_per_hour}
              onChange={(v) => setS({ ...s, max_ads_per_hour: v })}
              min={0}
              max={240}
              disabled={!s.enabled || !s.interstitial_enabled}
            />
            <NumberRow
              icon={<Gauge className="h-4 w-4" />}
              title="Max ads per day"
              desc="Daily cap on interstitial ads per user."
              value={s.max_ads_per_day}
              onChange={(v) => setS({ ...s, max_ads_per_day: v })}
              min={0}
              max={2000}
              disabled={!s.enabled || !s.interstitial_enabled}
            />

            <Button
              onClick={save}
              disabled={saving}
              className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save settings"}
            </Button>

            {s.updated_at && (
              <p className="text-xs text-muted-foreground">
                Last updated {new Date(s.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ToggleRow = ({
  icon, title, desc, checked, onChange, disabled,
}: {
  icon: React.ReactNode; title: string; desc: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) => (
  <div className={`flex items-start justify-between gap-4 rounded-2xl border border-border p-4 ${disabled ? "opacity-60" : ""}`}>
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-muted p-2 text-foreground">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
);

const NumberRow = ({
  icon, title, desc, value, onChange, min, max, disabled,
}: {
  icon: React.ReactNode; title: string; desc: string; value: number;
  onChange: (v: number) => void; min: number; max: number; disabled?: boolean;
}) => (
  <div className={`rounded-2xl border border-border p-4 ${disabled ? "opacity-60" : ""}`}>
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-muted p-2 text-foreground">{icon}</div>
      <div className="flex-1">
        <Label className="text-sm font-semibold text-foreground">{title}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-3 h-11 rounded-xl"
        />
      </div>
    </div>
  </div>
);

export default AdminPiAdsPage;
