import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { MapPin, Clock, Users, Zap, ChevronRight, Wallet, ArrowRight, Ban, UserPlus, Train } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRespondToJob } from "@/hooks/useRespondToJob";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";
import PushNotificationBanner from "@/components/PushNotificationBanner";

const filters = ["Все", "Срочные", "Быстрая минималка"];

interface FeedScreenProps {
  onOpenChat?: (conversationId: string, title: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenJob?: (job: Tables<"jobs">) => void;
  onRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const FeedScreen = ({ onOpenChat, onOpenProfile, onOpenJob, onRefreshRef }: FeedScreenProps) => {
  const { user } = useAuth();
  const { respondAndOpenChat } = useRespondToJob(onOpenChat);
  const [activeFilter, setActiveFilter] = useState("Все");
  const [jobs, setJobs] = useState<Tables<"jobs">[]>([]);
  const [dispatcherNames, setDispatcherNames] = useState<Record<string, string>>({});
  const [respondedJobs, setRespondedJobs] = useState<Set<string>>(new Set());
  const [skippedJobs, setSkippedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (data) {
      setJobs(data);
      const dispatcherIds = [...new Set(data.map((j) => j.dispatcher_id))];
      if (dispatcherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", dispatcherIds);
        if (profiles) {
          const map: Record<string, string> = {};
          profiles.forEach((p) => { map[p.user_id] = p.full_name; });
          setDispatcherNames(map);
        }
      }
    }

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
    if (onRefreshRef) {
      onRefreshRef.current = fetchJobs;
    }
  }, [onRefreshRef]);

  useEffect(() => {
    fetchJobs();

    const handleNewJob = () => fetchJobs();
    window.addEventListener("navigate-to-feed", handleNewJob);
    
    const channel = supabase
      .channel('feed-job-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs' },
        (payload) => {
          const newJob = payload.new as Tables<"jobs">;
          setJobs((prev) => {
            if (prev.some(j => j.id === newJob.id)) return prev;
            return [newJob, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("navigate-to-feed", handleNewJob);
      supabase.removeChannel(channel);
    };
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
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const success = await respondAndOpenChat(job);
    if (success) {
      setRespondedJobs((prev) => new Set(prev).add(jobId));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Заявки</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Свайп вправо — Беру, влево — Пропустить</p>
        </div>
        <img src={gruzliLogo} alt="Gruzli" className="h-9 w-9 rounded-xl object-cover" loading="lazy" />
      </div>

      <PushNotificationBanner />

      {/* Stats bar */}
      <div className="mx-5 mt-3 mb-4 flex items-center gap-3">
        <div className="flex-1 rounded-xl bg-card border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Заказов рядом</p>
          <p className="text-lg font-bold text-foreground">{nearbyCount}</p>
        </div>
        <div className="flex-1 rounded-xl bg-card border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Можно заработать</p>
          <p className="text-lg font-bold text-foreground">{maxEarnings.toLocaleString("ru-RU")} ₽</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 pb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {filters.map((f) => (
            <motion.button
              key={f}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                activeFilter === f
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Job Cards */}
      <div className="px-5 space-y-3 pb-6">
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
                dispatcherName={dispatcherNames[job.dispatcher_id] || "Диспетчер"}
                onRespond={() => handleRespond(job.id)}
                onSkip={() => setSkippedJobs((prev) => new Set(prev).add(job.id))}
                onOpenProfile={onOpenProfile ? () => onOpenProfile(job.dispatcher_id) : undefined}
                onTap={() => onOpenJob?.(job)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

interface SwipeableJobCardProps {
  job: Tables<"jobs"> & { is_bot?: boolean };
  index: number;
  responded: boolean;
  dispatcherName: string;
  onRespond: () => void;
  onSkip: () => void;
  onOpenProfile?: () => void;
  onTap?: () => void;
}

const SwipeableJobCard = ({ job, index, responded, dispatcherName, onRespond, onSkip, onOpenProfile, onTap }: SwipeableJobCardProps) => {
  const x = useMotionValue(0);
  const bgLeft = useTransform(x, [-150, 0], [1, 0]);
  const bgRight = useTransform(x, [0, 150], [0, 1]);
  const didDrag = useRef(false);

  const handleDragStart = () => { didDrag.current = false; };
  const handleDrag = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 5) didDrag.current = true;
  };
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) onRespond();
    else if (info.offset.x < -100) onSkip();
  };
  const handleTap = () => {
    if (!didDrag.current) onTap?.();
  };

  const totalPay = job.hourly_rate * (Number(job.duration_hours) || 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
      transition={{ delay: index < 5 ? index * 0.04 : 0, duration: 0.3 }}
      className="relative"
    >
      {/* Swipe backgrounds */}
      <motion.div className="absolute inset-0 rounded-2xl flex items-center justify-start pl-6 z-0" style={{ opacity: bgLeft, background: 'hsl(0 72% 51% / 0.1)' }}>
        <Ban size={24} className="text-destructive" />
      </motion.div>
      <motion.div className="absolute inset-0 rounded-2xl flex items-center justify-end pr-6 z-0" style={{ opacity: bgRight, background: 'hsl(145 65% 50% / 0.1)' }}>
        <ArrowRight size={24} className="text-online" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        whileTap={{ scale: 0.985 }}
        className="relative z-10 rounded-2xl bg-card border border-border p-4 cursor-pointer transition-colors"
      >
        {/* Bot overlay */}
        {(job as any).is_bot && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 border border-destructive/20">
            <Ban size={11} className="text-destructive" />
            <span className="text-[11px] font-medium text-destructive">Место занято</span>
          </div>
        )}

        {/* Tags */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {job.urgent && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-[11px] font-semibold">
              <Zap size={10} /> Срочно
            </span>
          )}
          {job.quick_minimum && (
            <span className="px-2 py-0.5 rounded-md bg-online/10 text-online text-[11px] font-semibold">
              Быстрая минималка
            </span>
          )}
        </div>

        {/* Title & dispatcher */}
        <h3 className="text-[15px] font-semibold text-foreground leading-snug">{job.title}</h3>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenProfile?.(); }}
          className="flex items-center gap-1 mt-1 tap-scale"
        >
          <UserPlus size={11} className="text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">{dispatcherName}</span>
        </button>

        {job.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
        )}

        {/* Pay block */}
        <div className="mt-3 rounded-xl bg-surface-1 border border-border px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ты получишь</span>
            </div>
            <span className="text-lg font-bold text-foreground">{totalPay.toLocaleString("ru-RU")} ₽</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{job.hourly_rate} ₽/час × {job.duration_hours || 4}ч</p>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-3 flex-wrap">
          {job.address && <span className="flex items-center gap-1"><MapPin size={11} /> {job.address}</span>}
          {job.metro && <span className="flex items-center gap-1"><Train size={11} /> {job.metro}</span>}
          {job.start_time && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {new Date(job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="flex items-center gap-1"><Users size={11} /> {job.workers_needed} чел.</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <span className="text-lg font-bold text-foreground">{job.hourly_rate} ₽/час</span>
          {(job as any).is_bot ? (
            <span className="px-5 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground">
              Не успели
            </span>
          ) : (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={(e) => { e.stopPropagation(); onRespond(); }}
              disabled={responded}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                responded
                  ? "bg-online/15 text-online"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {responded ? "✓ Отклик" : "Беру!"}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FeedScreen;
