import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gruzliSplash from "@/assets/gruzli-splash.jpeg";

interface SplashScreenProps {
  onFinished: () => void;
  minDuration?: number;
}

const SplashScreen = ({ onFinished, minDuration = 2200 }: SplashScreenProps) => {
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState(0); // 0=logo, 1=text, 2=bar

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 900);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinished, 500);
    }, minDuration);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(timer); };
  }, [minDuration, onFinished]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "#0a0a0a" }}
        >
          {/* Ambient glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.15, scale: 1.2 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute w-64 h-64 rounded-full"
            style={{ background: "radial-gradient(circle, hsl(50 100% 50% / 0.4), transparent 70%)", filter: "blur(60px)" }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 200, duration: 0.7 }}
            className="relative"
          >
            <motion.div
              animate={{ boxShadow: [
                "0 0 0px hsl(50 100% 50% / 0)",
                "0 0 40px hsl(50 100% 50% / 0.3)",
                "0 0 20px hsl(50 100% 50% / 0.15)",
              ]}}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-28 h-28 rounded-3xl overflow-hidden"
            >
              <img src={gruzliSplash} alt="Gruzli" className="w-full h-full object-cover" />
            </motion.div>
          </motion.div>

          {/* Brand text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mt-6 text-center"
          >
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "#fff" }}>
              Gruzli<span style={{ color: "hsl(50, 100%, 50%)" }}>.</span>
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={phase >= 1 ? { opacity: 0.5 } : {}}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-xs mt-2"
              style={{ color: "hsl(0 0% 60%)" }}
            >
              Работа рядом
            </motion.p>
          </motion.div>

          {/* Loading bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : {}}
            transition={{ duration: 0.3 }}
            className="mt-10 w-40 h-1 rounded-full overflow-hidden"
            style={{ background: "hsl(0 0% 20%)" }}
          >
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, hsl(50 100% 50%), hsl(40 100% 55%))" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
