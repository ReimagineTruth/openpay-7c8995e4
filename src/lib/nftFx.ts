// NFT sound + haptic FX helpers
const URLS: Record<string, string> = {
  mint: "https://www.myinstants.com/media/sounds/level-up-3-199576.mp3",
  buy: "https://www.myinstants.com/media/sounds/google-wallet-payment-successful.mp3",
  gift: "https://www.myinstants.com/media/sounds/notification-bell-91796.mp3",
  list: "https://www.myinstants.com/media/sounds/store-scanner-beep-sound-effect.mp3",
  bid: "https://www.myinstants.com/media/sounds/applepay.mp3",
  auction: "https://www.myinstants.com/media/sounds/cashier-receipt-servo-sound-effect.mp3",
  splash: "https://www.myinstants.com/media/sounds/dono_UZmG3Ta.mp3",
  error: "https://www.myinstants.com/media/sounds/error-126627.mp3",
};
const cache: Record<string, HTMLAudioElement> = {};

export type NftSfx = keyof typeof URLS;

export const playNftSound = (kind: NftSfx) => {
  if (typeof window === "undefined") return;
  try {
    if (!cache[kind]) {
      const a = new Audio(URLS[kind]);
      a.preload = "auto";
      a.volume = 0.9;
      cache[kind] = a;
    }
    cache[kind].currentTime = 0;
    void cache[kind].play().catch(() => {});
  } catch {}
};

export const hapticPulse = (ms = 30) => {
  try { (navigator as any)?.vibrate?.(ms); } catch {}
};

export const celebrate = (kind: NftSfx = "buy") => {
  playNftSound(kind);
  hapticPulse(40);
};
