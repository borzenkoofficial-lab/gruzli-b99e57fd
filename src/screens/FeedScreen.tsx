import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  MapPin, Clock, Users, Wallet, ArrowRight, Ban,
  Search, X, Sparkles, Loader2, TrendingUp, Check, ArrowLeft, Hourglass, SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRespondToJob } from "@/hooks/useRespondToJob";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";
import EnablePushButton from "@/components/EnablePushButton";
import { MaxChannelBanner } from "@/components/MaxChannelBanner";
import CategorySubscriptionModal from "@/components/CategorySubscriptionModal";
import {
  getCategory,
  classifyJob,
  loadSubscribedCategories,
  type CategoryKey,
} from "@/lib/jobCategories";

interface FeedScreenProps {
  onOpenChat?: (conversationId: string, title: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenJob?: (job: Tables<"jobs">) => void;
  onRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const DEMO_JOBS: Tables<"jobs">[] = [
  {
    id: "demo-job-1", title: "Переезд квартиры · Сокольники", description: "Нужно 2 грузчика: мебель, коробки и техника. Лифт есть.",
    address: "Москва, ул. Стромынка, 18", metro: "Сокольники", hourly_rate: 900, duration_hours: 5,
    workers_needed: 2, urgent: true, quick_minimum: false, is_bot: false, is_official: true,
    dispatcher_id: "demo-dispatcher-1", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T17:30:00Z", updated_at: "2026-09-29T17:30:00Z",
  },
  {
    id: "demo-job-2", title: "Разгрузка фуры · Химки", description: "Разгрузить бытовую технику на складе. Работа без ночёвки.",
    address: "Химки, Ленинградское шоссе, 23", metro: "Ховрино", hourly_rate: 750, duration_hours: 6,
    workers_needed: 4, urgent: false, quick_minimum: true, is_bot: false, is_official: false,
    dispatcher_id: "demo-dispatcher-2", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T16:45:00Z", updated_at: "2026-09-29T16:45:00Z",
  },
  {
    id: "demo-job-3", title: "Демонтаж перегородок · Москва-Сити", description: "Ручной демонтаж гипсокартона, вынос и сортировка материалов.",
    address: "Москва, Пресненская наб., 8", metro: "Деловой центр", hourly_rate: 1000, duration_hours: 7,
    workers_needed: 3, urgent: false, quick_minimum: false, is_bot: false, is_official: true,
    dispatcher_id: "demo-dispatcher-3", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T15:20:00Z", updated_at: "2026-09-29T15:20:00Z",
  },
  {
    id: "demo-job-4", title: "Подъём стройматериалов · Арбат", description: "Поднять материалы на 5 этаж. Лифт для грузов отсутствует.",
    address: "Москва, ул. Арбат, 41", metro: "Арбатская", hourly_rate: 850, duration_hours: 4,
    workers_needed: 2, urgent: false, quick_minimum: false, is_bot: false, is_official: false,
    dispatcher_id: "demo-dispatcher-4", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T14:10:00Z", updated_at: "2026-09-29T14:10:00Z",
  },
  {
    id: "demo-job-5", title: "Погрузка мебели · Одинцово", description: "Погрузить мебель в газель, аккуратно упаковать стекло и крупные предметы.",
    address: "Одинцово, Можайское шоссе, 112", metro: "Одинцово", hourly_rate: 800, duration_hours: 5,
    workers_needed: 3, urgent: false, quick_minimum: true, is_bot: false, is_official: false,
    dispatcher_id: "demo-dispatcher-5", dispatcher_income: null, expense_per_worker: null,
    requires_contract: false, recurring_rule: null, replacement_for_job_id: null, replacement_for_worker_id: null,
    template_id: null, status: "active", created_at: "2026-09-29T13:00:00Z", updated_at: "2026-09-29T13:00:00Z",
  },
];

const FeedScreen = ({ onOpenChat, onOpenProfile, onOpenJob, onRefreshRef }: FeedScreenProps) => {
  const { user } = useAuth();
  const { respondAndOpenChat } = useRespondToJob(onOpenChat);
  const [jobs, setJobs] = useState<Tables<"jobs">[]>([]);
  const [dispatcherNames, setDispatcherNames] = useState<Record<string, string>>({});
  const [respondedJobs, setRespondedJobs] = useState<Set<string>>(new Set());
  const [skippedJobs, setSkippedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResultIds, setSearchResultIds] = useState<string[] | null>(null);

  // ─── Category subscription ───
  const [subscribed, setSubscribed] = useState<CategoryKey[] | null>(() => loadSubscribedCategories());
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | "all">("all");
  const [subModalOpen, setSubModalOpen] = useState(false);

  useEffect(() => {
    if (subscribed === null) {
      const t = setTimeout(() => setSubModalOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, [subscribed]);

  const jobCategory = useMemo(() => {
    const m = new Map<string, CategoryKey>();
    jobs.forEach((j) => m.set(j.id, classifyJob(j)));
    return m;
  }, [jobs]);


  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const demoMode = localStorage.getItem("gruzli_demo_worker") === "1";
    const feedJobs = data && data.length > 0 ? data : (demoMode ? DEMO_JOBS : []);
    if (feedJobs.length > 0) {
      setJobs(feedJobs);
      const dispatcherIds = [...new Set(feedJobs.map((j) => j.dispatcher_id))];
      if (dispatcherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles_public" as any)
          .select("user_id, full_name")
          .in("user_id", dispatcherIds);
        if (profiles) {
          const map: Record<string, string> = {};
          (profiles as any[]).forEach((p) => { map[p.user_id] = p.full_name; });
          if (demoMode) {
            Object.assign(map, {
              "demo-dispatcher-1": "Алексей",
              "demo-dispatcher-2": "Мария",
              "demo-dispatcher-3": "Gruzli",
              "demo-dispatcher-4": "Илья",
              "demo-dispatcher-5": "Анна",
            });
          }
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
  const filtered = jobs
    .filter((j) => !skippedJobs.has(j.id))
    .filter((j) => {
      // Подписка на категории: если пользователь ещё не выбрал — показываем всё
      if (!subscribed) return true;
      const cat = jobCategory.get(j.id) || "other";
      return subscribed.includes(cat);
    })
    .filter((j) => {
      if (categoryFilter === "all") return true;
      return (jobCategory.get(j.id) || "other") === categoryFilter;
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

  const nearbyCount = filtered.length;
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
    clearSearch();
    setSkippedJobs(new Set());
  };

  return (
    <div className="gruzli-mobile-feed app-scroll">
      {/* Header */}
      <header className="gruzli-feed-hero px-5 safe-top pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="gruzli-feed-eyebrow">GRUZLI / WORK</span>
              <span className="gruzli-feed-live"><i /> LIVE</span>
            </div>
            <h1 className="gruzli-feed-title">Работа<br /><span>рядом.</span></h1>
            <p className="gruzli-feed-subtitle"><b>{nearbyCount}</b> заявок доступны прямо сейчас</p>
          </div>
          <div className="gruzli-feed-mark"><img src={gruzliLogo} alt="Gruzli" loading="lazy" /></div>
        </div>
        <div className="gruzli-feed-earnings">
          <div><span>Средний заказ</span><strong>{avgJobPay ? Math.round(avgJobPay).toLocaleString("ru-RU") : "—"} ₽</strong></div>
          <div className="gruzli-feed-earnings-divider" />
          <div><span>Сегодня можно</span><strong>{avgDailyEarnings ? `~${avgDailyEarnings.toLocaleString("ru-RU")} ₽` : "—"}</strong></div>
          <div className="gruzli-feed-earnings-arrow">↗</div>
        </div>
      </header>

      {/* Swipe hint chip */}
      <div className="px-5 mt-1"><div className="gruzli-feed-swipe-note"><ArrowLeft size={11} /> свайп — пропустить <span /> <ArrowRight size={11} /> свайп — взять</div></div>

      <EnablePushButton />

      <MaxChannelBanner />

      {/* Smart Search */}
      <div className="gruzli-feed-search mx-5 mt-3 mb-2">
        <div className="group relative">
          <div className="flex items-center gap-2 rounded-[17px] border border-border bg-card px-3 shadow-sm focus-within:ring-2 focus-within:ring-yellow-400/20">
            {searchLoading ? (
              <Loader2 size={17} className="text-muted-foreground animate-spin shrink-0" />
            ) : (
              <Search size={17} className="text-muted-foreground shrink-0" />
            )}
            <input
              aria-label="Поиск заявок"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSmartSearch(); }}
              placeholder="Найти заявку: переезд, Москва..."
              className="gruzli-feed-search-input flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            {searchQuery ? (
              <button
                aria-label="Очистить поиск"
                onClick={clearSearch}
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center hover:bg-muted active:scale-95"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            ) : null}
            <button
              aria-label="Найти"
              onClick={handleSmartSearch}
              disabled={searchLoading || !searchQuery.trim()}
              className="gruzli-feed-search-action h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-foreground text-background disabled:opacity-30 active:scale-95 transition-transform"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
        {searchResultIds !== null && (
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <Sparkles size={11} className="text-yellow-600" /> Найдено: <b className="text-foreground">{filtered.length}</b>
            </span>
            <button onClick={clearSearch} className="text-[11px] font-semibold text-foreground">Сбросить</button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-5 mt-3 mb-4 grid grid-cols-2 gap-3">
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

      {/* Work preferences — categories are configured from one control. */}
      <section className="gruzli-mobile-section !px-5 !pt-2 !pb-2">
        <div className="gruzli-mobile-section-title !mb-0">
          <h2>Заявки</h2>
          <button
            onClick={() => setSubModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[11.5px] font-semibold text-foreground/80 shadow-sm hover:text-foreground transition-colors tap-scale"
          >
            <SlidersHorizontal size={13} />
            Настроить
          </button>
        </div>
      </section>

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

      <CategorySubscriptionModal
        open={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        onSaved={(cats) => setSubscribed(cats)}
        firstRun={subscribed === null}
      />
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
        ? "Измените настройки категорий или сбросьте поиск"
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
        className={`gruzli-job-card relative z-10 rounded-2xl border p-4 cursor-pointer transition-colors overflow-hidden ${
          isOfficial
            ? "border-yellow-400/40"
            : isBot
            ? "border-destructive/25 opacity-70 bg-card"
            : "border-border hover:border-foreground/20 bg-card"
        }`}
      >
        {/* Editorial index + accent */}
        <div className="gruzli-order-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
        <div className={`gruzli-order-accent ${accentClass}`} />

        {/* "Место занято" — corner badge, не перекрывает контент */}
        {isBot && (
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/15 border border-destructive/30">
            <Ban size={10} className="text-destructive" />
            <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Занято</span>
          </div>
        )}

        {/* Editorial meta row */}
        <div className="gruzli-order-meta-top flex items-center justify-between gap-3 mb-3">
          <span className="gruzli-order-kicker">ЗАЯВКА / {String(index + 1).padStart(2, "0")}</span>
          <span className="gruzli-order-open">ОТКРЫТЬ ↗</span>
        </div>

        {/* Tags */}
        <div className="gruzli-order-tags flex items-center gap-1.5 mb-2 flex-wrap">
          {(() => {
            const cat = getCategory(classifyJob(job));
            return (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border"
                style={{
                  background: cat.tint,
                  borderColor: cat.ring,
                  color: "hsl(var(--foreground))",
                }}
              >
                <span className="text-[11px] leading-none">{cat.emoji}</span>
                {cat.short}
              </span>
            );
          })()}
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
        <div className="gruzli-order-heading flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-bold text-foreground leading-[1.14] tracking-[-0.025em] pr-1">{job.title}</h3>
          <div className="shrink-0 text-right">
            <div className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground">{job.hourly_rate.toLocaleString("ru-RU")} ₽</div>
            <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">в час</div>
          </div>
        </div>

        {/* Mockup scene: location + time + team become one visual composition */}
        <div className="gruzli-order-scene" aria-label="Ключевые параметры заявки">
          <div className="gruzli-order-scene-main">
            <div className="gruzli-order-route">
              <span className="gruzli-order-route-dot" />
              <div>
                <span className="gruzli-order-scene-label">ЛОКАЦИЯ</span>
                <strong>{job.metro || job.address || "Москва"}</strong>
              </div>
            </div>
            <div className="gruzli-order-time">
              <span className="gruzli-order-scene-label">КОГДА</span>
              <strong>{job.start_time ? new Date(job.start_time).toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "Сегодня"}</strong>
            </div>
          </div>
          <div className="gruzli-order-scene-line" />
          <div className="gruzli-order-scene-bottom">
            <span><Users size={11}/>{job.workers_needed} чел.</span>
            <span><Clock size={11}/>{job.duration_hours || 4} ч</span>
            <button onClick={(e)=>{e.stopPropagation(); if(!isOfficial) onOpenProfile?.();}} className="gruzli-order-dispatcher">
              <span className="gruzli-order-avatar">
                {isOfficial ? <img src={gruzliLogo} alt="Gruzli" /> : getInitials(dispatcherName)}
              </span>
              <span>{isOfficial ? "Gruzli" : dispatcherName}</span>
              {isOfficial && <Check size={10} strokeWidth={3}/>}
            </button>
          </div>
        </div>

        {job.description && (
          <p className="gruzli-order-description">{job.description}</p>
        )}

        {/* Pay block */}
        <div className="gruzli-order-pay mt-4 relative rounded-2xl bg-white/60 border border-white/90 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-online/60" />
          <div className="px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <TrendingUp size={12} className="text-online shrink-0" />
                <span className="text-[11px] text-muted-foreground">Ты получишь</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[24px] font-extrabold text-foreground tracking-[-0.04em]">
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

        {/* Compact metadata — details already shown in the visual scene above. */}
        <div className="gruzli-order-meta flex items-center gap-1.5 mt-3 flex-wrap">
          <MetaChip icon={Clock} text={`${job.duration_hours || 4} ч работы`} />
          {job.address && job.metro && job.address !== job.metro && (
            <MetaChip icon={MapPin} text={job.address} />
          )}
        </div>

        {/* Footer */}
        <div className="gruzli-order-footer flex items-center justify-between mt-4 pt-3 border-t border-border/70">
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
              className="btn-shimmer flex min-h-[44px] items-center justify-center gap-2 px-5 rounded-[14px] text-[13px] font-bold bg-foreground text-background shadow-[0_8px_20px_-6px_hsl(var(--foreground)/0.42)] hover:shadow-[0_10px_24px_-6px_hsl(var(--foreground)/0.5)] transition-all"
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

