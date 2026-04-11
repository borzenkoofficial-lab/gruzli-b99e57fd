import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MessageCircle, Star, MapPin, Clock, Navigation,
  AlertTriangle, CheckCircle2, Crown, Users, Briefcase, User,
  ChevronDown, ChevronUp, Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  completed: { label: "Завершил", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
};

const DispatcherCabinetScreen = ({ onBack, onChatWithWorker, onViewProfile }: DispatcherCabinetScreenProps) => {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!user) return;

    // Get all active jobs for this dispatcher
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("dispatcher_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!jobs || jobs.length === 0) {
      setActiveJobs([]);
      setLoading(false);
      return;
    }

    // Get all accepted responses for these jobs
    const jobIds = jobs.map((j) => j.id);
    const { data: responses } = await supabase
      .from("job_responses")
      .select("*")
      .in("job_id", jobIds)
      .eq("status", "accepted");

    // Get worker profiles
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
        }));
        return { job, workers };
      })
      .filter((aj) => aj.workers.length > 0);

    setActiveJobs(result);
    // Expand all by default
    setExpandedJobs(new Set(result.map((aj) => aj.job.id)));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    if (!user) return;

    // Realtime: listen for worker_status changes on all job_responses
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
                  ? { ...w, workerStatus: updated.worker_status }
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

  const getStatusSummary = (workers: WorkerInfo[]) => {
    const counts: Record<string, number> = {};
    workers.forEach((w) => {
      const key = w.workerStatus || "waiting";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
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

            return (
              <motion.div
                key={aj.job.id}
                layout
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Job header */}
                <button
                  onClick={() => toggleExpand(aj.job.id)}
                  className="w-full p-4 flex items-start gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">{aj.job.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {aj.job.address && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {aj.job.address}
                        </span>
                      )}
                      {aj.job.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(aj.job.start_time).toLocaleString("ru-RU", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    {/* Status summary pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-foreground/10 text-[10px] font-semibold text-foreground">
                        <Users size={10} /> {aj.workers.length} чел.
                      </span>
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

                {/* Expanded workers list */}
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
                            <div
                              key={w.responseId}
                              className="bg-surface-1 border border-border rounded-xl p-3"
                            >
                              <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <button
                                  onClick={() => onViewProfile?.(w.workerId)}
                                  className="shrink-0"
                                >
                                  <div className="relative">
                                    {w.profile?.is_premium && (
                                      <div className="absolute -inset-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 opacity-80" />
                                    )}
                                    {w.profile?.avatar_url ? (
                                      <img
                                        src={w.profile.avatar_url}
                                        alt=""
                                        className="relative w-10 h-10 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="relative w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-sm font-bold text-primary-foreground">
                                        {initials}
                                      </div>
                                    )}
                                  </div>
                                </button>

                                {/* Name + rating */}
                                <button
                                  onClick={() => onViewProfile?.(w.workerId)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-foreground truncate">
                                      {w.profile?.full_name || "Грузчик"}
                                    </span>
                                    {w.profile?.is_premium && (
                                      <Crown size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Star size={10} className="text-primary fill-primary" />
                                    <span className="text-[11px] text-muted-foreground">
                                      {w.profile?.rating || "5.0"} · {w.profile?.completed_orders || 0} заказов
                                    </span>
                                  </div>
                                </button>

                                {/* Status badge */}
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

                              {/* Actions */}
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
