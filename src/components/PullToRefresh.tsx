import { useState, useRef, useCallback } from "react";
import { ArrowDown, Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 72;

const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const distance = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 1) return;
    startY.current = e.touches[0]?.clientY ?? 0;
    distance.current = 0;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop > 1) {
      pulling.current = false;
      distance.current = 0;
      return;
    }
    const delta = Math.max(0, (e.touches[0]?.clientY ?? 0) - startY.current);
    // Do not translate the whole page. Native overscroll is allowed to show a small indicator,
    // while the content itself stays anchored, preventing the "cut off" viewport effect.
    distance.current = delta;
    const indicator = indicatorRef.current;
    if (indicator) {
      const progress = Math.min(1, delta / THRESHOLD);
      indicator.style.opacity = String(Math.min(1, delta / 24));
      indicator.style.transform = `translate(-50%, ${Math.min(44, delta * 0.45)}px)`;
      indicator.dataset.ready = delta >= THRESHOLD ? "true" : "false";
      indicator.style.setProperty("--pull-progress", String(progress));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    const shouldRefresh = distance.current >= THRESHOLD;
    distance.current = 0;
    if (indicatorRef.current) {
      indicatorRef.current.style.opacity = "0";
      indicatorRef.current.style.transform = "translate(-50%, 0)";
      indicatorRef.current.dataset.ready = "false";
    }
    if (!shouldRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, onRefresh]);

  return (
    <div className="pull-refresh-shell">
      <div
        ref={containerRef}
        className="pull-refresh-scroll"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
      <div
        ref={indicatorRef}
        className="pull-refresh-indicator"
        data-ready="false"
        aria-label={refreshing ? "Обновление" : "Потяните вниз для обновления"}
        aria-hidden={!refreshing}
      >
        {refreshing ? <Loader2 size={18} className="animate-spin" /> : <ArrowDown size={18} />}
      </div>
    </div>
  );
};

export default PullToRefresh;
