import { useEffect, useRef, useState } from "react";

/**
 * Returns true when the floating UI should be hidden (user scrolling down),
 * false when it should be visible (scrolling up / near top).
 */
export function useHideOnScroll(threshold = 8): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY || 0;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const dy = y - lastY.current;
        if (y < 40) {
          setHidden(false);
        } else if (Math.abs(dy) > threshold) {
          setHidden(dy > 0);
          lastY.current = y;
        }
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return hidden;
}
