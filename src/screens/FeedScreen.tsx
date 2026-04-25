import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  MapPin, Clock, Users, Zap, Wallet, ArrowRight, Ban, UserPlus, Train,
  Search, X, Sparkles, Loader2, TrendingUp, Check, ArrowLeft, Hourglass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRespondToJob } from "@/hooks/useRespondToJob";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";
import PushNotificationBanner from "@/components/PushNotificationBanner";
import { MaxChannelBanner } from "@/components/MaxChannelBanner";

type FilterKey = "all" | "urgent" | "quick";
const filters: { key: FilterKey; label: string; icon: typeof Sparkles }[] = [
  { key: "all", label: "Все", icon: Sparkles },
  { key: "urgent", label: "Срочные", icon: Zap },
  { key: "quick", label: "Быстрая минималка", icon: Hourglass },
];

interface FeedScreenProps {
  onOpenChat?: (conversationId: string, title: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenJob?: (job: Tables<"jobs">) => void;
  onRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const FeedScreen = ({ onOpenChat, onOpenProfile, onOpenJob, onRefreshRef }: FeedScreenProps) => {
  const { user } = useAuth();
  const { respondAndOpenChat } = useRespondToJob(onOpenChat);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [jobs, setJobs] = useState<Tables<"jobs">[]>([]);
  const [dispatcherNames, setDispatcherNames] = useState<Record<string, string>>({});
  const [respondedJobs, setRespondedJobs] = useState<Set<string>>(new Set());
  const [skippedJobs, setSkippedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);

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

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResultIds(null);
      return;
    }
    setSearchLoading(true);
    try {
      const jobsData = jobs.map((j) => ({
        id: j.id, title: j.title, description: j.description,
        address: j.address, metro: j.metro, hourly_rate: j.hourly_rate,
        urgent: j.urgent, start_time: j.start_time,
      }));
      const { data, error } = await supabase.functions.invoke("smart-search-jobs", {
        body: { query: searchQuery.trim(), jobs: jobsData },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); }
      else if (data?.job_ids) { setSearchResultIds(data.job_ids); }
    } catch { toast.error("Ошибка умного поиска"); }
    finally { setSearchLoading(false); }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResultIds(null);
  };

  // Counts per filter (for chip badges)
  const counts = useMemo(() => {
    const visible = jobs.filter((j) => !skippedJobs.has(j.id));
    return {
      all: visible.length,
      urgent: visible.filter((j) => j.urgent).length,
      quick: visible.filter((j) => j.quick_minimum).length,
    };
  }, [jobs, skippedJobs]);

  const filtered = jobs
    .filter((j) => !skippedJobs.has(j.id))
    .filter((j) => {
      if (activeFilter === "urgent") return j.urgent;
      if (activeFilter === "quick") return j.quick_minimum;
      return true;
    })
    .filter((j) => {
      if (searchResultIds !== null) return searchResultIds.includes(j.id);
      return true;
    })
    .sort((a, b) => {
      if (searchResultIds !== null) {
        return searchResultIds.indexOf(a.id) - searchResultIds.indexOf(b.id);
      }
      return 0;
    });

  const nearbyCount = jobs.length;
  // Реалистичный средний заработок за день: ~3 заявки в день из доступных,
  // берём средний чек по активным заявкам и умножаем на 3.
  const avgJobPay = jobs.length > 0
    ? jobs.reduce((sum, j) => sum + j.hourly_rate * (Number(j.duration_hours) || 4), 0) / jobs.length
    : 0;
  const avgDailyEarnings = Math.round((avgJobPay * 3) / 50) * 50; // округляем до 50 ₽

  const handleRespond = async (jobId: string) => {
    if (!user) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const success = await respondAndOpenChat(job);
    if (success) {
      setRespondedJobs((prev) => new Set(prev).add(jobId));
    }
  };

  const resetAll = () => {
    setActiveFilter("all");
    clearSearch();
    setSkippedJobs(new Set());
  };

  return (
    <div>
      {/* Header */}
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Заявки</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-online opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-online" />
            </span>
            <p className="text-[11px] text-muted-foreground">
              <span className="text-foreground font-semibold">{nearbyCount}</span> активных сейчас
            </p>
          </div>
        </div>
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-foreground/20 to-online/10 blur-md opacity-60" />
          <img src={gruzliLogo} alt="Gruzli" className="relative h-10 w-10 rounded-xl object-cover ring-1 ring-border" loading="lazy" />
        </div>
      </div>

      {/* Swipe hint chip */}
      <div className="px-5 mt-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/60 border border-border text-[10.5px] text-muted-foreground">
          <ArrowLeft size={10} className="text-destructive" /> Пропустить
          <span className="opacity-30">·</span>
          <ArrowRight size={10} className="text-online" /> Беру
        </div>
      </div>

      <PushNotificationBanner />

      {/* Smart Search */}
      <div className="mx-5 mt-3 mb-1">
        <div className="group relative rounded-2xl bg-gradient-to-br from-foreground/15 via-border to-border p-[1px] transition-all focus-within:from-foreground/40 focus-within:via-foreground/20">
          <div className="flex items-center gap-2 bg-card rounded-2xl px-3 py-2.5">
            {searchLoading ? (
              <Loader2 size={16} className="text-foreground animate-spin shrink-0" />
            ) : (
              <Sparkles size={16} className="text-foreground/80 shrink-0" />
            )}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSmartSearch(); }}
              placeholder="AI-поиск: «переезд завтра утром»..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="shrink-0 rounded-full p-0.5 hover:bg-muted">
                <X size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        {searchResultIds !== null && (
          <div className="mt-1.5 px-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10 text-[10.5px] text-foreground font-medium">
              <Search size={9} /> Найдено: {filtered.length}
            </span>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="mx-5 mt-3 mb-4 grid grid-cols-2 gap-3">
        <StatCard
          icon={MapPin}
          label="Заказов рядом"
          value={nearbyCount.toLocaleString("ru-RU")}
          accent="from-foreground/30 to-foreground/0"
        />
        <StatCard
          icon={Wallet}
          label="Средний доход/день"
          value={`~${avgDailyEarnings.toLocaleString("ru-RU")} ₽`}
          accent="from-online/40 to-online/0"
        />
      </div>

      {/* Filters */}
      <div className="px-5 pb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {filters.map((f) => {
            const Icon = f.icon;
            const isActive = activeFilter === f.key;
            const count = counts[f.key];
            return (
              <motion.button
                key={f.key}
                layout
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? "bg-foreground text-background shadow-[0_4px_18px_-4px_hsl(var(--foreground)/0.35)]"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
              >
                <Icon size={13} />
                <span>{f.label}</span>
                <span className={`text-[10.5px] font-semibold ${isActive ? "opacity-70" : "opacity-60"}`}>
                  · {count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Job Cards */}
      <div className="px-5 space-y-3 pb-6">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <JobSkeleton key={i} delay={i * 0.06} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasJobs={jobs.length > 0} onReset={resetAll} />
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

// ─── Stat Card ───────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, accent,
}: { icon: typeof MapPin; label: string; value: string; accent: string }) => (
  <div className="relative rounded-2xl bg-gradient-to-br from-border via-border to-transparent p-[1px] overflow-hidden">
    <div className="relative rounded-2xl bg-card px-3.5 py-3 h-full">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 h-8 w-8 rounded-lg bg-surface-3 border border-border flex items-center justify-center">
          <Icon size={14} className="text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] text-muted-foreground leading-tight">{label}</p>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-base font-bold text-foreground mt-0.5 truncate"
          >
            {value}
          </motion.p>
        </div>
      </div>
      <div className={`absolute inset-x-3 bottom-1.5 h-px bg-gradient-to-r ${accent}`} />
    </div>
  </div>
);

// ─── Skeleton ────────────────────────────────────────────
const JobSkeleton = ({ delay = 0 }: { delay?: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay }}
    className="rounded-2xl bg-card border border-border p-4 space-y-3 animate-pulse"
  >
    <div className="flex gap-2">
      <div className="h-4 w-16 rounded-md bg-muted/40" />
      <div className="h-4 w-20 rounded-md bg-muted/30" />
    </div>
    <div className="h-4 w-3/4 rounded-md bg-muted/40" />
    <div className="h-3 w-1/3 rounded-md bg-muted/30" />
    <div className="h-12 w-full rounded-xl bg-muted/20" />
    <div className="flex justify-between items-center pt-2">
      <div className="h-4 w-20 rounded-md bg-muted/30" />
      <div className="h-9 w-24 rounded-xl bg-muted/30" />
    </div>
  </motion.div>
);

// ─── Empty State ─────────────────────────────────────────
const EmptyState = ({ hasJobs, onReset }: { hasJobs: boolean; onReset: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-10 px-6"
  >
    <div className="mx-auto h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
      <Search size={26} className="text-muted-foreground" />
    </div>
    <h3 className="text-[15px] font-semibold text-foreground">
      {hasJobs ? "Нет подходящих заявок" : "Пока нет заявок"}
    </h3>
    <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] mx-auto">
      {hasJobs
        ? "Попробуй изменить фильтры или сбросить поиск"
        : "Диспетчеры ещё не разместили заказы. Загляни позже."}
    </p>
    {hasJobs && (
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-xs font-semibold tap-scale"
      >
        <X size={12} /> Сбросить фильтры
      </button>
    )}
  </motion.div>
);

// ─── Swipeable Job Card ──────────────────────────────────
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

const getInitials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";

const SwipeableJobCard = ({
  job, index, responded, dispatcherName, onRespond, onSkip, onOpenProfile, onTap,
}: SwipeableJobCardProps) => {
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
  const isBot = (job as any).is_bot;
  const isNew = useMemo(() => {
    const created = new Date(job.created_at).getTime();
    return Date.now() - created < 10 * 60 * 1000;
  }, [job.created_at]);

  const isOfficial = (job as any).is_official;

  // Top accent bar color
  const accentClass = isOfficial
    ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300"
    : job.urgent
    ? "bg-gradient-to-r from-destructive via-destructive/70 to-destructive/0"
    : job.quick_minimum
    ? "bg-gradient-to-r from-online via-online/70 to-online/0"
    : "bg-gradient-to-r from-foreground/30 via-foreground/10 to-transparent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
      transition={{ delay: index < 5 ? index * 0.04 : 0, duration: 0.3 }}
      className="relative"
    >
      {/* Swipe backgrounds */}
      <motion.div
        className="absolute inset-0 rounded-2xl flex items-center justify-start pl-6 z-0"
        style={{ opacity: bgLeft, background: 'hsl(0 72% 51% / 0.12)' }}
      >
        <div className="flex items-center gap-2 text-destructive">
          <Ban size={20} />
          <span className="text-xs font-semibold">Пропустить</span>
        </div>
      </motion.div>
      <motion.div
        className="absolute inset-0 rounded-2xl flex items-center justify-end pr-6 z-0"
        style={{ opacity: bgRight, background: 'hsl(145 65% 50% / 0.12)' }}
      >
        <div className="flex items-center gap-2 text-online">
          <span className="text-xs font-semibold">Беру</span>
          <ArrowRight size={20} />
        </div>
      </motion.div>

      <motion.div
        drag={isBot ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{
          x,
          ...(isOfficial ? {
            background: "linear-gradient(135deg, hsl(45 90% 55% / 0.12), hsl(38 85% 50% / 0.06) 40%, hsl(var(--card)) 100%)",
            boxShadow: "0 0 0 1px hsl(45 90% 55% / 0.25), 0 8px 24px -8px hsl(45 90% 55% / 0.25)",
          } : {}),
        }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        whileTap={{ scale: 0.985 }}
        whileHover={{ y: -1 }}
        className={`relative z-10 rounded-2xl border p-4 cursor-pointer transition-colors overflow-hidden ${
          isOfficial
            ? "border-yellow-400/40"
            : isBot
            ? "border-destructive/25 opacity-70 bg-card"
            : "border-border hover:border-foreground/20 bg-card"
        }`}
      >
        {/* Top accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${accentClass}`} />

        {/* "Место занято" — corner badge, не перекрывает контент */}
        {isBot && (
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/15 border border-destructive/30">
            <Ban size={10} className="text-destructive" />
            <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Занято</span>
          </div>
        )}

        {/* Tags */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {isOfficial && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-yellow-400/25 to-amber-400/15 text-yellow-600 dark:text-yellow-400 text-[10.5px] font-bold border border-yellow-400/40">
              <img src={gruzliLogo} alt="Gruzli" className="w-3 h-3 rounded-sm object-cover" />
              <span>Официально от Gruzli</span>
              <Check size={9} strokeWidth={3} className="text-yellow-500" />
            </span>
          )}
          {job.urgent && (
            <span className="relative flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive text-[10.5px] font-semibold border border-destructive/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
              </span>
              Срочно
            </span>
          )}
          {job.quick_minimum && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-online/10 text-online text-[10.5px] font-semibold border border-online/20">
              <Hourglass size={9} /> Быстрая минималка
            </span>
          )}
          {isNew && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-foreground/10 text-foreground text-[10.5px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-online" /> Новое
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-semibold text-foreground leading-snug pr-2">{job.title}</h3>

        {/* Dispatcher */}
        <button
          onClick={(e) => { e.stopPropagation(); if (!isOfficial) onOpenProfile?.(); }}
          className="flex items-center gap-2 mt-2 tap-scale"
        >
          {isOfficial ? (
            <>
              <div className="h-5 w-5 rounded-full bg-yellow-400 border border-yellow-500 flex items-center justify-center overflow-hidden">
                <img src={gruzliLogo} alt="Gruzli" className="w-full h-full object-cover" />
              </div>
              <span className="text-[11.5px] font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                Gruzli
                <Check size={10} strokeWidth={3} className="text-yellow-500" />
              </span>
            </>
          ) : (
            <>
              <div className="h-5 w-5 rounded-full bg-surface-3 border border-border flex items-center justify-center text-[9px] font-bold text-foreground/80">
                {getInitials(dispatcherName)}
              </div>
              <span className="text-[11.5px] text-muted-foreground">{dispatcherName}</span>
            </>
          )}
        </button>

        {job.description && (
          <p className="text-[13px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{job.description}</p>
        )}

        {/* Pay block */}
        <div className="mt-3 relative rounded-xl bg-gradient-to-br from-surface-3 to-surface-2 border border-border overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-online/60" />
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <TrendingUp size={12} className="text-online shrink-0" />
                <span className="text-[11px] text-muted-foreground">Ты получишь</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-bold text-foreground tracking-tight">
                  {totalPay.toLocaleString("ru-RU")}
                </span>
                <span className="text-xs text-muted-foreground font-semibold">₽</span>
              </div>
            </div>
            <p className="text-[10.5px] text-muted-foreground mt-0.5">
              {job.hourly_rate} ₽/час × {job.duration_hours || 4}ч
            </p>
          </div>
        </div>

        {/* Meta info chips */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {job.address && (
            <MetaChip icon={MapPin} text={job.address} />
          )}
          {job.metro && (
            <MetaChip icon={Train} text={job.metro} />
          )}
          {job.start_time && (
            <MetaChip
              icon={Clock}
              text={new Date(job.start_time).toLocaleString("ru-RU", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            />
          )}
          <MetaChip icon={Users} text={`${job.workers_needed} чел.`} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Ставка</span>
            <span className="text-base font-bold text-foreground leading-tight">{job.hourly_rate} ₽<span className="text-xs text-muted-foreground font-medium">/час</span></span>
          </div>
          {isBot ? (
            <span className="px-4 py-2.5 rounded-xl text-[13px] font-medium bg-muted text-muted-foreground">
              Не успели
            </span>
          ) : responded ? (
            <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-online/15 text-online border border-online/20">
              <span className="h-4 w-4 rounded-full bg-online/20 flex items-center justify-center">
                <Check size={10} className="text-online" strokeWidth={3} />
              </span>
              Отклик
            </span>
          ) : (
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={(e) => { e.stopPropagation(); onRespond(); }}
              className="btn-shimmer flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-gradient-to-r from-foreground to-foreground/85 text-background shadow-[0_4px_14px_-4px_hsl(var(--foreground)/0.4)] hover:shadow-[0_6px_18px_-4px_hsl(var(--foreground)/0.5)] transition-shadow"
            >
              Беру!
              <ArrowRight size={13} />
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Meta Chip ───────────────────────────────────────────
const MetaChip = ({ icon: Icon, text }: { icon: typeof MapPin; text: string }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-3/60 border border-border text-[10.5px] text-muted-foreground max-w-full">
    <Icon size={10} className="shrink-0" />
    <span className="truncate">{text}</span>
  </span>
);

export default FeedScreen;
