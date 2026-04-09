import { useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 80;

const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const progress = useTransform(y, [0, THRESHOLD], [0, 1]);
  const spinnerOpacity = useTransform(y, [0, 40, THRESHOLD], [0, 0.5, 1]);
  const spinnerScale = useTransform(y, [0, THRESHOLD], [0.5, 1]);
  const isDragging = useRef(false);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const el = containerRef.current;
    if (el && el.scrollTop <= 0) {
      isDragging.current = true;
      startY.current = e.touches[0].clientY;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || refreshing) return;
    const el = containerRef.current;
    if (el && el.scrollTop > 0) {
      isDragging.current = false;
      y.set(0);
      return;
    }
    const delta = Math.max(0, e.touches[0].clientY - startY.current);
    const dampened = delta * 0.45;
    y.set(Math.min(dampened, THRESHOLD * 1.3));
  }, [refreshing, y]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (y.get() >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      animate(y, THRESHOLD * 0.7, { duration: 0.2 });
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(y, 0, { duration: 0.3 });
      }
    } else {
      animate(y, 0, { duration: 0.25 });
    }
  }, [y, refreshing, onRefresh]);

  return (
    <div className="relative h-full flex flex-col min-h-0">
      {/* Spinner indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
        style={{ opacity: spinnerOpacity, height: 48 }}
      >
        <motion.div
          style={{ scale: spinnerScale }}
          className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center backdrop-blur-sm"
        >
          <Loader2
            size={20}
            className={`text-primary ${refreshing ? "animate-spin" : ""}`}
          />
        </motion.div>
      </motion.div>

      {/* Scrollable content */}
      <motion.div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-behavior-contain min-h-0"
        style={{ y }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;