import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { hashSecret, loadAppSecuritySettings, markPinSetupCompleted, saveAppSecuritySettings } from "@/lib/appSecurity";
import { getAppCookie, loadUserPreferences, setAppCookie, upsertUserPreferences } from "@/lib/userPreferences";
import { generateOpenPayAccountNumber } from "@/lib/openpayIdentity";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinAlreadySet, setPinAlreadySet] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/signin", { replace: true });
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", user.id)
        .single();

      const loadedName = (profile?.full_name || "").trim();
      const loadedUsername = (profile?.username || "").trim();
      setAvatarUrl(profile?.avatar_url || "");
      setFullName(loadedName);
      setUsername(loadedUsername.startsWith("pi_") ? "" : loadedUsername);

      const localSettings = loadAppSecuritySettings(user.id);
      let prefPinHash: string | undefined;
      let prefOnboardingCompleted = false;
      try {
        const prefs = await loadUserPreferences(user.id);
        prefPinHash = prefs.security_settings?.pinHash;
        prefOnboardingCompleted = Boolean(prefs.onboarding_completed);
        if (prefPinHash && !localSettings.pinHash) {
          const merged = { ...prefs.security_settings, ...localSettings };
          saveAppSecuritySettings(user.id, merged);
        }
      } catch {
        // Ignore DB preferences errors; fall back to device-only settings.
      }

      const pinIsSet = Boolean(localSettings?.pinHash || prefPinHash);
      setPinAlreadySet(pinIsSet);

      const allowRepeat = new URLSearchParams(location.search).get("reset") === "1";
      const hasProfile = Boolean(
        loadedName &&
        loadedUsername &&
        !loadedUsername.toLowerCase().startsWith("pi_"),
      );
      const onboardingKey = `openpay_onboarding_done_v1_${user.id}`;
      const hasFinishedOnboarding =
        prefOnboardingCompleted ||
        (typeof window !== "undefined" && localStorage.getItem(onboardingKey) === "1") ||
        getAppCookie(onboardingKey) === "1";

      if (!allowRepeat && hasProfile && pinIsSet && hasFinishedOnboarding) {
        navigate("/dashboard", { replace: true });
        return;
      }
    };

    void load();
  }, [location.search, navigate]);

  const normalizedUsername = useMemo(() => {
    return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  }, [username]);

  const suggestUsername = (base: string) => {
    const safe = String(base || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const suffix = (userId || "").replace(/-/g, "").slice(0, 4) || "01";
    const candidate = `${safe}${suffix}`.slice(0, 20);
    return candidate.length >= 3 ? candidate : `user_${suffix}`;
  };

  const isUsernameAvailable = async (desired: string) => {
    if (!desired || !userId) return false;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      // Use exact match (ILIKE treats '_' as wildcard); still best-effort since RLS may restrict visibility.
      .eq("username", desired)
      .neq("id", userId)
      .limit(1);
    if (error) throw new Error(error.message || "Username check failed");
    return !data || data.length === 0;
  };

  const initials = fullName
    ? fullName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "OP";

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;

    setUploadingAvatar(true);
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploadingAvatar(false);
      toast.error(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    setUploadingAvatar(false);
    if (profileError) {
      toast.error(profileError.message);
      return;
    }

    setAvatarUrl(publicUrl);
    toast.success("Profile image updated");
  };

  const handleSave = async () => {
    if (!userId) return;

    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/i.test(normalizedUsername)) {
      toast.error("Username must be 3-20 characters and use letters, numbers, or underscore");
      return;
    }

    try {
      const available = await isUsernameAvailable(normalizedUsername);
      if (!available) {
        const suggestion = suggestUsername(normalizedUsername);
        toast.error(`Username already taken. Try "${suggestion}"`);
        setUsername(suggestion);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to check username availability";
      toast.error(message);
      return;
    }

    if (!pinAlreadySet) {
      if (!/^\d{4,8}$/.test(pin.trim())) {
        toast.error("PIN must be 4-8 digits");
        return;
      }
      if (pin.trim() !== pinConfirm.trim()) {
        toast.error("PIN confirmation does not match");
        return;
      }
    }

    setSaving(true);
    try {
      // Keep onboarding behavior aligned with Settings: update profile + user_preferences.
      // Avoid relying on server-side onboarding RPCs that may insert invalid user_accounts rows.
      const trimmedName = fullName.trim();
      const trimmedUsername = normalizedUsername;

      const { data: updatedRows, error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          username: trimmedUsername,
        })
        .eq("id", userId)
        .select("id");

      if (profileError) {
        const msg = String(profileError.message || "");
        const code = String((profileError as any)?.code || "");
        const duplicate =
          code === "23505" || msg.includes("profiles_username_key") || msg.toLowerCase().includes("duplicate key");
        if (duplicate) {
          const suggestion = suggestUsername(trimmedUsername || trimmedName);
          setUsername(suggestion);
          toast.error(`Username already taken. Try \"${suggestion}\" then tap Finish setup again.`);
          return;
        }
        throw new Error(msg || "Failed to save profile");
      }

      if (!updatedRows || updatedRows.length === 0) {
        const referralBase = trimmedUsername || `user_${userId.replace(/-/g, "").slice(0, 12)}`;
        const fallbackReferral = `user_${userId.replace(/-/g, "").slice(0, 12)}`;
        let created = false;
        let lastInsertError = "";
        const candidates = [
          referralBase,
          ...Array.from({ length: 24 }, (_, i) => `${referralBase}${i + 1}`),
          fallbackReferral,
        ];

        for (const referral_code of candidates) {
          const insertPayload = {
            id: userId,
            full_name: trimmedName,
            username: trimmedUsername,
            referral_code,
          } as any;

          const { error: insertError } = await supabase.from("profiles").insert(insertPayload);
          if (!insertError) {
            created = true;
            break;
          }

          const msg = String(insertError.message || "");
          const code = String((insertError as any)?.code || "");
          const duplicate =
            code === "23505" || msg.includes("profiles_username_key") || msg.toLowerCase().includes("duplicate key");
          if (duplicate) {
            const suggestion = suggestUsername(trimmedUsername || trimmedName);
            setUsername(suggestion);
            toast.error(`Username already taken. Try \"${suggestion}\" then tap Finish setup again.`);
            return;
          }
          lastInsertError = msg;
          if (msg.toLowerCase().includes("column") && msg.toLowerCase().includes("referral_code")) {
            const { error: retryError } = await supabase.from("profiles").insert({
              id: userId,
              full_name: trimmedName,
              username: trimmedUsername,
            } as any);
            if (!retryError) {
              created = true;
              break;
            }
            const retryMsg = String(retryError.message || "");
            const retryCode = String((retryError as any)?.code || "");
            const retryDuplicate =
              retryCode === "23505" ||
              retryMsg.includes("profiles_username_key") ||
              retryMsg.toLowerCase().includes("duplicate key");
            if (retryDuplicate) {
              const suggestion = suggestUsername(trimmedUsername || trimmedName);
              setUsername(suggestion);
              toast.error(`Username already taken. Try \"${suggestion}\" then tap Finish setup again.`);
              return;
            }
            lastInsertError = retryMsg;
          }
        }

        if (!created) {
          throw new Error(
            `Profile record was missing and could not be created. ${lastInsertError ? `Last error: ${lastInsertError}` : "Apply the latest Supabase migrations then try again."}`,
          );
        }
      }

      let securitySettingsToPersist = loadAppSecuritySettings(userId);
      if (!pinAlreadySet) {
        const pinHash = await hashSecret(pin);
        const current = loadAppSecuritySettings(userId);
        const updated = { ...current, pinHash };
        saveAppSecuritySettings(userId, updated);
        securitySettingsToPersist = updated;
      }
      markPinSetupCompleted(userId);

      upsertUserPreferences(userId, {
        profile_full_name: trimmedName,
        profile_username: trimmedUsername,
        onboarding_completed: true,
        onboarding_step: 5,
        security_settings: securitySettingsToPersist,
      }).catch(() => undefined);

      toast.success("Account setup complete");
      try {
        const onboardingKey = `openpay_onboarding_done_v1_${userId}`;
        localStorage.setItem(onboardingKey, "1");
        setAppCookie(onboardingKey, "1");
      } catch {
        // ignore local persistence failures
      }

      // Best-effort: ensure user_accounts exists for dashboard; don't block onboarding on this.
      try {
        const accountNumber = generateOpenPayAccountNumber(userId);
        const { error: accountError } = await supabase.from("user_accounts").upsert(
          {
            user_id: userId,
            account_number: accountNumber,
            account_name: trimmedName,
            account_username: trimmedUsername,
          },
          { onConflict: "user_id" },
        );

        if (accountError) {
          await (supabase as any).rpc("upsert_my_user_account");
        }
      } catch {
        // ignore rpc failures
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete onboarding";
      if (message.includes("user_accounts_account_number_format_ck")) {
        toast.error(
          "Onboarding failed due to a database account-number constraint. Apply the latest Supabase migrations (user_accounts format + onboarding RPC) then try again.",
        );
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-8 pb-10">
      <div className="mx-auto max-w-md">
        <h1 className="paypal-heading">Complete your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your name, username, and security PIN to start using OpenPay.
        </p>

        <div className="paypal-surface mt-5 rounded-3xl p-5">
          <div className="mb-4 flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile avatar" className="h-16 w-16 rounded-full border border-border object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paypal-blue text-lg font-bold text-white">
                {initials}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Profile image</p>
              <Input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="mt-2 h-11 rounded-2xl bg-white"
              />
              {uploadingAvatar && <p className="mt-1 text-xs text-muted-foreground">Uploading image...</p>}
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Full Name</p>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="h-12 rounded-2xl bg-white"
              />
            </div>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Username</p>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                className="h-12 rounded-2xl bg-white"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use 3-20 letters, numbers, or underscore.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-semibold text-foreground">Security PIN</p>
            {pinAlreadySet ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Your PIN is already set. You can update it later in Settings.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Create PIN</p>
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    type="password"
                    inputMode="numeric"
                    placeholder="4-8 digits"
                    className="h-11 rounded-2xl bg-white"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Confirm PIN</p>
                  <Input
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                    type="password"
                    inputMode="numeric"
                    placeholder="Re-enter PIN"
                    className="h-11 rounded-2xl bg-white"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">PIN protects payments and wallet actions.</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 h-12 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
          >
            {saving ? "Saving..." : "Finish setup"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
