import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onFinished: () => void;
  minDuration?: number;
}

const SplashScreen = ({ onFinished, minDuration = 2000 }: SplashScreenProps) => {
  const isReturning = !!localStorage.getItem("gruzli_returning");
  const duration = isReturning ? 450 : minDuration;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        setVisible(false);
        localStorage.setItem("gruzli_returning", "1");
        setTimeout(onFinished, 350);
      }, duration),
    );
    return () => timers.forEach(clearTimeout);
  }, [duration, onFinished]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-background"
        >
          {/* Hairline divider above wordmark */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
            className="absolute top-1/2 -translate-y-[64px] w-24 h-px bg-foreground/20 origin-center"
          />

          {/* Wordmark */}
          <div className="relative z-10 flex flex-col items-center">
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-[40px] leading-none font-light tracking-[-0.03em] text-foreground"
            >
              Gruzli
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
              className="mt-3 text-[13px] tracking-[0.02em] text-muted-foreground font-normal"
            >
              приветствует
            </motion.p>
          </div>

          {/* Minimal progress line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="absolute bottom-[15%] w-32 h-px bg-foreground/10 overflow-hidden"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="h-full w-1/2 bg-foreground/60"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
