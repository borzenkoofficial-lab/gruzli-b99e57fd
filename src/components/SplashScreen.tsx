import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gruzliSplash from "@/assets/gruzli-splash.jpeg";

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
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-background"
        >
          {/* Subtle grid backdrop */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(circle at center, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 75%)",
            }}
          />

          {/* Soft pulsating halo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.18, 0.1], scale: [0.6, 1.4, 1.2] }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            className="absolute w-80 h-80 rounded-full bg-foreground/20"
            style={{ filter: "blur(80px)" }}
          />

          {/* Concentric rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.6], opacity: [0.5, 0] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "easeOut",
              }}
              className="absolute w-32 h-32 rounded-full border border-foreground/30"
            />
          ))}

          {/* Logo container */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 16, stiffness: 220, delay: 0.1 }}
            className="relative z-10"
          >
            <div className="absolute -inset-4 rounded-[2rem] bg-foreground/5 blur-xl" />
            <div className="relative w-24 h-24 rounded-[1.75rem] overflow-hidden border border-border bg-card shadow-2xl">
              <img src={gruzliSplash} alt="Gruzli" className="w-full h-full object-cover" />
            </div>
          </motion.div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
            className="mt-7 text-center relative z-10"
          >
            <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">
              Gruzli
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="text-[11px] mt-1.5 uppercase tracking-[0.25em] text-muted-foreground font-semibold"
            >
              Работа без посредников
            </motion.p>
          </motion.div>

          {/* Animated dots loader */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-10 flex items-center gap-2 relative z-10"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeInOut",
                }}
                className="w-1.5 h-1.5 rounded-full bg-foreground"
              />
            ))}
          </motion.div>

          {/* Bottom signature */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute bottom-8 text-[10px] tracking-[0.3em] uppercase text-muted-foreground font-medium"
          >
            v 2.0 · est. 2025
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
