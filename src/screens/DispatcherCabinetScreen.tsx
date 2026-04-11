import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MessageCircle, Star, MapPin, Clock, Navigation,
  AlertTriangle, CheckCircle2, Crown, Users, Briefcase, User,
  ChevronDown, ChevronUp, Phone, Square, Timer, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface DispatcherCabinetScreenProps {
  onBack: () => void;
  onChatWithWorker: (workerId: string, workerName: string) => void;
  onViewProfile?: (userId: string) => void;
}

interface WorkerInfo {
  responseId: string;
  workerId: string;
  workerStatus: string | null;
  profile: Tables<"profiles"> | null;
  workStartedAt: string | null;
  hoursWorked: number | null;
  earned: number | null;
}

interface ActiveJob {
  job: Tables<"jobs">;
  workers: WorkerInfo[];
}

const WORKER_STATUS_MAP: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  confirmed: { label: "Подтвердил", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  ready: { label: "Готов", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  en_route: { label: "Выехал", icon: Navigation, color: "text-blue-500", bg: "bg-blue-500/10" },
  late: { label: "Опаздывает", icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  arrived: { label: "На месте", icon: MapPin, color: "text-primary", bg: "bg-primary/10" },
  finishing: { label: "Завершает", icon: Timer, color: "text-orange-500", bg: "bg-orange-500/10" },
  completed: { label: "Завершил", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
};

const DispatcherCabinetScreen = ({ onBack, onChatWithWorker, onViewProfile }: DispatcherCabinetScreenProps) => {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [finishingJobs, setFinishingJobs] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!user) return;

    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("dispatcher_id", user.id)
      .in("status", ["active", "finishing"])
      .order("created_at", { ascending: false });

    if (!jobs || jobs.length === 0) {
      setActiveJobs([]);
      setLoading(false);
      return;
    }

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
        }));
        return { job, workers };
      })
      .filter((aj) => aj.workers.length > 0);

    setActiveJobs(result);
    setExpandedJobs(new Set(result.map((aj) => aj.job.id)));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    if (!user) return;

    const channel = supabase
      .channel("dispatcher-cabinet")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "job_responses" },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status !== "accepted") return;

          setActiveJobs((prev) =>
            prev.map((aj) => ({
              ...aj,
              workers: aj.workers.map((w) =>
                w.responseId === updated.id
                  ? {
                      ...w,
                      workerStatus: updated.worker_status,
                      workStartedAt: updated.work_started_at,
                      hoursWorked: updated.hours_worked ? Number(updated.hours_worked) : null,
                      earned: updated.earned,
                    }
                  : w
              ),
            }))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const toggleExpand = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const finishJob = async (jobId: string, workers: WorkerInfo[]) => {
    setFinishingJobs((prev) => new Set(prev).add(jobId));

    // Set all workers who haven't completed to "finishing" status
    for (const w of workers) {
      if (w.workerStatus !== "completed") {
        await supabase
          .from("job_responses")
          .update({ worker_status: "finishing" } as any)
          .eq("id", w.responseId);
      }
    }

    // Update job status
    await supabase
      .from("jobs")
      .update({ status: "finishing" })
      .eq("id", jobId);

    toast.success("⏹ Заказ завершается. Грузчики получили уведомление.");

    // Refresh data
    await fetchData();
    setFinishingJobs((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  };

  const getStatusSummary = (workers: WorkerInfo[]) => {
    const counts: Record<string, number> = {};
    workers.forEach((w) => {
      const key = w.workerStatus || "waiting";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  const getTotalEarned = (workers: WorkerInfo[]) => {
    return workers.reduce((sum, w) => sum + (w.earned || 0), 0);
  };

  const allWorkersCompleted = (workers: WorkerInfo[]) => {
    return workers.every((w) => w.workerStatus === "completed");
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Кабинет</h1>
          <p className="text-xs text-muted-foreground">Управление исполнителями</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10">
          <Briefcase size={14} className="text-primary" />
          <span className="text-xs font-bold text-primary">{activeJobs.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Загрузка...</div>
      ) : activeJobs.length === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-semibold text-foreground">Нет активных заявок с исполнителями</p>
          <p className="text-xs text-muted-foreground mt-1">Когда грузчики будут приняты на заявки, они появятся здесь</p>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {activeJobs.map((aj) => {
            const isExpanded = expandedJobs.has(aj.job.id);
            const statusCounts = getStatusSummary(aj.workers);
            const totalEarned = getTotalEarned(aj.workers);
            const isFinishing = aj.job.status === "finishing";
            const allDone = allWorkersCompleted(aj.workers);

            return (
              <motion.div
                key={aj.job.id}
                layout
                className={`bg-card border rounded-2xl overflow-hidden ${isFinishing ? "border-orange-500/30" : "border-border"}`}
              >
                <button
                  onClick={() => toggleExpand(aj.job.id)}
                  className="w-full p-4 flex items-start gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground truncate">{aj.job.title}</h3>
                      {isFinishing && (
                        <span className="shrink-0 px-2 py-0.5 rounded-lg bg-orange-500/10 text-[10px] font-bold text-orange-500">
                          Завершается
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {aj.job.address && (
                        <span className="flex items-center gap-1"><MapPin size={10} /> {aj.job.address}</span>
                      )}
                      {aj.job.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(aj.job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-foreground/10 text-[10px] font-semibold text-foreground">
                        <Users size={10} /> {aj.workers.length} чел.
                      </span>
                      {totalEarned > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/10 text-[10px] font-semibold text-green-500">
                          <Wallet size={10} /> {totalEarned.toLocaleString("ru-RU")} ₽
                        </span>
                      )}
                      {Object.entries(statusCounts).map(([status, count]) => {
                        const ws = WORKER_STATUS_MAP[status];
                        if (!ws) return (
                          <span key={status} className="px-2 py-0.5 rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground">
                            Ожидают: {count}
                          </span>
                        );
                        return (
                          <span key={status} className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${ws.bg} text-[10px] font-semibold ${ws.color}`}>
                            {count} {ws.label.toLowerCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={18} className="text-muted-foreground mt-1 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-muted-foreground mt-1 shrink-0" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2">
                        {aj.workers.map((w) => {
                          const ws = w.workerStatus ? WORKER_STATUS_MAP[w.workerStatus] : null;
                          const WsIcon = ws?.icon;
                          const initials = (w.profile?.full_name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2);

                          return (
                            <div key={w.responseId} className="bg-surface-1 border border-border rounded-xl p-3">
                              <div className="flex items-center gap-3">
                                <button onClick={() => onViewProfile?.(w.workerId)} className="shrink-0">
                                  <div className="relative">
                                    {w.profile?.is_premium && (
                                      <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 opacity-80" />
                                    )}
                                    {w.profile?.avatar_url ? (
                                      <img src={w.profile.avatar_url} alt="" className="relative w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                      <div className="relative w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-sm font-bold text-primary-foreground">
                                        {initials}
                                      </div>
                                    )}
                                  </div>
                                </button>

                                <button onClick={() => onViewProfile?.(w.workerId)} className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-foreground truncate">
                                      {w.profile?.full_name || "Грузчик"}
                                    </span>
                                    {w.profile?.is_premium && <Crown size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Star size={10} className="text-primary fill-primary" />
                                    <span className="text-[11px] text-muted-foreground">
                                      {w.profile?.rating || "5.0"} · {w.profile?.completed_orders || 0} заказов
                                    </span>
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

                              {/* Earnings info for completed workers */}
                              {w.workerStatus === "completed" && w.earned != null && (
                                <div className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded-lg bg-green-500/10 text-[11px]">
                                  <span className="text-green-500 font-bold flex items-center gap-1">
                                    <Wallet size={10} /> {w.earned.toLocaleString("ru-RU")} ₽
                                  </span>
                                  {w.hoursWorked != null && (
                                    <span className="text-green-500/70 flex items-center gap-1">
                                      <Timer size={10} /> {w.hoursWorked}ч
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-2 mt-2.5">
                                <button
                                  onClick={() => onChatWithWorker(w.workerId, w.profile?.full_name || "Грузчик")}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground active:bg-surface-1 transition-all"
                                >
                                  <MessageCircle size={13} className="text-primary" />
                                  Написать
                                </button>
                                {w.profile?.phone && (
                                  <a
                                    href={`tel:${w.profile.phone}`}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground active:bg-surface-1 transition-all"
                                  >
                                    <Phone size={13} className="text-green-500" />
                                    Звонок
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Finish job button */}
                        {!isFinishing && !allDone && (
                          <button
                            onClick={() => finishJob(aj.job.id, aj.workers)}
                            disabled={finishingJobs.has(aj.job.id)}
                            className="w-full mt-2 py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
                          >
                            ⏹ Завершить заказ
                          </button>
                        )}

                        {allDone && (
                          <div className="text-center py-2">
                            <p className="text-xs font-bold text-green-500">✅ Все грузчики завершили работу</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Итого: {getTotalEarned(aj.workers).toLocaleString("ru-RU")} ₽
                            </p>
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
    </div>
  );
};

export default DispatcherCabinetScreen;
