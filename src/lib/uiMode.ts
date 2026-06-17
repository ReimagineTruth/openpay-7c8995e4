// UI Mode switcher: "original" (PayPal-style) vs "web3" (Avvio-style dark/neon wallet)
export type UiMode = "original" | "web3";

const STORAGE_KEY = "openpay_ui_mode";
const EVENT_NAME = "openpay:ui-mode-changed";

export const getUiMode = (): UiMode => {
  if (typeof window === "undefined") return "original";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "web3" ? "web3" : "original";
};

export const setUiMode = (mode: UiMode) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: mode }));
};

export const subscribeUiMode = (cb: (mode: UiMode) => void) => {
  const handler = (e: Event) => cb(((e as CustomEvent).detail as UiMode) ?? getUiMode());
  const storageHandler = () => cb(getUiMode());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", storageHandler);
  };
};
