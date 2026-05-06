import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useThankYouModal } from "@/contexts/ThankYouModalContext";

const notificationBellSoundUrl = "https://www.myinstants.com/media/sounds/dono_UZmG3Ta.mp3";
let notificationBellAudio: HTMLAudioElement | null = null;
let receiveSoundUnlocked = false;

const playNotificationBellSound = () => {
  if (typeof window === "undefined") return;
  try {
    if (!notificationBellAudio) {
      notificationBellAudio = new Audio(notificationBellSoundUrl);
      notificationBellAudio.preload = "auto";
      notificationBellAudio.volume = 0.95;
    }
    notificationBellAudio.currentTime = 0;
    const playPromise = notificationBellAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      void playPromise.catch(() => undefined);
    }
  } catch {
    // no-op
  }
};

const showSystemNotification = async (title: string, body: string) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/notifications-sw.js");
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: "/openpay-logo.jpg",
          badge: "/openpay-logo.jpg",
          tag: "openpay-notification",
        });
        return;
      }
    }
  } catch {
    // Fall back to regular Notification below.
  }

  // Fallback when service worker is unavailable.
  new Notification(title, { body, icon: "/openpay-logo.jpg" });
};

export const useRealtimePushNotifications = () => {
  const { showThankYouModal } = useThankYouModal();

  useEffect(() => {
    let isMounted = true;
    const unlockAudio = () => {
      if (receiveSoundUnlocked || typeof window === "undefined") return;
      receiveSoundUnlocked = true;
      if (!notificationBellAudio) {
        notificationBellAudio = new Audio(notificationBellSoundUrl);
        notificationBellAudio.preload = "auto";
        notificationBellAudio.volume = 0.95;
      }
      notificationBellAudio.load();
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          void ctx.resume().finally(() => {
            void ctx.close();
          });
        } else {
          void ctx.close();
        }
      } catch {
        // no-op
      }
    };
    if (typeof window !== "undefined") {
      const events: Array<keyof WindowEventMap> = ["pointerdown", "touchend", "keydown"];
      for (const eventName of events) {
        window.addEventListener(eventName, unlockAudio, { passive: true });
      }
    }

    const bootstrap = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      const maybeNotify = async (title: string, body: string) => {
        playNotificationBellSound();
        if (document.visibilityState === "visible") {
          toast.info(`${title}: ${body}`);
        }
        await showSystemNotification(title, body);
      };

      const txChannel = supabase
        .channel(`tx-receiver-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "transactions",
            filter: `receiver_id=eq.${user.id}`,
          },
          async (payload) => {
            const tx = payload.new as { 
              amount?: number; 
              sender_id?: string; 
              receiver_id?: string;
              note?: string;
              purpose?: string;
              sender?: { full_name?: string; username?: string; avatar_url?: string };
            };
            const amount = Number(tx.amount || 0).toFixed(2);
            const isTopUp = tx.sender_id === tx.receiver_id && tx.receiver_id === user.id;
            if (isTopUp) {
              await maybeNotify("Top up successful", `$${amount} was added to your balance.`);
            } else {
              // Show ThankYouModal for received payments
              try {
                // Get sender details
                const { data: senderProfile } = await supabase
                  .from("profiles")
                  .select("full_name, username, avatar_url")
                  .eq("id", tx.sender_id)
                  .single();

                showThankYouModal({
                  receiverName: senderProfile?.full_name || "Someone",
                  receiverUsername: senderProfile?.username || undefined,
                  amount: Number(tx.amount || 0),
                  purpose: tx.purpose || undefined,
                  note: tx.note || undefined,
                  receiverAvatar: senderProfile?.avatar_url || undefined,
                  transactionId: payload.new.id,
                  date: new Date(payload.new.created_at),
                });
              } catch (error) {
                console.error("Error showing ThankYouModal for receiver:", error);
                // Fallback to regular notification
                await maybeNotify("Payment received", `$${amount} was added to your balance.`);
              }
            }
          },
        )
        .subscribe();

      const requestChannel = supabase
        .channel(`request-payer-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "payment_requests",
            filter: `payer_id=eq.${user.id}`,
          },
          async (payload) => {
            const amount = Number((payload.new as { amount?: number }).amount || 0).toFixed(2);
            await maybeNotify("Money request", `You received a request for $${amount}.`);
          },
        )
        .subscribe();

      const invoiceChannel = supabase
        .channel(`invoice-recipient-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "invoices",
            filter: `recipient_id=eq.${user.id}`,
          },
          async (payload) => {
            const amount = Number((payload.new as { amount?: number }).amount || 0).toFixed(2);
            await maybeNotify("Invoice received", `New invoice for $${amount}.`);
          },
        )
        .subscribe();

      const supportChannel = supabase
        .channel(`support-user-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "support_tickets",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const status = String((payload.new as { status?: string }).status || "updated").replace("_", " ");
            await maybeNotify("Support update", `Your ticket status is now ${status}.`);
          },
        )
        .subscribe();

      // Unified stream: covers mining rewards, staking, disputes, merchant payments,
      // request paid/declined, invoice paid, etc.
      const appNotifChannel = supabase
        .channel(`app-notif-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "app_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const n = payload.new as { title?: string; message?: string; metadata?: Record<string, unknown> };
            const event = String((n.metadata as any)?.event || "");
            // Skip events already handled by dedicated channels above to avoid duplicates
            if (
              event === "payment_received" ||
              event === "top_up_success" ||
              event === "money_request_received" ||
              event === "invoice_received"
            ) {
              return;
            }
            await maybeNotify(n.title || "Notification", n.message || "");
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(txChannel);
        supabase.removeChannel(requestChannel);
        supabase.removeChannel(invoiceChannel);
        supabase.removeChannel(supportChannel);
        supabase.removeChannel(appNotifChannel);
      };
    };

    let cleanup: (() => void) | undefined;
    bootstrap().then((fn) => {
      cleanup = fn;
    });

    return () => {
      isMounted = false;
      if (cleanup) cleanup();
      if (typeof window !== "undefined") {
        const events: Array<keyof WindowEventMap> = ["pointerdown", "touchend", "keydown"];
        for (const eventName of events) {
          window.removeEventListener(eventName, unlockAudio);
        }
      }
    };
  }, []);
};
