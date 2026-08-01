/**
 * Global external-link handling.
 *
 * OpenPay runs inside iframes (Lovable preview, embeds) and in-app webviews
 * (Pi Browser). In those contexts `target="_blank"` and `window.open` are often
 * blocked, so external links end up loading *inside* OpenPay. These helpers
 * always send the user to the real destination in a top-level context.
 */

const nativeOpen: typeof window.open | null =
  typeof window !== "undefined" ? window.open.bind(window) : null;

/** True when the current document is embedded in another frame. */
export function isEmbedded(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true; // cross-origin access threw => embedded
  }
}

/** True for absolute http(s) URLs pointing to another origin. */
export function isExternalUrl(url: string): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Navigate the outermost window to `url` (escapes iframes when allowed). */
function topLevelNavigate(url: string) {
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // cross-origin parent: fall through
  }
  window.location.href = url;
}

/**
 * Open `url` in a real new tab; falls back to a top-level navigation when
 * popups are blocked (iframes / in-app browsers).
 */
export function openExternalUrl(url: string): void {
  if (!url) return;
  try {
    const win = nativeOpen?.(url, "_blank", "noopener,noreferrer");
    if (win) {
      try {
        (win as Window).opener = null;
      } catch {
        // ignore
      }
      return;
    }
  } catch {
    // popup blocked
  }
  topLevelNavigate(url);
}

let installed = false;

/**
 * Intercept clicks on external anchors and route them through
 * `openExternalUrl`, and harden `window.open` for programmatic calls.
 */
export function installExternalLinkHandler(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  document.addEventListener(
    "click",
    (event) => {
      const e = event as MouseEvent;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (anchor.hasAttribute("download")) return;
      if (!isExternalUrl(href)) return;

      e.preventDefault();
      openExternalUrl(anchor.href);
    },
    true,
  );

  // Harden programmatic window.open calls used across the app.
  window.open = ((
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null => {
    const href = typeof url === "string" ? url : url?.toString() || "";
    let win: Window | null = null;
    try {
      win = nativeOpen?.(url as string, target || "_blank", features || "noopener,noreferrer") ?? null;
    } catch {
      win = null;
    }
    if (!win && href && isExternalUrl(href)) {
      topLevelNavigate(href);
    }
    return win;
  }) as typeof window.open;
}
