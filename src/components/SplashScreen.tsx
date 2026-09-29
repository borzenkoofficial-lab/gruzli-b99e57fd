import { useEffect } from "react";

interface SplashScreenProps {
  onFinished: () => void;
  minDuration?: number;
}

const SplashScreen = ({ onFinished, minDuration = 650 }: SplashScreenProps) => {
  useEffect(() => {
    const returning = !!localStorage.getItem("gruzli_returning");
    const duration = returning ? 220 : minDuration;
    const timer = window.setTimeout(() => {
      localStorage.setItem("gruzli_returning", "1");
      onFinished();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [minDuration, onFinished]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-background text-foreground"
      aria-label="Gruzli"
    >
      <div className="absolute top-1/2 -translate-y-[62px] w-20 h-[2px] rounded-full bg-[#f2c400]" />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-[42px] leading-none font-extrabold tracking-[-0.05em]">Gruzli</h1>
        <p className="mt-3 text-[13px] tracking-[0.02em] text-muted-foreground">приветствует</p>
      </div>
    </div>
  );
};

export default SplashScreen;
