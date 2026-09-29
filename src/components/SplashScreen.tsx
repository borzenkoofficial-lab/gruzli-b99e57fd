import { useState, useEffect } from "react";

interface SplashScreenProps {
  onFinished: () => void;
  minDuration?: number;
}

const SplashScreen = ({ onFinished, minDuration = 650 }: SplashScreenProps) => {
  const isReturning = !!localStorage.getItem("gruzli_returning");
  const duration = isReturning ? 220 : minDuration;
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
    return (
    <div
      className={`gruzli-splash fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-background ${visible ? "is-visible" : "is-hidden"}`}
      aria-label="Gruzli"
    >
      <div className="absolute top-1/2 -translate-y-[62px] w-20 h-[2px] bg-[#f2c400] rounded-full" />
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-[42px] leading-none font-extrabold tracking-[-0.05em] text-foreground">Gruzli</h1>
        <p className="mt-3 text-[13px] tracking-[0.02em] text-muted-foreground font-normal">приветствует</p>
      </div>
      <div className="absolute bottom-[13%] w-24 h-[2px] rounded-full bg-foreground/10 overflow-hidden">
        <div className="gruzli-splash-progress h-full w-1/2 bg-[#f2c400]" />
      </div>
    </div>
  );
};

export default SplashScreen;
