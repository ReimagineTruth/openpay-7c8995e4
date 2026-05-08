const GOOGLE_WALLET_SUCCESS_SOUND_URL =
  "https://www.myinstants.com/media/sounds/google-wallet-payment-successful.mp3";

const NOTIFICATION_BELL_SOUND_URL =
  "https://www.myinstants.com/media/sounds/notification-bell-91796.mp3";

let successSound: HTMLAudioElement | null = null;
let notificationBellSound: HTMLAudioElement | null = null;

export const playGoogleWalletSuccessSound = () => {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;

  try {
    if (!successSound) {
      successSound = new Audio(GOOGLE_WALLET_SUCCESS_SOUND_URL);
      successSound.preload = "auto";
    }
    successSound.currentTime = 0;
    void successSound.play().catch(() => {});
  } catch {
    // no-op
  }
};

export const playNotificationBellSound = () => {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;

  try {
    if (!notificationBellSound) {
      notificationBellSound = new Audio(NOTIFICATION_BELL_SOUND_URL);
      notificationBellSound.preload = "auto";
    }
    notificationBellSound.currentTime = 0;
    void notificationBellSound.play().catch(() => {});
  } catch {
    // no-op
  }
};

