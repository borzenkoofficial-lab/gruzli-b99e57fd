import { useEffect } from "react";

/**
 * Sets --vh custom property based on window.innerHeight (NOT visualViewport).
 * We intentionally use innerHeight so the layout does NOT shrink when the
 * iOS keyboard opens — content stays in place and keyboard overlays it.
 * Also locks orientation to portrait on supported browsers.
 */
export function useViewportHeight() {
  useEffect(() => {
    // Use innerHeight — it does NOT change when the keyboard opens on iOS
    function setVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    setVH();

    // Only update on real resize/orientation, not keyboard
    window.addEventListener("resize", setVH);
    window.addEventListener("orientationchange", () => {
      setTimeout(setVH, 200);
    });

    // Lock orientation to portrait
    try {
      (screen.orientation as any)?.lock?.("portrait").catch(() => {});
    } catch {}

    return () => {
      window.removeEventListener("resize", setVH);
    };
  }, []);
}
