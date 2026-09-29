import { useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 72;

const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    const shouldRefresh = distance.current >= THRESHOLD;
    distance.current = 0;
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
      {refreshing && (
        <div className="pull-refresh-indicator" aria-label="Обновление">
          <Loader2 size={18} className="animate-spin" />
        </div>
      )}
    </div>
  );
};

export default PullToRefresh;
