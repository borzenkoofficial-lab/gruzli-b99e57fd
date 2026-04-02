import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { MapPin, Clock, Users, Zap, ChevronRight, Mic, Wallet, ArrowRight, ArrowLeft, Ban, UserPlus } from "lucide-react";
import { mockJobs, type Job } from "@/data/mockData";

const filters = ["Все", "Переезд", "Такелаж", "Погрузка", "Межэтаж", "Срочные", "Без лифта", "В паре"];

interface FeedScreenProps {
  onOpenJob: (job: Job) => void;
}

const FeedScreen = ({ onOpenJob }: FeedScreenProps) => {
  const [activeFilter, setActiveFilter] = useState("Все");
  const [swipedJobs, setSwipedJobs] = useState<Set<string>>(new Set());
  const [takenJobs, setTakenJobs] = useState<Set<string>>(new Set());
  const [recordingJobId, setRecordingJobId] = useState<string | null>(null);

  const nearbyCount = 7;
  const maxEarnings = mockJobs.reduce((sum, j) => sum + j.netPay, 0);

  const filtered = (activeFilter === "Все"
    ? mockJobs
    : activeFilter === "Срочные"
    ? mockJobs.filter((j) => j.urgent)
    : activeFilter === "Погрузка"
    ? mockJobs.filter((j) => j.type === "Погрузка/Разгрузка")
    : activeFilter === "Без лифта"
    ? mockJobs.filter((j) => j.noElevator)
    : activeFilter === "В паре"
    ? mockJobs.filter((j) => j.pairWork)
    : mockJobs.filter((j) => j.type === activeFilter)
  ).filter(j => !swipedJobs.has(j.id));

  const handleTakeJob = (jobId: string) => {
    setTakenJobs(prev => new Set(prev).add(jobId));
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleSwipeLeft = (jobId: string) => {
    setSwipedJobs(prev => new Set(prev).add(jobId));
  };

  const handleSwipeRight = (jobId: string) => {
    handleTakeJob(jobId);
  };

  return (
    <div className="pb-28">
      {/* Hero Banner */}
      <div className="mx-5 mt-14 mb-4 rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, hsl(240 55% 55%), hsl(220 65% 58%), hsl(195 100% 50%))',
        boxShadow: '0 8px 32px hsl(230 60% 58% / 0.4), 6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%)',
      }}>
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} className="text-white/80" />
            <span className="text-white/80 text-xs font-medium">Рядом с вами</span>
          </div>
          <h2 className="text-white text-xl font-bold mb-1">
            Сейчас рядом {nearbyCount} заказов
          </h2>
          <p className="text-white/70 text-sm">
            Сегодня можно заработать до <span className="text-white font-bold">{maxEarnings.toLocaleString("ru-RU")} ₽</span>
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Wallet size={14} className="text-white/80" />
            <span className="text-white/90 text-sm font-semibold">На руки — без комиссий</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-2">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Заявки</h1>
        <p className="text-sm text-muted-foreground mt-1">Свайп вправо = Беру, влево = Пропустить</p>
      </div>

      {/* Filters */}
      <div className="px-5 pb-5 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeFilter === f
                  ? "gradient-primary text-primary-foreground"
                  : "neu-raised-sm text-muted-foreground active:neu-inset"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards */}
      <div className="px-5 space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((job, i) => (
            <SwipeableJobCard
              key={job.id}
              job={job}
              index={i}
              taken={takenJobs.has(job.id)}
              recording={recordingJobId === job.id}
              onOpen={() => onOpenJob(job)}
              onTake={() => handleTakeJob(job.id)}
              onSwipeLeft={() => handleSwipeLeft(job.id)}
              onSwipeRight={() => handleSwipeRight(job.id)}
              onRecord={() => setRecordingJobId(recordingJobId === job.id ? null : job.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface SwipeableJobCardProps {
  job: Job;
  index: number;
  taken: boolean;
  recording: boolean;
  onOpen: () => void;
  onTake: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onRecord: () => void;
}

const SwipeableJobCard = ({ job, index, taken, recording, onOpen, onTake, onSwipeLeft, onSwipeRight, onRecord }: SwipeableJobCardProps) => {
  const x = useMotionValue(0);
  const bgLeft = useTransform(x, [-150, 0], [1, 0]);
  const bgRight = useTransform(x, [0, 150], [0, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      onSwipeRight();
    } else if (info.offset.x < -100) {
      onSwipeLeft();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.05 }}
      className="relative"
    >
      {/* Swipe indicators */}
      <motion.div
        className="absolute inset-0 rounded-2xl flex items-center justify-start pl-6 z-0"
        style={{ opacity: bgLeft, background: 'hsl(0 72% 51% / 0.15)' }}
      >
        <Ban size={28} className="text-destructive" />
      </motion.div>
      <motion.div
        className="absolute inset-0 rounded-2xl flex items-center justify-end pr-6 z-0"
        style={{ opacity: bgRight, background: 'hsl(145 65% 50% / 0.15)' }}
      >
        <ArrowRight size={28} className="text-online" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={onOpen}
        className="neu-card rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform relative z-10"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {job.urgent && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-destructive/20 text-destructive text-[11px] font-semibold">
                  <Zap size={10} /> Срочно
                </span>
              )}
              <span className="text-[11px] text-muted-foreground neu-raised-sm px-2 py-0.5 rounded-lg">
                {job.type}
              </span>
              {job.noElevator && (
                <span className="text-[11px] text-muted-foreground neu-raised-sm px-2 py-0.5 rounded-lg">🚫 Без лифта</span>
              )}
              {job.pairWork && (
                <span className="text-[11px] text-muted-foreground neu-raised-sm px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <UserPlus size={10} /> В паре
                </span>
              )}
            </div>
            <h3 className="text-[15px] font-semibold text-foreground leading-tight">{job.title}</h3>
          </div>
          <div className="w-8 h-8 rounded-xl neu-raised-sm flex items-center justify-center ml-2 flex-shrink-0">
            <ChevronRight size={14} className="text-muted-foreground" />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>

        {/* Earnings calculator */}
        <div className="neu-inset rounded-xl px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-primary" />
            <span className="text-xs text-muted-foreground">Ты получишь</span>
            <span className="text-lg font-extrabold text-gradient-primary ml-auto">{job.netPay.toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><MapPin size={11} /> {job.distance}</span>
          <span className="flex items-center gap-1"><Clock size={11} /> {job.date}</span>
          <span className="flex items-center gap-1"><Users size={11} /> {job.workersNeeded} чел.</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice response button */}
          <button
            onClick={(e) => { e.stopPropagation(); onRecord(); }}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              recording ? "gradient-primary animate-pulse" : "neu-raised"
            }`}
          >
            <Mic size={16} className={recording ? "text-primary-foreground" : "text-muted-foreground"} />
          </button>

          <div className="flex-1" />

          <span className="text-xl font-extrabold text-gradient-primary">{job.price.toLocaleString("ru-RU")} ₽</span>

          <button
            onClick={(e) => { e.stopPropagation(); onTake(); }}
            disabled={taken}
            className={`px-6 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all ${
              taken
                ? "bg-online/20 text-online"
                : "gradient-primary text-primary-foreground"
            }`}
            style={!taken ? {
              boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)',
            } : {}}
          >
            {taken ? "✓ Взято" : "Беру!"}
          </button>
        </div>

        {job.responses > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2.5">
            👥 {job.responses} откликов
          </p>
        )}

        {recording && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-3 neu-inset rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs text-muted-foreground">Запись... 0:03</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRecord(); }}
              className="ml-auto px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold"
            >
              Отправить
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default FeedScreen;
