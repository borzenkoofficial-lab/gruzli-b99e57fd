import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { Reply } from "lucide-react";

interface SwipeableMessageProps {
  children: ReactNode;
  onReply: () => void;
}

/**
 * Wraps a message bubble. Drag right reveals a reply icon.
 * If the user releases past the threshold, onReply() fires and the bubble snaps back.
 *
 * While the user is performing a horizontal swipe, vertical page scroll is locked
 * by setting `touch-action: pan-y` initially and switching to `none` once the
 * gesture is detected as horizontal. We also prevent default on touchmove during
 * the active drag so the chat list does not scroll up/down.
 */
const SwipeableMessage = ({ children, onReply }: SwipeableMessageProps) => {
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [0, 30, 70], [0, 0.7, 1]);
  const iconScale = useTransform(x, [0, 70], [0.5, 1]);
  const triggeredRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lockedRef = useRef<"horizontal" | "vertical" | null>(null);

  // Native touch handlers to lock scroll once we know the gesture is horizontal.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY };
      lockedRef.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!startRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startRef.current.x;
      const dy = t.clientY - startRef.current.y;

      if (lockedRef.current === null) {
        // Decide direction once movement passes a small threshold
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
            lockedRef.current = "horizontal";
          } else {
            lockedRef.current = "vertical";
          }
        }
      }

      if (lockedRef.current === "horizontal") {
        // Block the parent scroll container from scrolling vertically
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      startRef.current = null;
      lockedRef.current = null;
    };

    // passive:false is required so we can call preventDefault on touchmove
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 70 && !triggeredRef.current) {
      triggeredRef.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.(15); } catch { /* ignore */ }
      }
    }
  };

  const handleDragEnd = () => {
    if (triggeredRef.current) {
      onReply();
    }
    triggeredRef.current = false;
    setIsDragging(false);
    animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
  };

  return (
    <div ref={containerRef} className="relative" style={{ touchAction: "pan-y" }}>
      <motion.div
        className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none z-0"
        style={{ opacity: iconOpacity, scale: iconScale }}
      >
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Reply size={16} className="text-primary" />
        </div>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 100 }}
        dragElastic={{ left: 0, right: 0.5 }}
        onDragStart={() => setIsDragging(true)}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className={`relative z-10 ${isDragging ? "" : "transition-none"}`}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableMessage;
