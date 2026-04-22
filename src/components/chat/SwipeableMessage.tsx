import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { Reply } from "lucide-react";

interface SwipeableMessageProps {
  children: ReactNode;
  onReply: () => void;
}

/**
 * Wraps a message bubble. Drag right reveals a reply icon.
 * If the user releases past the threshold, onReply() fires and the bubble snaps back.
 */
const SwipeableMessage = ({ children, onReply }: SwipeableMessageProps) => {
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [0, 30, 70], [0, 0.7, 1]);
  const iconScale = useTransform(x, [0, 70], [0.5, 1]);
  const triggeredRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 70 && !triggeredRef.current) {
      triggeredRef.current = true;
      // light haptic if available
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
    <div className="relative">
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
