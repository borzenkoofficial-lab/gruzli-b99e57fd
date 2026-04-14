import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Briefcase, MessageSquare, Bell, Smartphone, ChevronRight, ChevronLeft,
  PartyPopper, Zap, ClipboardList, User, Shield, Check,
  Home, Plus, Search, Users, Star, DollarSign, BarChart3, FolderOpen
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingTourProps {
  onComplete: () => void;
}

const SWIPE_THRESHOLD = 50;

const getPlatform = (): "android" | "ios" | "desktop" => {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
};

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

/* ───── Step 1: Welcome (role-aware) ───── */
const WelcomeStep = ({ isDispatcher }: { isDispatcher: boolean }) => (
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
      {isDispatcher ? "Добро пожаловать, диспетчер!" : "Добро пожаловать в Gruzli!"}
    </motion.h1>
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 }}
      className="text-sm text-muted-foreground leading-relaxed max-w-sm"
    >
      {isDispatcher
        ? "Gruzli — ваш инструмент для управления заказами. Размещайте заявки, находите надёжных грузчиков, отслеживайте выполнение и контролируйте расходы."
        : "Gruzli — платформа для поиска работы. Находите заказы рядом, откликайтесь мгновенно, общайтесь с диспетчерами напрямую и зарабатывайте больше."}
    </motion.p>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="grid grid-cols-2 gap-3 mt-6 w-full max-w-xs"
    >
      {(isDispatcher
        ? [
            { icon: ClipboardList, label: "Заявки", color: "text-blue-400" },
            { icon: Users, label: "Грузчики", color: "text-yellow-400" },
            { icon: BarChart3, label: "Аналитика", color: "text-green-400" },
            { icon: MessageSquare, label: "Чат", color: "text-purple-400" },
          ]
        : [
            { icon: Briefcase, label: "Заказы", color: "text-blue-400" },
            { icon: Zap, label: "Быстро", color: "text-yellow-400" },
            { icon: Shield, label: "Надёжно", color: "text-green-400" },
            { icon: MessageSquare, label: "Чат", color: "text-purple-400" },
          ]
      ).map((f, i) => (
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

/* ───── Step 2: UI Guide (role-aware) ───── */
const UIGuideStep = ({ isDispatcher }: { isDispatcher: boolean }) => {
  const workerNav = [
    { icon: Home, label: "Главная" },
    { icon: ClipboardList, label: "Заказы" },
    { icon: MessageSquare, label: "Чаты" },
    { icon: FolderOpen, label: "Картотека" },
    { icon: User, label: "Профиль" },
  ];
  const dispatcherNav = [
    { icon: ClipboardList, label: "Заявки" },
    { icon: MessageSquare, label: "Чаты" },
    { icon: FolderOpen, label: "Картотека" },
    { icon: User, label: "Профиль" },
  ];
  const nav = isDispatcher ? dispatcherNav : workerNav;

  const workerTips = [
    { icon: Search, text: "На главной — свежие заказы. Смотрите ставку, адрес и время, откликайтесь одним нажатием" },
    { icon: ClipboardList, text: "В «Заказы» — все ваши отклики и активные заказы. Начинайте и завершайте работу прямо здесь" },
    { icon: Star, text: "После выполнения заказа оставляйте отзыв диспетчеру и следите за своим рейтингом" },
    { icon: DollarSign, text: "В профиле — ваш баланс, заработок за неделю и статистика выполненных заказов" },
  ];
  const dispatcherTips = [
    { icon: Plus, text: "Создавайте заказы через кнопку «+»: укажите адрес, ставку, количество грузчиков и время" },
    { icon: Users, text: "Просматривайте отклики грузчиков — их рейтинг, опыт и навыки. Принимайте лучших" },
    { icon: BarChart3, text: "В кабинете диспетчера — аналитика доходов, расходов и статистика по заказам" },
    { icon: Star, text: "После завершения заказа оставляйте отзывы грузчикам и заполняйте финансы" },
  ];
  const tips = isDispatcher ? dispatcherTips : workerTips;

  return (
    <div className="flex flex-col items-center text-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h2 className="text-xl font-bold text-foreground mb-2">
          {isDispatcher ? "Ваши инструменты" : "Как устроено приложение"}
        </h2>
        <p className="text-xs text-muted-foreground">Внизу экрана — главное меню</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-3 mb-4"
      >
        <div className="flex justify-around">
          {nav.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.12 }}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <item.icon size={16} className="text-primary" />
              </div>
              <span className="text-[9px] font-semibold text-foreground">{item.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="space-y-2 w-full max-w-sm">
        {tips.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.12 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/50"
          >
            <item.icon size={16} className="text-primary shrink-0 mt-0.5" />
            <span className="text-xs text-muted-foreground text-left leading-relaxed">{item.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

/* ───── Step 3: Notifications (informational, no button) ───── */
const NotificationsStep = ({ isDispatcher }: { isDispatcher: boolean }) => (
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
      {isDispatcher
        ? "Уведомления помогут вам мгновенно узнавать об откликах грузчиков, новых сообщениях и завершении заказов."
        : "Уведомления помогут вам мгновенно узнавать о новых заказах рядом, сообщениях от диспетчеров и статусе ваших откликов."}
    </motion.p>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="w-full max-w-xs space-y-3"
    >
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        {[
          { emoji: "🔔", text: isDispatcher ? "Отклики на ваши заказы" : "Новые заказы рядом с вами" },
          { emoji: "💬", text: "Новые сообщения в чатах" },
          { emoji: isDispatcher ? "✅" : "💰", text: isDispatcher ? "Статус выполнения заказов" : "Принятие ваших откликов" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.1 }}
            className="flex items-center gap-3"
          >
            <span className="text-lg">{item.emoji}</span>
            <span className="text-xs text-foreground text-left">{item.text}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="bg-primary/5 border border-primary/20 rounded-2xl p-4"
      >
        <div className="flex items-start gap-2">
          <span className="text-lg">💡</span>
          <p className="text-xs text-muted-foreground text-left leading-relaxed">
            После завершения обучения включите уведомления на <span className="text-foreground font-semibold">главном экране</span> — баннер появится вверху автоматически.
          </p>
        </div>
      </motion.div>
    </motion.div>
  </div>
);

/* ───── Step 4: Add to Home Screen (always shows Android Chrome + iOS Safari) ───── */
const AddToHomeStep = () => {
  const platform = getPlatform();

  const androidSteps = [
    { emoji: "🌐", text: "Откройте Gruzli в браузере Google Chrome" },
    { emoji: "⋮", text: "Нажмите на три точки (⋮) в правом верхнем углу Chrome" },
    { emoji: "📲", text: "В меню выберите «Установить приложение» или «Добавить на главный экран»" },
    { emoji: "✏️", text: "Если нужно — измените название, затем нажмите «Добавить» или «Установить»" },
    { emoji: "🏠", text: "Иконка Gruzli появится на рабочем столе — запускайте как обычное приложение!" },
  ];

  const iosSteps = [
    { emoji: "🧭", text: "Откройте Gruzli в браузере Safari" },
    { emoji: "📤", text: "Нажмите кнопку «Поделиться» (квадрат со стрелкой) внизу экрана" },
    { emoji: "➕", text: "Прокрутите вниз и нажмите «На экран Домой»" },
    { emoji: "🔄", text: "Если есть переключатель «Открыть как веб-приложение» — включите его" },
    { emoji: "✏️", text: "Измените название если нужно и нажмите «Добавить»" },
  ];

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
        className="text-xs text-muted-foreground mb-4 max-w-sm leading-relaxed"
      >
        Приложение будет работать как нативное — своя иконка, быстрый запуск, без адресной строки
      </motion.p>

      {/* Show both platforms, highlight current */}
      <div className="w-full max-w-sm space-y-4">
        {/* Android Chrome */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`flex items-center gap-2 mb-2 ${platform === "android" ? "" : "opacity-60"}`}
          >
            <span className="text-sm">🤖</span>
            <span className="text-xs font-bold text-foreground">Android — Chrome</span>
            {platform === "android" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">Ваше устройство</span>}
          </motion.div>
          <div className="space-y-1.5">
            {androidSteps.map((s, i) => (
              <motion.div
                key={`a${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + i * 0.08 }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border"
              >
                <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-sm shrink-0">{s.emoji}</div>
                <p className="text-[11px] text-foreground text-left leading-relaxed">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* iOS Safari */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className={`flex items-center gap-2 mb-2 ${platform === "ios" ? "" : "opacity-60"}`}
          >
            <span className="text-sm">🍎</span>
            <span className="text-xs font-bold text-foreground">iPhone — Safari</span>
            {platform === "ios" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">Ваше устройство</span>}
          </motion.div>
          <div className="space-y-1.5">
            {iosSteps.map((s, i) => (
              <motion.div
                key={`i${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.95 + i * 0.08 }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border border-border"
              >
                <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-sm shrink-0">{s.emoji}</div>
                <p className="text-[11px] text-foreground text-left leading-relaxed">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───── Step 5: Celebration ───── */
const CelebrationStep = ({ onStart, isDispatcher }: { onStart: () => void; isDispatcher: boolean }) => (
  <div className="flex flex-col items-center text-center px-6">
    <div className="relative w-full h-32 mb-4 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 0, x: Math.random() * 300 - 150, scale: 0, rotate: Math.random() * 360 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, -80 - Math.random() * 60],
            x: (Math.random() - 0.5) * 200,
            scale: [0, 1, 0.8],
            rotate: Math.random() * 720,
          }}
          transition={{ duration: 2 + Math.random(), delay: 0.3 + Math.random() * 0.5, repeat: Infinity, repeatDelay: Math.random() * 2 }}
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
      {isDispatcher
        ? "Всё настроено! Создайте первый заказ, найдите грузчиков и управляйте работой прямо из Gruzli."
        : "Всё настроено! Откройте ленту заказов, откликнитесь на первый заказ и начните зарабатывать."}
    </motion.p>

    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.8, type: "spring" }}
      whileTap={{ scale: 0.95 }}
      onClick={onStart}
      className="w-full max-w-xs py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2"
    >
      {isDispatcher ? "Создать первый заказ" : "Смотреть заказы"}
      <ChevronRight size={18} />
    </motion.button>
  </div>
);

/* ───── Main Onboarding Component ───── */
const TOTAL_STEPS = 5;

const OnboardingTour = ({ onComplete }: OnboardingTourProps) => {
  const { role } = useAuth();
  const isDispatcher = role === "dispatcher";
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) { setDirection(1); setStep((s) => s + 1); }
  }, [step]);

  const goPrev = useCallback(() => {
    if (step > 0) { setDirection(-1); setStep((s) => s - 1); }
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
      case 0: return <WelcomeStep isDispatcher={isDispatcher} />;
      case 1: return <UIGuideStep isDispatcher={isDispatcher} />;
      case 2: return <NotificationsStep isDispatcher={isDispatcher} />;
      case 3: return <AddToHomeStep />;
      case 4: return <CelebrationStep onStart={handleComplete} isDispatcher={isDispatcher} />;
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
      <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
        <ProgressBar current={step} total={TOTAL_STEPS} />
        {!isLastStep && (
          <button onClick={handleSkip} className="text-xs text-muted-foreground ml-4 shrink-0">
            Пропустить
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center overflow-y-auto overflow-x-hidden min-h-0">
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
            className="w-full py-4"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

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
