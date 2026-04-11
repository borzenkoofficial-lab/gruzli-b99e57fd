import { useEffect } from "react";

/**
 * Sets --vh custom property based on window.visualViewport.
 * This fixes iOS Safari issues where 100dvh changes unpredictably
 * after rotation, keyboard open/close, or toolbar show/hide.
 */
export function useViewportHeight() {
  useEffect(() => {
    function setVH() {
      const vh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    setVH();

    // visualViewport fires reliably on iOS when toolbar/keyboard changes
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", setVH);
      vv.addEventListener("scroll", setVH);
    }
    window.addEventListener("orientationchange", () => {
      // delay to let iOS finish rotation animation
      setTimeout(setVH, 150);
    });
    window.addEventListener("resize", setVH);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", setVH);
        vv.removeEventListener("scroll", setVH);
      }
      window.removeEventListener("resize", setVH);
    };
  }, []);
}
