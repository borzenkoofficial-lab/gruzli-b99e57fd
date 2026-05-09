import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MessageCircle, Star, MapPin, Clock, Navigation,
  AlertTriangle, CheckCircle2, Crown, Users, Briefcase, User,
  ChevronDown, ChevronUp, Phone, Square, Timer, Wallet,
  TrendingUp, TrendingDown, BarChart3, DollarSign, FileText,
  Calendar, Award, Zap, Target, Activity, Sparkles, Loader2,
  Download, Trophy, Eye, Pencil, Trash2, Plus, Minus, Lock, Unlock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import JobTemplatesModal from "@/components/dispatcher/JobTemplatesModal";
import DispatcherContractsModal from "@/components/dispatcher/DispatcherContractsModal";
import TopWorkersModal from "@/components/dispatcher/TopWorkersModal";
import GoalsModal from "@/components/dispatcher/GoalsModal";
import SOSReplacementModal from "@/components/dispatcher/SOSReplacementModal";
import EditJobModal from "@/components/EditJobModal";
import EnablePushButton from "@/components/EnablePushButton";

interface DispatcherCabinetScreenProps {
  onBack: () => void;
  onChatWithWorker: (workerId: string, workerName: string) => void;
  onViewProfile?: (userId: string) => void;
  onOpenCommunity?: () => void;
  onViewResponses?: (job: Tables<"jobs">) => void;
  onRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onCreateJob?: () => void;
  embedded?: boolean;
}

type MyJobsCategory = "open" | "in_progress" | "completed";

interface WorkerInfo {
  responseId: string;
  workerId: string;
  workerStatus: string | null;
  profile: Tables<"profiles"> | null;
  workStartedAt: string | null;
  hoursWorked: number | null;
  earned: number | null;
  dispatcherReviewRating: number | null;
  dispatcherReviewText: string | null;
}

interface ActiveJob {
  job: Tables<"jobs"> & { expense_per_worker?: number; dispatcher_income?: number };
  workers: WorkerInfo[];
}

interface CompletedJobStat {
  jobId: string;
  title: string;
  createdAt: string;
  workersCount: number;
  totalExpense: number;
  dispatcherIncome: number;
}

type CabinetTab = "active" | "stats" | "history";

const WORKER_STATUS_MAP: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  confirmed: { label: "Подтвердил", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  ready: { label: "Готов", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  en_route: { label: "Выехал", icon: Navigation, color: "text-blue-500", bg: "bg-blue-500/10" },
  late: { label: "Опаздывает", icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  arrived: { label: "На месте", icon: MapPin, color: "text-primary", bg: "bg-primary/10" },
  finishing: { label: "Завершает", icon: Timer, color: "text-orange-500", bg: "bg-orange-500/10" },
  completed: { label: "Завершил", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
};

const DispatcherCabinetScreen = ({ onBack, onChatWithWorker, onViewProfile, onOpenCommunity, onViewResponses, onRefreshRef, onCreateJob, embedded }: DispatcherCabinetScreenProps) => {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [completedStats, setCompletedStats] = useState<CompletedJobStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [finishingJobs, setFinishingJobs] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState<CabinetTab>("active");
  const [reviewModal, setReviewModal] = useState<{ responseId: string; workerName: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [expenseModal, setExpenseModal] = useState<{ jobId: string; title: string; workersCount: number } | null>(null);
  const [expensePerWorker, setExpensePerWorker] = useState("");
  const [dispatcherIncome, setDispatcherIncome] = useState("");
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTopWorkers, setShowTopWorkers] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showContracts, setShowContracts] = useState(false);
  const [sosModal, setSosModal] = useState<{ job: any; workerId: string; workerName: string } | null>(null);

  // My jobs (full list of dispatcher's jobs — merged from former DispatcherFeedScreen)
  const [myJobs, setMyJobs] = useState<(Tables<"jobs"> & { response_count: number })[]>([]);
  const [editingJob, setEditingJob] = useState<Tables<"jobs"> | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [myCategory, setMyCategory] = useState<MyJobsCategory>("open");

  const fetchMyJobs = async () => {
    if (!user) return;
    const { data: jobsData } = await supabase
      .from("jobs")
      .select("*")
      .eq("dispatcher_id", user.id)
      .order("created_at", { ascending: false });

    if (jobsData && jobsData.length > 0) {
      const jobIds = jobsData.map(j => j.id);
      const { data: responses } = await supabase
        .from("job_responses")
        .select("job_id")
        .in("job_id", jobIds);
      const countMap: Record<string, number> = {};
      responses?.forEach(r => { countMap[r.job_id] = (countMap[r.job_id] || 0) + 1; });
      setMyJobs(jobsData.map(job => ({ ...job, response_count: countMap[job.id] || 0 })));
    } else {
      setMyJobs([]);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    if (error) {
      toast.error("Ошибка удаления");
    } else {
      setMyJobs((prev) => prev.filter((j) => j.id !== jobId));
      toast.success("Заявка удалена");
    }
  };

  const handleCloseJob = async (jobId: string) => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "closed" })
      .eq("id", jobId);
    if (error) {
      toast.error("Не удалось закрыть заявку");
      return;
    }
    setMyJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "closed" } : j)));
    toast.success("Заявка закрыта · убрана из ленты");
  };

  const handleRepublishJob = async (jobId: string) => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "active" })
      .eq("id", jobId);
    if (error) {
      toast.error("Не удалось опубликовать заявку");
      return;
    }
    setMyJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: "active" } : j)));
    toast.success("Заявка снова опубликована");
  };

  const handleAdjustRate = async (job: Tables<"jobs"> & { response_count: number }, delta: number) => {
    const newRate = Math.max(0, (job.hourly_rate || 0) + delta);
    if (newRate === job.hourly_rate) return;
    setAdjustingId(job.id);
    const { error } = await supabase
      .from("jobs")
      .update({ hourly_rate: newRate, status: "active" })
      .eq("id", job.id);
    setAdjustingId(null);
    if (error) {
      toast.error("Не удалось изменить оплату");
      return;
    }
    setMyJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, hourly_rate: newRate, status: "active" } : j)));
    toast.success(`Оплата ${delta > 0 ? "повышена" : "понижена"} до ${newRate} ₽/час · переопубликована`);
  };

  const handleJobSaved = (updated: Tables<"jobs">) => {
    setMyJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
  };

  const fetchData = async () => {
    if (!user) return;

    // Fetch active/finishing/filled jobs (with accepted workers)
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("dispatcher_id", user.id)
      .in("status", ["active", "finishing", "filled"])
      .order("created_at", { ascending: false });

    if (!jobs || jobs.length === 0) {
      setActiveJobs([]);
    } else {
      const jobIds = jobs.map((j) => j.id);
      const { data: responses } = await supabase
        .from("job_responses")
        .select("*")
        .in("job_id", jobIds)
        .eq("status", "accepted");

      const workerIds = [...new Set((responses || []).map((r) => r.worker_id))];
      const { data: profiles } = workerIds.length > 0
        ? await supabase.from("profiles").select("*").in("user_id", workerIds)
        : { data: [] };

      const profileMap: Record<string, Tables<"profiles">> = {};
      (profiles || []).forEach((p) => { profileMap[p.user_id] = p; });

      const result: ActiveJob[] = jobs
        .map((job) => {
          const jobResponses = (responses || []).filter((r) => r.job_id === job.id);
          const workers: WorkerInfo[] = jobResponses.map((r) => ({
            responseId: r.id,
            workerId: r.worker_id,
            workerStatus: r.worker_status,
            profile: profileMap[r.worker_id] || null,
            workStartedAt: (r as any).work_started_at,
            hoursWorked: (r as any).hours_worked ? Number((r as any).hours_worked) : null,
            earned: (r as any).earned,
            dispatcherReviewRating: (r as any).dispatcher_review_rating,
            dispatcherReviewText: (r as any).dispatcher_review_text,
          }));
          return { job: job as any, workers };
        })
        .filter((aj) => aj.workers.length > 0);

      setActiveJobs(result);
      setExpandedJobs(new Set(result.map((aj) => aj.job.id)));
    }

    // Fetch completed jobs stats
    const { data: completedJobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("dispatcher_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);

    if (completedJobs && completedJobs.length > 0) {
      const cJobIds = completedJobs.map((j) => j.id);
      const { data: cResponses } = await supabase
        .from("job_responses")
        .select("*")
        .in("job_id", cJobIds)
        .eq("status", "accepted");

      const stats: CompletedJobStat[] = completedJobs.map((job) => {
        const jobResps = (cResponses || []).filter((r) => r.job_id === job.id);
        const totalExpense = jobResps.reduce((s, r) => s + ((r as any).earned || 0), 0);
        return {
          jobId: job.id,
          title: job.title,
          createdAt: job.created_at,
          workersCount: jobResps.length,
          totalExpense,
          dispatcherIncome: (job as any).dispatcher_income || 0,
        };
      });
      setCompletedStats(stats);
    }

    setLoading(false);
  };

  const refreshAll = async () => {
    await Promise.all([fetchData(), fetchMyJobs()]);
  };

  useEffect(() => {
    refreshAll();
    if (!user) return;
    const channel = supabase
      .channel("dispatcher-cabinet")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "job_responses" }, () => refreshAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `dispatcher_id=eq.${user.id}` }, () => fetchMyJobs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (onRefreshRef) onRefreshRef.current = refreshAll;
  }, [onRefreshRef]);

  // Stats calculations
  const weeklyStats = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekJobs = completedStats.filter((s) => new Date(s.createdAt) >= weekAgo);
    const totalIncome = weekJobs.reduce((s, j) => s + j.dispatcherIncome, 0);
    const totalExpense = weekJobs.reduce((s, j) => s + j.totalExpense, 0);
    const profit = totalIncome - totalExpense;
    return { jobs: weekJobs.length, income: totalIncome, expense: totalExpense, profit };
  }, [completedStats]);

  const monthlyStats = useMemo(() => {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthJobs = completedStats.filter((s) => new Date(s.createdAt) >= monthAgo);
    const totalIncome = monthJobs.reduce((s, j) => s + j.dispatcherIncome, 0);
    const totalExpense = monthJobs.reduce((s, j) => s + j.totalExpense, 0);
    const profit = totalIncome - totalExpense;
    return { jobs: monthJobs.length, income: totalIncome, expense: totalExpense, profit };
  }, [completedStats]);

  const dailyProfit = useMemo(() => {
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    return completedStats
      .filter((s) => {
        const t = new Date(s.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      })
      .reduce((sum, j) => sum + (j.dispatcherIncome - j.totalExpense), 0);
  }, [completedStats]);

  const exportCSV = () => {
    if (completedStats.length === 0) {
      toast.error("Нет данных для экспорта");
      return;
    }
    const rows = [
      ["Дата", "Заявка", "Грузчиков", "Доход (₽)", "Расход (₽)", "Прибыль (₽)"],
      ...completedStats.map((s) => [
        new Date(s.createdAt).toLocaleDateString("ru-RU"),
        `"${s.title.replace(/"/g, '""')}"`,
        String(s.workersCount),
        String(s.dispatcherIncome),
        String(s.totalExpense),
        String(s.dispatcherIncome - s.totalExpense),
      ]),
    ];
    const csv = "\ufeff" + rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gruzli-otchet-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("📊 Отчёт скачан");
  };

  // Weekly chart data (last 7 days)
  const chartData = useMemo(() => {
    const days: { label: string; income: number; expense: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString("ru-RU", { weekday: "short" });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayJobs = completedStats.filter((s) => {
        const t = new Date(s.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      days.push({
        label: dayStr,
        income: dayJobs.reduce((s, j) => s + j.dispatcherIncome, 0),
        expense: dayJobs.reduce((s, j) => s + j.totalExpense, 0),
      });
    }
    return days;
  }, [completedStats]);

  const maxChartVal = Math.max(1, ...chartData.map((d) => Math.max(d.income, d.expense)));

  const toggleExpand = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const finishJob = async (jobId: string, workers: WorkerInfo[]) => {
    setFinishingJobs((prev) => new Set(prev).add(jobId));
    for (const w of workers) {
      if (w.workerStatus !== "completed") {
        await supabase.from("job_responses").update({ worker_status: "finishing" } as any).eq("id", w.responseId);
      }
    }
    await supabase.from("jobs").update({ status: "finishing" }).eq("id", jobId);
    toast.success("⏹ Заказ завершается. Грузчики получили уведомление.");
    await fetchData();
    setFinishingJobs((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
  };

  const completeJobFully = async (jobId: string) => {
    // Find the active job
    const aj = activeJobs.find((a) => a.job.id === jobId);
    if (!aj) return;

    // Check if all workers are reviewed
    const unreviewed = aj.workers.filter((w) => w.workerStatus === "completed" && !w.dispatcherReviewRating);
    if (unreviewed.length > 0) {
      toast.error("Сначала оставьте отзывы всем грузчикам");
      return;
    }

    // Open expense modal
    setExpenseModal({
      jobId,
      title: aj.job.title,
      workersCount: aj.workers.length,
    });
  };

  const submitExpenseAndComplete = async () => {
    if (!expenseModal) return;
    const expense = parseInt(expensePerWorker) || 0;
    const income = parseInt(dispatcherIncome) || 0;

    await supabase.from("jobs").update({
      status: "completed",
      expense_per_worker: expense,
      dispatcher_income: income,
    } as any).eq("id", expenseModal.jobId);

    toast.success("✅ Заказ завершён!");
    setExpenseModal(null);
    setExpensePerWorker("");
    setDispatcherIncome("");
    await fetchData();
  };

  const submitReview = async () => {
    if (!reviewModal) return;
    await supabase.from("job_responses").update({
      dispatcher_review_rating: reviewRating,
      dispatcher_review_text: reviewText || null,
    } as any).eq("id", reviewModal.responseId);
    toast.success("Отзыв оставлен ✓");
    setReviewModal(null);
    setReviewRating(5);
    setReviewText("");
    await fetchData();
  };

  const getTotalEarned = (workers: WorkerInfo[]) => workers.reduce((sum, w) => sum + (w.earned || 0), 0);
  const allWorkersCompleted = (workers: WorkerInfo[]) => workers.every((w) => w.workerStatus === "completed");

  const tabs: { id: CabinetTab; label: string; icon: typeof Briefcase }[] = [
    { id: "active", label: "Активные", icon: Activity },
    { id: "stats", label: "Аналитика", icon: BarChart3 },
    { id: "history", label: "История", icon: FileText },
  ];

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-background overscroll-contain" style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(var(--bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px) + 16px)" }}>
      {/* Header */}
      <div className="px-4 safe-top pb-2">
        <div className="flex items-center gap-3">
          {!embedded && (
            <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all">
              <ArrowLeft size={18} className="text-foreground" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Кабинет диспетчера</h1>
            <p className="text-[11px] text-muted-foreground">Заявки · заказы · финансы</p>
          </div>
        </div>
      </div>

      <EnablePushButton />

      {/* Quick Stats Banner */}
      <div className="px-4 pb-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(220 65% 45%))" }}
        >
          <div className="px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-primary-foreground/60 text-[10px] font-medium uppercase tracking-wider">Активных заказов</p>
                <p className="text-primary-foreground text-3xl font-extrabold">{activeJobs.length}</p>
              </div>
              <div className="w-px h-10 bg-primary-foreground/20" />
              <div className="flex-1">
                <p className="text-primary-foreground/60 text-[10px] font-medium uppercase tracking-wider">За неделю</p>
                <p className="text-primary-foreground text-lg font-bold">{weeklyStats.profit >= 0 ? "+" : ""}{weeklyStats.profit.toLocaleString("ru-RU")} ₽</p>
                <p className="text-primary-foreground/50 text-[10px]">{weeklyStats.jobs} заказов</p>
              </div>
              <div className="w-px h-10 bg-primary-foreground/20" />
              <div className="flex-1 text-right">
                <p className="text-primary-foreground/60 text-[10px] font-medium uppercase tracking-wider">За месяц</p>
                <p className="text-primary-foreground text-lg font-bold">{monthlyStats.profit >= 0 ? "+" : ""}{monthlyStats.profit.toLocaleString("ru-RU")} ₽</p>
                <p className="text-primary-foreground/50 text-[10px]">{monthlyStats.jobs} заказов</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Community button */}
      <div className="px-4 pb-3">
        <button
          onClick={onOpenCommunity}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border active:bg-surface-1 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
            <Users size={18} className="text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">Сообщество диспетчеров</p>
            <p className="text-[11px] text-muted-foreground">Общий чат · советы · обсуждения</p>
          </div>
          <ChevronDown size={16} className="text-muted-foreground -rotate-90 shrink-0" />
        </button>
      </div>

      {/* Quick actions: Templates, Top workers, Goals, Export */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-5 gap-2">
          {[
            { icon: FileText, label: "Шаблоны", color: "text-blue-400", bg: "bg-blue-500/10", onClick: () => setShowTemplates(true) },
            { icon: Trophy, label: "Топ", color: "text-yellow-500", bg: "bg-yellow-500/10", onClick: () => setShowTopWorkers(true) },
            { icon: Target, label: "Цели", color: "text-primary", bg: "bg-primary/10", onClick: () => setShowGoals(true) },
            { icon: Pencil, label: "Договоры", color: "text-purple-400", bg: "bg-purple-500/10", onClick: () => setShowContracts(true) },
            { icon: Download, label: "Отчёт", color: "text-green-500", bg: "bg-green-500/10", onClick: exportCSV },
          ].map((a, i) => {
            const Ic = a.icon;
            return (
              <motion.button
                key={a.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={a.onClick}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-card border border-border active:bg-surface-1 transition-all"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.bg}`}>
                  <Ic size={16} className={a.color} />
                </div>
                <span className="text-[10px] font-bold text-foreground">{a.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="px-4 pb-3">
        <div className="flex gap-1 bg-card border border-border rounded-2xl p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = currentTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setCurrentTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive ? "bg-foreground text-primary-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      ) : (
        <>
          {/* ACTIVE JOBS TAB */}
          {currentTab === "active" && (() => {
            const inProgressJobIds = new Set(activeJobs.map((aj) => aj.job.id));
            const openJobs = myJobs.filter((j) => (j.status === "active" || j.status === "closed") && !inProgressJobIds.has(j.id));
            const completedMyJobs = myJobs.filter((j) => j.status === "completed");
            const categories: { id: MyJobsCategory; label: string; count: number }[] = [
              { id: "open", label: "Активные", count: openJobs.length },
              { id: "in_progress", label: "В работе", count: activeJobs.length },
              { id: "completed", label: "Завершённые", count: completedMyJobs.length },
            ];
            return (
            <>
              {/* Create job CTA */}
              {onCreateJob && (
                <div className="px-4 pb-3">
                  <button
                    onClick={onCreateJob}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-primary-foreground font-bold text-sm tap-scale"
                  >
                    <Plus size={18} /> Создать заявку
                  </button>
                </div>
              )}

              {/* Category sub-tabs */}
              <div className="px-4 pb-3">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {categories.map((c) => {
                    const isActive = myCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setMyCategory(c.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                          isActive
                            ? "bg-foreground text-primary-foreground border-foreground"
                            : "bg-card text-muted-foreground border-border"
                        }`}
                      >
                        {c.label}
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                          isActive ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-foreground"
                        }`}>{c.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OPEN: postings without accepted workers */}
              {myCategory === "open" && (
                openJobs.length === 0 ? (
                  <div className="mx-4 mb-5 rounded-2xl bg-card border border-border p-6 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-card border border-border flex items-center justify-center">
                      <Briefcase size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Нет активных заявок</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Создайте новую заявку, чтобы получить отклики</p>
                  </div>
                ) : (
                <div className="px-4 pb-5 space-y-3">
                  {openJobs.map((job, i) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 6) * 0.04 }}
                      className="relative rounded-2xl p-4 border border-white/10 backdrop-blur-2xl backdrop-saturate-150 bg-white/5 shadow-[0_8px_32px_-8px_hsl(0_0%_0%/0.4)] overflow-hidden"
                      style={{ backgroundImage: 'linear-gradient(135deg, hsl(0 0% 100% / 0.08), hsl(0 0% 100% / 0.02))' }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {job.urgent && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-destructive/20 text-destructive text-[11px] font-semibold">
                                <Zap size={10} /> Срочно
                              </span>
                            )}
                            {(job as any).quick_minimum && (
                              <span className="px-2 py-0.5 rounded-lg bg-online/20 text-online text-[11px] font-semibold">
                                Быстрая минималка
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                              job.status === "active" ? "bg-online/15 text-online" : "bg-muted text-muted-foreground"
                            }`}>
                              {job.status === "active" ? "Активна" : "Закрыта"}
                            </span>
                          </div>
                          <h3 className="text-[15px] font-semibold text-foreground">{job.title}</h3>
                        </div>
                      </div>

                      {job.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 flex-wrap">
                        {job.address && <span className="flex items-center gap-1"><MapPin size={11} /> {job.address}</span>}
                        {job.start_time && <span className="flex items-center gap-1"><Clock size={11} /> {new Date(job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                        <span className="flex items-center gap-1"><Users size={11} /> {job.workers_needed} чел.</span>
                      </div>

                      <div className="rounded-xl px-3 py-2.5 mb-3 border border-white/10 bg-white/5 backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Оплата</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleAdjustRate(job, -50)}
                              disabled={adjustingId === job.id || (job.hourly_rate || 0) <= 0}
                              className="w-8 h-8 rounded-lg border border-white/10 bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-95 disabled:opacity-40 transition-all"
                              title="Понизить на 50 ₽"
                            >
                              <Minus size={14} className="text-foreground" />
                            </button>
                            <span className="text-lg font-extrabold text-foreground min-w-[80px] text-center">
                              {job.hourly_rate} ₽/ч
                            </span>
                            <button
                              onClick={() => handleAdjustRate(job, 50)}
                              disabled={adjustingId === job.id}
                              className="w-8 h-8 rounded-lg border border-white/10 bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-95 disabled:opacity-40 transition-all"
                              title="Повысить на 50 ₽"
                            >
                              <Plus size={14} className="text-foreground" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
                          Шаг — 50 ₽ · заявка автоматически переопубликуется
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewResponses?.(job)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-semibold tap-scale"
                        >
                          <Eye size={14} /> Отклики ({job.response_count})
                        </button>
                        <button
                          onClick={() => setEditingJob(job)}
                          className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center active:bg-white/10 transition-all"
                          title="Редактировать"
                        >
                          <Pencil size={16} className="text-foreground" />
                        </button>
                        <button
                          onClick={() => job.status === "closed" ? handleRepublishJob(job.id) : handleCloseJob(job.id)}
                          className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center active:bg-white/10 transition-all"
                          title={job.status === "closed" ? "Опубликовать вновь" : "Закрыть заявку (убрать из ленты)"}
                        >
                          {job.status === "closed"
                            ? <Unlock size={16} className="text-online" />
                            : <Lock size={16} className="text-foreground" />}
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center active:bg-white/10 transition-all"
                          title="Удалить"
                        >
                          <Trash2 size={16} className="text-destructive" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                )
              )}

              {/* IN-PROGRESS: orders with accepted workers */}
              {myCategory === "in_progress" && (
                <>
              {activeJobs.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10 px-8">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-card border border-border flex items-center justify-center">
                    <Briefcase size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Нет активных заказов</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">Когда грузчики будут приняты на заявки, они появятся здесь</p>
                </motion.div>
              ) : null}
              {activeJobs.length > 0 && (
              <div className="px-4 space-y-3">
                {activeJobs.map((aj, jobIdx) => {
                  const isExpanded = expandedJobs.has(aj.job.id);
                  const totalEarned = getTotalEarned(aj.workers);
                  const isFinishing = aj.job.status === "finishing";
                  const allDone = allWorkersCompleted(aj.workers);

                  return (
                    <motion.div
                      key={aj.job.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: jobIdx * 0.05 }}
                      className={`bg-card border rounded-2xl overflow-hidden ${isFinishing ? "border-orange-500/30" : "border-border"}`}
                    >
                      <button onClick={() => toggleExpand(aj.job.id)} className="w-full p-4 flex items-start gap-3 text-left">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isFinishing ? "bg-orange-500/10" : allDone ? "bg-green-500/10" : "bg-primary/10"}`}>
                          {isFinishing ? <Timer size={18} className="text-orange-500" /> : allDone ? <CheckCircle2 size={18} className="text-green-500" /> : <Briefcase size={18} className="text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-foreground truncate">{aj.job.title}</h3>
                            {aj.job.status === "filled" && <span className="shrink-0 px-2 py-0.5 rounded-lg bg-primary/15 text-[10px] font-bold text-primary flex items-center gap-1"><Lock size={9} /> Набрано</span>}
                            {isFinishing && <span className="shrink-0 px-2 py-0.5 rounded-lg bg-orange-500/10 text-[10px] font-bold text-orange-500">Завершается</span>}
                            {allDone && !isFinishing && <span className="shrink-0 px-2 py-0.5 rounded-lg bg-green-500/10 text-[10px] font-bold text-green-500">Готово</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            {aj.job.address && <span className="flex items-center gap-1"><MapPin size={10} /> {aj.job.address}</span>}
                            <span className="flex items-center gap-1"><Users size={10} /> {aj.workers.length} чел.</span>
                            {totalEarned > 0 && <span className="flex items-center gap-1 text-green-500"><Wallet size={10} /> {totalEarned.toLocaleString("ru-RU")} ₽</span>}
                          </div>
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown size={18} className="text-muted-foreground mt-1 shrink-0" />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                            <div className="px-4 pb-4 space-y-2">
                              {aj.workers.map((w) => {
                                const ws = w.workerStatus ? WORKER_STATUS_MAP[w.workerStatus] : null;
                                const WsIcon = ws?.icon;
                                const initials = (w.profile?.full_name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2);
                                const needsReview = w.workerStatus === "completed" && !w.dispatcherReviewRating;

                                return (
                                  <motion.div
                                    key={w.responseId}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-surface-1 border border-border rounded-xl p-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => onViewProfile?.(w.workerId)} className="shrink-0">
                                        <div className="relative">
                                          {w.profile?.is_premium && <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 opacity-80" />}
                                          {w.profile?.avatar_url ? (
                                            <img src={w.profile.avatar_url} alt="" className="relative w-10 h-10 rounded-full object-cover" />
                                          ) : (
                                            <div className="relative w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-sm font-bold text-primary-foreground">{initials}</div>
                                          )}
                                        </div>
                                      </button>

                                      <button onClick={() => onViewProfile?.(w.workerId)} className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-sm font-semibold text-foreground truncate">{w.profile?.full_name || "Грузчик"}</span>
                                          {w.profile?.is_premium && <Crown size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <Star size={10} className="text-primary fill-primary" />
                                          <span className="text-[11px] text-muted-foreground">{w.profile?.rating || "5.0"} · {w.profile?.completed_orders || 0} заказов</span>
                                        </div>
                                      </button>

                                      <div className="shrink-0">
                                        {ws && WsIcon ? (
                                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ${ws.bg}`}>
                                            <WsIcon size={13} className={ws.color} />
                                            <span className={`text-[11px] font-bold ${ws.color}`}>{ws.label}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted">
                                            <Clock size={13} className="text-muted-foreground" />
                                            <span className="text-[11px] font-bold text-muted-foreground">Ожидает</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {w.workerStatus === "completed" && w.earned != null && (
                                      <div className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded-lg bg-green-500/10 text-[11px]">
                                        <span className="text-green-500 font-bold flex items-center gap-1"><Wallet size={10} /> {w.earned.toLocaleString("ru-RU")} ₽</span>
                                        {w.hoursWorked != null && <span className="text-green-500/70 flex items-center gap-1"><Timer size={10} /> {w.hoursWorked}ч</span>}
                                      </div>
                                    )}

                                    {/* Review badge or button */}
                                    {w.workerStatus === "completed" && (
                                      w.dispatcherReviewRating ? (
                                        <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/10 text-[11px]">
                                          <Award size={10} className="text-primary" />
                                          <span className="text-primary font-semibold">Отзыв: {"⭐".repeat(w.dispatcherReviewRating)}</span>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setReviewModal({ responseId: w.responseId, workerName: w.profile?.full_name || "Грузчик" })}
                                          className="mt-2 w-full py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold active:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
                                        >
                                          <Star size={12} /> Оставить отзыв
                                        </button>
                                      )
                                    )}

                                    <div className="flex gap-2 mt-2.5">
                                      <button onClick={() => onChatWithWorker(w.workerId, w.profile?.full_name || "Грузчик")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground active:bg-surface-1 transition-all">
                                        <MessageCircle size={13} className="text-primary" /> Написать
                                      </button>
                                      {w.profile?.phone && (
                                        <a href={`tel:${w.profile.phone}`} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground active:bg-surface-1 transition-all">
                                          <Phone size={13} className="text-green-500" />
                                        </a>
                                      )}
                                      {w.workerStatus !== "completed" && (
                                        <button
                                          onClick={() => setSosModal({ job: aj.job, workerId: w.workerId, workerName: w.profile?.full_name || "Грузчик" })}
                                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30 text-xs font-bold text-destructive active:scale-[0.98] transition-all"
                                          title="Срочная замена"
                                        >
                                          <AlertTriangle size={13} /> SOS
                                        </button>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}

                              {/* Finish / Complete buttons */}
                              {!isFinishing && !allDone && (
                                <button onClick={() => finishJob(aj.job.id, aj.workers)} disabled={finishingJobs.has(aj.job.id)} className="w-full mt-2 py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50">
                                  ⏹ Завершить заказ
                                </button>
                              )}

                              {allDone && (
                                <div className="space-y-2 mt-1">
                                  <div className="text-center py-2 bg-green-500/5 rounded-xl">
                                    <p className="text-xs font-bold text-green-500">✅ Все грузчики завершили работу</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Итого расход: {getTotalEarned(aj.workers).toLocaleString("ru-RU")} ₽</p>
                                  </div>
                                  <button
                                    onClick={() => completeJobFully(aj.job.id)}
                                    className="w-full py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-bold active:scale-[0.98] transition-all"
                                  >
                                    📊 Закрыть заказ и заполнить расход
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
              )}
                </>
              )}

              {/* COMPLETED: my completed jobs */}
              {myCategory === "completed" && (
                completedMyJobs.length === 0 ? (
                  <div className="mx-4 mb-5 rounded-2xl bg-card border border-border p-6 text-center">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-card border border-border flex items-center justify-center">
                      <CheckCircle2 size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Завершённых заявок ещё нет</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Закрытые заказы появятся здесь</p>
                  </div>
                ) : (
                  <div className="px-4 pb-5 space-y-3">
                    {completedMyJobs.map((job, i) => (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 6) * 0.04 }}
                        className="bg-card border border-border rounded-2xl p-4"
                      >
                        <div className="flex items-start justify-between mb-2 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-lg bg-green-500/15 text-green-500 text-[11px] font-semibold">Завершена</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(job.created_at).toLocaleDateString("ru-RU")}</span>
                            </div>
                            <h3 className="text-[14px] font-semibold text-foreground truncate">{job.title}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          {job.address && <span className="flex items-center gap-1"><MapPin size={11} /> {job.address}</span>}
                          <span className="flex items-center gap-1"><Users size={11} /> {job.workers_needed} чел.</span>
                          <span className="flex items-center gap-1"><Wallet size={11} /> {job.hourly_rate} ₽/ч</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
              )}
            </>
            );
          })()}

          {/* STATS TAB */}
          {currentTab === "stats" && (
            <div className="px-4 space-y-3">
              {/* Income/Expense Summary */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <TrendingUp size={14} className="text-green-500" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Доход неделя</span>
                  </div>
                  <p className="text-xl font-extrabold text-green-500">{weeklyStats.income.toLocaleString("ru-RU")} ₽</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                      <TrendingDown size={14} className="text-destructive" />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Расход неделя</span>
                  </div>
                  <p className="text-xl font-extrabold text-destructive">{weeklyStats.expense.toLocaleString("ru-RU")} ₽</p>
                </motion.div>
              </div>

              {/* Profit card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Чистая прибыль за неделю</p>
                    <p className={`text-2xl font-extrabold ${weeklyStats.profit >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {weeklyStats.profit >= 0 ? "+" : ""}{weeklyStats.profit.toLocaleString("ru-RU")} ₽
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${weeklyStats.profit >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
                    <Target size={20} className={weeklyStats.profit >= 0 ? "text-green-500" : "text-destructive"} />
                  </div>
                </div>
              </motion.div>

              {/* Monthly */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-2xl p-4">
                <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5"><DollarSign size={14} className="text-primary" /> За месяц</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Доход</p>
                    <p className="text-sm font-bold text-green-500">{monthlyStats.income.toLocaleString("ru-RU")} ₽</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Расход</p>
                    <p className="text-sm font-bold text-destructive">{monthlyStats.expense.toLocaleString("ru-RU")} ₽</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Прибыль</p>
                    <p className={`text-sm font-extrabold ${monthlyStats.profit >= 0 ? "text-foreground" : "text-destructive"}`}>
                      {monthlyStats.profit >= 0 ? "+" : ""}{monthlyStats.profit.toLocaleString("ru-RU")} ₽
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Chart */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-2xl p-4">
                <h3 className="text-xs font-bold text-foreground mb-4 flex items-center gap-1.5"><BarChart3 size={14} className="text-primary" /> Динамика за неделю</h3>
                <div className="flex items-end justify-between gap-2 h-28">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 90 }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(d.income / maxChartVal) * 100}%` }}
                          transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                          className="w-4 rounded-full bg-green-500/80"
                          style={{ minHeight: d.income > 0 ? 4 : 0 }}
                        />
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(d.expense / maxChartVal) * 100}%` }}
                          transition={{ delay: 0.35 + i * 0.05, duration: 0.4 }}
                          className="w-4 rounded-full bg-destructive/60"
                          style={{ minHeight: d.expense > 0 ? 4 : 0 }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground font-medium">{d.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 justify-center text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Доход</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Расход</span>
                </div>
              </motion.div>
              {/* AI Advice */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                {aiAdvice ? (
                  <div className="bg-card border border-primary/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Sparkles size={14} className="text-primary" />
                      </div>
                      <span className="text-xs font-bold text-foreground">AI-совет</span>
                      <button onClick={() => setAiAdvice(null)} className="ml-auto text-[10px] text-muted-foreground">✕</button>
                    </div>
                    <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-line">{aiAdvice}</p>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={async () => {
                      setAiAdviceLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke("dispatcher-analytics", {
                          body: {
                            stats: {
                              totalJobs: completedStats.length,
                              weeklyJobs: weeklyStats.jobs,
                              avgRate: completedStats.length > 0
                                ? Math.round(completedStats.reduce((s, j) => s + (j.totalExpense / Math.max(j.workersCount, 1)), 0) / completedStats.length)
                                : 0,
                              weeklyIncome: weeklyStats.income,
                              weeklyExpense: weeklyStats.expense,
                              weeklyProfit: weeklyStats.profit,
                              monthlyProfit: monthlyStats.profit,
                              activeJobsCount: activeJobs.length,
                            },
                          },
                        });
                        if (error) throw error;
                        if (data?.error) toast.error(data.error);
                        else if (data?.advice) setAiAdvice(data.advice);
                      } catch { toast.error("Не удалось получить AI-совет"); }
                      finally { setAiAdviceLoading(false); }
                    }}
                    disabled={aiAdviceLoading}
                    className="w-full py-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    {aiAdviceLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {aiAdviceLoading ? "Анализирую..." : "✨ AI-совет по улучшению"}
                  </motion.button>
                )}
              </motion.div>
            </div>
          )}

          {/* HISTORY TAB */}
          {currentTab === "history" && (
            completedStats.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 px-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-card border border-border flex items-center justify-center">
                  <FileText size={28} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-bold text-foreground">Нет завершённых заказов</p>
                <p className="text-xs text-muted-foreground mt-1.5">Завершённые заказы появятся здесь</p>
              </motion.div>
            ) : (
              <div className="px-4 space-y-2">
                {completedStats.map((s, i) => {
                  const profit = s.dispatcherIncome - s.totalExpense;
                  return (
                    <motion.div
                      key={s.jobId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-card border border-border rounded-2xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${profit >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
                          {profit >= 0 ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-destructive" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">{s.title}</h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(s.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · {s.workersCount} чел.
                          </p>
                        </div>
                        <span className={`text-sm font-extrabold shrink-0 ${profit >= 0 ? "text-green-500" : "text-destructive"}`}>
                          {profit >= 0 ? "+" : ""}{profit.toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2.5 ml-13 text-[11px]">
                        <span className="flex items-center gap-1 text-green-500/80"><TrendingUp size={10} /> {s.dispatcherIncome.toLocaleString("ru-RU")} ₽</span>
                        <span className="flex items-center gap-1 text-destructive/80"><TrendingDown size={10} /> {s.totalExpense.toLocaleString("ru-RU")} ₽</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {/* Review modal */}
      <AnimatePresence>
        {reviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setReviewModal(null)}>
            <motion.div
              initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-card rounded-t-3xl p-6 border-t border-border"
            >
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-1">Отзыв о {reviewModal.workerName}</h3>
              <p className="text-xs text-muted-foreground mb-4">Оцените работу исполнителя</p>

              <div className="flex items-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} onClick={() => setReviewRating(v)} className="p-1">
                    <Star size={28} className={v <= reviewRating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"} />
                  </button>
                ))}
              </div>

              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Комментарий (необязательно)..."
                className="w-full bg-surface-1 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border resize-none h-20 mb-4"
              />

              <button onClick={submitReview} className="w-full py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-bold active:scale-[0.98] transition-all">
                Отправить отзыв
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense modal */}
      <AnimatePresence>
        {expenseModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setExpenseModal(null)}>
            <motion.div
              initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-card rounded-t-3xl p-6 border-t border-border"
            >
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-1">Закрытие заказа</h3>
              <p className="text-xs text-muted-foreground mb-4">{expenseModal.title} · {expenseModal.workersCount} грузчиков</p>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">💰 Ваш доход (от клиента)</label>
                  <input
                    type="number"
                    value={dispatcherIncome}
                    onChange={(e) => setDispatcherIncome(e.target.value)}
                    placeholder="0"
                    className="w-full bg-surface-1 rounded-xl p-3 text-lg font-bold text-foreground placeholder:text-muted-foreground outline-none border border-border"
                  />
                </div>

                <div className="bg-surface-1 border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Выплата грузчикам</span>
                    <span className="font-bold text-foreground">
                      {getTotalEarned(activeJobs.find((a) => a.job.id === expenseModal.jobId)?.workers || []).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                  {parseInt(dispatcherIncome) > 0 && (
                    <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-border">
                      <span className="text-muted-foreground">Чистая прибыль</span>
                      <span className={`font-extrabold ${(parseInt(dispatcherIncome) - getTotalEarned(activeJobs.find((a) => a.job.id === expenseModal.jobId)?.workers || [])) >= 0 ? "text-green-500" : "text-destructive"}`}>
                        {((parseInt(dispatcherIncome) || 0) - getTotalEarned(activeJobs.find((a) => a.job.id === expenseModal.jobId)?.workers || [])).toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button onClick={submitExpenseAndComplete} className="w-full py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-bold active:scale-[0.98] transition-all">
                ✅ Завершить и сохранить
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New cabinet features */}
      <JobTemplatesModal open={showTemplates} onClose={() => setShowTemplates(false)} />
      <DispatcherContractsModal open={showContracts} onClose={() => setShowContracts(false)} />
      <TopWorkersModal
        open={showTopWorkers}
        onClose={() => setShowTopWorkers(false)}
        onChat={(id, name) => { setShowTopWorkers(false); onChatWithWorker(id, name); }}
        onViewProfile={(id) => { setShowTopWorkers(false); onViewProfile?.(id); }}
      />
      <GoalsModal
        open={showGoals}
        onClose={() => setShowGoals(false)}
        todayProfit={dailyProfit}
        weekProfit={weeklyStats.profit}
      />
      <SOSReplacementModal
        open={!!sosModal}
        onClose={() => setSosModal(null)}
        job={sosModal?.job || null}
        workerId={sosModal?.workerId || null}
        workerName={sosModal?.workerName || ""}
      />
      {editingJob && (
        <EditJobModal
          job={editingJob}
          open={!!editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={handleJobSaved}
        />
      )}
    </div>
  );
};

export default DispatcherCabinetScreen;
