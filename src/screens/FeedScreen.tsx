import { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { MapPin, Clock, Users, Zap, ChevronRight, Mic, Wallet, ArrowRight, Ban, UserPlus, Train } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const filters = ["Все", "Срочные", "Быстрая минималка"];

const FeedScreen = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("Все");
  const [jobs, setJobs] = useState<Tables<"jobs">[]>([]);
  const [respondedJobs, setRespondedJobs] = useState<Set<string>>(new Set());
  const [skippedJobs, setSkippedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (data) setJobs(data);

    // Fetch user's existing responses
    if (user) {
      const { data: responses } = await supabase
        .from("job_responses")
        .select("job_id")
        .eq("worker_id", user.id);
      if (responses) {
        setRespondedJobs(new Set(responses.map((r) => r.job_id)));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  const filtered = jobs
    .filter((j) => !skippedJobs.has(j.id))
    .filter((j) => {
      if (activeFilter === "Срочные") return j.urgent;
      if (activeFilter === "Быстрая минималка") return j.quick_minimum;
      return true;
    });

  const nearbyCount = jobs.length;
  const maxEarnings = jobs.reduce((sum, j) => sum + j.hourly_rate * (Number(j.duration_hours) || 4), 0);

  const handleRespond = async (jobId: string) => {
    if (!user) return;
    if (respondedJobs.has(jobId)) return;

    const { error } = await supabase.from("job_responses").insert({
      job_id: jobId,
      worker_id: user.id,
      message: "",
    });

    if (error) {
      if (error.code === "23505") {
        toast.info("Вы уже откликнулись");
      } else {
        toast.error("Ошибка отклика");
      }
    } else {
      setRespondedJobs((prev) => new Set(prev).add(jobId));
      toast.success("Отклик отправлен!");
      if (navigator.vibrate) navigator.vibrate(50);

      // Create conversation between worker and dispatcher
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        const { data: conv } = await supabase
          .from("conversations")
          .insert({ job_id: jobId, title: job.title })
          .select()
          .single();
        if (conv) {
          await supabase.from("conversation_participants").insert([
            { conversation_id: conv.id, user_id: user.id },
            { conversation_id: conv.id, user_id: job.dispatcher_id },
          ]);
        }
      }
    }
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
            Сейчас {nearbyCount} заказов
          </h2>
          <p className="text-white/70 text-sm">
            Можно заработать до <span className="text-white font-bold">{maxEarnings.toLocaleString("ru-RU")} ₽</span>
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
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Загрузка заявок...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {jobs.length === 0 ? "Пока нет заявок. Диспетчеры ещё не разместили заказы." : "Нет подходящих заявок"}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((job, i) => (
              <SwipeableJobCard
                key={job.id}
                job={job}
                index={i}
                responded={respondedJobs.has(job.id)}
                onRespond={() => handleRespond(job.id)}
                onSkip={() => setSkippedJobs((prev) => new Set(prev).add(job.id))}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

interface SwipeableJobCardProps {
  job: Tables<"jobs">;
  index: number;
  responded: boolean;
  onRespond: () => void;
  onSkip: () => void;
}

const SwipeableJobCard = ({ job, index, responded, onRespond, onSkip }: SwipeableJobCardProps) => {
  const x = useMotionValue(0);
  const bgLeft = useTransform(x, [-150, 0], [1, 0]);
  const bgRight = useTransform(x, [0, 150], [0, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) onRespond();
    else if (info.offset.x < -100) onSkip();
  };

  const totalPay = job.hourly_rate * (Number(job.duration_hours) || 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.05 }}
      className="relative"
    >
      <motion.div className="absolute inset-0 rounded-2xl flex items-center justify-start pl-6 z-0" style={{ opacity: bgLeft, background: 'hsl(0 72% 51% / 0.15)' }}>
        <Ban size={28} className="text-destructive" />
      </motion.div>
      <motion.div className="absolute inset-0 rounded-2xl flex items-center justify-end pr-6 z-0" style={{ opacity: bgRight, background: 'hsl(145 65% 50% / 0.15)' }}>
        <ArrowRight size={28} className="text-online" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x }}
        onDragEnd={handleDragEnd}
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
              {job.quick_minimum && (
                <span className="px-2 py-0.5 rounded-lg bg-online/20 text-online text-[11px] font-semibold">
                  Быстрая минималка
                </span>
              )}
            </div>
            <h3 className="text-[15px] font-semibold text-foreground leading-tight">{job.title}</h3>
          </div>
        </div>

        {job.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
        )}

        {/* Earnings calculator */}
        <div className="neu-inset rounded-xl px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-primary" />
            <span className="text-xs text-muted-foreground">Ты получишь</span>
            <span className="text-lg font-extrabold text-gradient-primary ml-auto">{totalPay.toLocaleString("ru-RU")} ₽</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{job.hourly_rate} ₽/час × {job.duration_hours || 4}ч</p>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4 flex-wrap">
          {job.address && <span className="flex items-center gap-1"><MapPin size={11} /> {job.address}</span>}
          {job.metro && <span className="flex items-center gap-1"><Train size={11} /> {job.metro}</span>}
          {job.start_time && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {new Date(job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="flex items-center gap-1"><Users size={11} /> {job.workers_needed} чел.</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1" />
          <span className="text-xl font-extrabold text-gradient-primary">{job.hourly_rate} ₽/час</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRespond(); }}
            disabled={responded}
            className={`px-6 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all ${
              responded
                ? "bg-online/20 text-online"
                : "gradient-primary text-primary-foreground"
            }`}
            style={!responded ? {
              boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)',
            } : {}}
          >
            {responded ? "✓ Отклик" : "Беру!"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FeedScreen;
