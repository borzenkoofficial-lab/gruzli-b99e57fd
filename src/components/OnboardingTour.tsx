import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Briefcase, MessageSquare, Bell, Smartphone, ChevronRight, ChevronLeft,
  PartyPopper, Zap, ClipboardList, User, Shield, ArrowDown, Check, X,
  Home, Share, MoreVertical, Plus, Search
} from "lucide-react";

interface OnboardingTourProps {
  onComplete: () => void;
}

const SWIPE_THRESHOLD = 50;

/* ───── Detect platform ───── */
const getPlatform = (): "android" | "ios" | "desktop" => {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
};

/* ───── Progress bar ───── */
const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <div className="flex gap-1.5 w-full max-w-xs mx-auto">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-muted/30">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: i <= current ? "100%" : "0%" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    ))}
  </div>
);

/* ───── Step 1: Welcome ───── */
const WelcomeStep = () => (
  <div className="flex flex-col items-center text-center px-6">
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
      className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6"
    >
      <span className="text-5xl font-extrabold text-primary">G</span>
    </motion.div>
    <motion.h1
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="text-2xl font-extrabold text-foreground mb-3"
    >
      Добро пожаловать в Gruzli!
    </motion.h1>
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 }}
      className="text-sm text-muted-foreground leading-relaxed max-w-sm"
    >
      Gruzli — платформа, которая соединяет грузчиков и диспетчеров.
      Находите заказы, общайтесь напрямую и зарабатывайте быстрее.
    </motion.p>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="grid grid-cols-2 gap-3 mt-6 w-full max-w-xs"
    >
      {[
        { icon: Briefcase, label: "Заказы", color: "text-blue-400" },
        { icon: Zap, label: "Быстро", color: "text-yellow-400" },
        { icon: Shield, label: "Надёжно", color: "text-green-400" },
        { icon: MessageSquare, label: "Чат", color: "text-purple-400" },
      ].map((f, i) => (
        <motion.div
          key={f.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 + i * 0.1 }}
          className="bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-1.5"
        >
          <f.icon size={20} className={f.color} />
          <span className="text-xs font-semibold text-foreground">{f.label}</span>
        </motion.div>
      ))}
    </motion.div>
  </div>
);

/* ───── Step 2: UI Guide ───── */
const UIGuideStep = () => (
  <div className="flex flex-col items-center text-center px-6">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <h2 className="text-xl font-bold text-foreground mb-2">Как устроено приложение</h2>
      <p className="text-xs text-muted-foreground">Внизу экрана — главное меню</p>
    </motion.div>

    {/* Mock bottom nav */}
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-sm bg-card border border-border rounded-2xl p-3 mb-5"
    >
      <div className="flex justify-around">
        {[
          { icon: Home, label: "Главная", desc: "Лента заказов" },
          { icon: ClipboardList, label: "Заказы", desc: "Ваши отклики" },
          { icon: MessageSquare, label: "Чаты", desc: "Переписки" },
          { icon: User, label: "Профиль", desc: "Ваш аккаунт" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.15 }}
            className="flex flex-col items-center gap-1 relative"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <item.icon size={18} className="text-primary" />
            </div>
            <span className="text-[10px] font-semibold text-foreground">{item.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>

    {/* Feature explanations */}
    <div className="space-y-2.5 w-full max-w-sm">
      {[
        { icon: Search, text: "На главной — свежие заказы. Откликайтесь одним нажатием" },
        { icon: Plus, text: "Диспетчеры создают заказы через кнопку «+»" },
        { icon: MessageSquare, text: "В чатах — прямая связь с заказчиком" },
      ].map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 + i * 0.15 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50"
        >
          <item.icon size={16} className="text-primary shrink-0" />
          <span className="text-xs text-muted-foreground text-left">{item.text}</span>
        </motion.div>
      ))}
    </div>
  </div>
);

/* ───── Step 3: Push Notifications ───── */
const NotificationsStep = () => {
  const [status, setStatus] = useState<"idle" | "granted" | "denied">("idle");

  const handleEnable = async () => {
    try {
      const perm = await Notification.requestPermission();
      setStatus(perm === "granted" ? "granted" : "denied");
      if (perm === "granted" && window.progressier) {
        window.progressier.add({});
      }
    } catch {
      setStatus("denied");
    }
  };

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setStatus("granted");
    }
  }, []);

  return (
    <div className="flex flex-col items-center text-center px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5"
      >
        <Bell size={36} className="text-primary" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-bold text-foreground mb-2"
      >
        Не пропустите ничего важного
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed"
      >
        Включите уведомления, чтобы мгновенно узнавать о новых заказах,
        сообщениях и откликах. Это ключ к быстрому заработку!
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-xs"
      >
        {status === "idle" && (
          <button
            onClick={handleEnable}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Bell size={18} />
            Включить уведомления
          </button>
        )}
        {status === "granted" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check size={28} className="text-green-500" />
            </div>
            <p className="text-sm font-semibold text-green-500">Уведомления включены!</p>
          </motion.div>
        )}
        {status === "denied" && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">
              Уведомления заблокированы. Вы можете включить их позже в настройках браузера или приложения.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

/* ───── Step 4: Add to Home Screen ───── */
const AddToHomeStep = () => {
  const platform = getPlatform();

  const androidSteps = [
    { emoji: "⋮", text: "Нажмите на три точки в правом верхнем углу Chrome" },
    { emoji: "📲", text: "Выберите «Установить приложение» или «На главный экран»" },
    { emoji: "✏️", text: "Настройте название и нажмите «Добавить»" },
    { emoji: "🎉", text: "Приложение появится на рабочем столе!" },
  ];

  const iosSteps = [
    { emoji: "📤", text: "Нажмите кнопку «Поделиться» внизу Safari" },
    { emoji: "➕", text: "Прокрутите вниз и нажмите «На экран Домой»" },
    { emoji: "🔄", text: "Включите «Открыть как веб-приложение» (если есть)" },
    { emoji: "✏️", text: "Измените название и нажмите «Добавить»" },
  ];

  const steps = platform === "ios" ? iosSteps : androidSteps;
  const browserName = platform === "ios" ? "Safari" : "Chrome";

  return (
    <div className="flex flex-col items-center text-center px-6">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5"
      >
        <Smartphone size={36} className="text-primary" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-bold text-foreground mb-2"
      >
        Установите на главный экран
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-xs text-muted-foreground mb-5 max-w-sm leading-relaxed"
      >
        Приложение будет работать как нативное — своя иконка, быстрый запуск, без адресной строки
      </motion.p>

      {platform !== "desktop" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4"
        >
          Инструкция для {browserName}
        </motion.div>
      )}

      <div className="space-y-2.5 w-full max-w-sm">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.12 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
          >
            <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-lg shrink-0">
              {step.emoji}
            </div>
            <div className="text-left">
              <span className="text-[10px] text-muted-foreground font-semibold">Шаг {i + 1}</span>
              <p className="text-xs text-foreground">{step.text}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {platform === "desktop" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-xs text-muted-foreground mt-4 max-w-sm"
        >
          Откройте приложение на телефоне для установки на главный экран. На компьютере нажмите иконку установки в адресной строке.
        </motion.p>
      )}
    </div>
  );
};

/* ───── Step 5: Celebration ───── */
const CelebrationStep = ({ onStart }: { onStart: () => void }) => (
  <div className="flex flex-col items-center text-center px-6">
    {/* Confetti-like particles */}
    <div className="relative w-full h-32 mb-4 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            opacity: 0,
            y: 0,
            x: Math.random() * 300 - 150,
            scale: 0,
            rotate: Math.random() * 360,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, -80 - Math.random() * 60],
            x: (Math.random() - 0.5) * 200,
            scale: [0, 1, 0.8],
            rotate: Math.random() * 720,
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: 0.3 + Math.random() * 0.5,
            repeat: Infinity,
            repeatDelay: Math.random() * 2,
          }}
          className="absolute left-1/2 bottom-0"
          style={{
            width: 8 + Math.random() * 8,
            height: 8 + Math.random() * 8,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            backgroundColor: ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"][i % 6],
          }}
        />
      ))}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <PartyPopper size={56} className="text-primary" />
      </motion.div>
    </div>

    <motion.h2
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="text-2xl font-extrabold text-foreground mb-2"
    >
      Вы готовы! 🎉
    </motion.h2>
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65 }}
      className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed"
    >
      Всё настроено. Начните использовать Gruzli прямо сейчас — находите заказы, общайтесь и зарабатывайте!
    </motion.p>

    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, type: "spring" }}
      whileTap={{ scale: 0.95 }}
      onClick={onStart}
      className="w-full max-w-xs py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2"
    >
      Начать работу
      <ChevronRight size={18} />
    </motion.button>
  </div>
);

/* ───── Main Onboarding Component ───── */
const TOTAL_STEPS = 5;

const OnboardingTour = ({ onComplete }: OnboardingTourProps) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [step]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD && step < TOTAL_STEPS - 1) goNext();
    if (info.offset.x > SWIPE_THRESHOLD && step > 0) goPrev();
  };

  const handleComplete = useCallback(() => {
    localStorage.setItem("onboarding_completed", "true");
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    localStorage.setItem("onboarding_completed", "true");
    onComplete();
  }, [onComplete]);

  const isLastStep = step === TOTAL_STEPS - 1;

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <WelcomeStep />;
      case 1: return <UIGuideStep />;
      case 2: return <NotificationsStep />;
      case 3: return <AddToHomeStep />;
      case 4: return <CelebrationStep onStart={handleComplete} />;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-background flex flex-col"
      style={{ height: "100dvh" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
        <ProgressBar current={step} total={TOTAL_STEPS} />
        {!isLastStep && (
          <button onClick={handleSkip} className="text-xs text-muted-foreground ml-4 shrink-0">
            Пропустить
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="w-full"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom buttons */}
      {!isLastStep && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 pb-6 shrink-0 flex gap-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        >
          {step > 0 && (
            <button
              onClick={goPrev}
              className="flex-1 py-3.5 rounded-2xl bg-card border border-border text-foreground text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <ChevronLeft size={16} />
              Назад
            </button>
          )}
          <button
            onClick={goNext}
            className="flex-1 py-3.5 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
          >
            Далее
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default OnboardingTour;
