import { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Clock, MapPin, Users, Zap, Trash2, Eye, Pencil, Minus } from "lucide-react";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";
import PushNotificationBanner from "@/components/PushNotificationBanner";
import EditJobModal from "@/components/EditJobModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface DispatcherFeedScreenProps {
  onCreateJob: () => void;
  onViewResponses: (job: Tables<"jobs">) => void;
  onRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

const DispatcherFeedScreen = forwardRef<HTMLDivElement, DispatcherFeedScreenProps>(({ onCreateJob, onViewResponses, onRefreshRef }, _ref) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<(Tables<"jobs"> & { response_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    if (!user) return;
    const { data: jobsData } = await supabase
      .from("jobs")
      .select("*")
      .eq("dispatcher_id", user.id)
      .order("created_at", { ascending: false });

    if (jobsData && jobsData.length > 0) {
      // Batch fetch all responses for these jobs
      const jobIds = jobsData.map(j => j.id);
      const { data: responses } = await supabase
        .from("job_responses")
        .select("job_id")
        .in("job_id", jobIds);

      const countMap: Record<string, number> = {};
      responses?.forEach(r => {
        countMap[r.job_id] = (countMap[r.job_id] || 0) + 1;
      });

      setJobs(jobsData.map(job => ({ ...job, response_count: countMap[job.id] || 0 })));
    } else {
      setJobs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = fetchJobs;
    }
  }, [onRefreshRef]);

  const handleDelete = async (jobId: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    if (error) {
      toast.error("Ошибка удаления");
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      toast.success("Заявка удалена");
    }
  };

  const activeJobs = jobs.filter((j) => j.status === "active");
  const closedJobs = jobs.filter((j) => j.status !== "active");

  return (
    <div >
      <div className="px-5 safe-top pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Мои заявки</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление заказами</p>
        </div>
        <img src={gruzliLogo} alt="Gruzli" className="h-10 rounded-xl" loading="lazy" />
      </div>

      <PushNotificationBanner />

      {/* Create job button */}
      <div className="px-5 pb-5">
        <button
          onClick={onCreateJob}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-foreground text-primary-foreground font-bold text-sm tap-scale"
        >
          <Plus size={18} /> Создать заявку
        </button>
      </div>

      {/* Stats banner */}
      <div className="mx-5 mb-4 rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, hsl(240 55% 55%), hsl(220 65% 58%), hsl(195 100% 50%))',
        boxShadow: '0 8px 32px hsl(230 60% 58% / 0.4)',
      }}>
        <div className="px-5 py-4 flex items-center justify-around">
          <div className="text-center">
            <p className="text-white text-2xl font-extrabold">{activeJobs.length}</p>
            <p className="text-white/70 text-xs">Активных</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-white text-2xl font-extrabold">{jobs.reduce((s, j) => s + j.response_count, 0)}</p>
            <p className="text-white/70 text-xs">Откликов</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-white text-2xl font-extrabold">{closedJobs.length}</p>
            <p className="text-white/70 text-xs">Завершённых</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Загрузка...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Нет заявок. Создайте первую!
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
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

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
                {job.address && <span className="flex items-center gap-1"><MapPin size={11} /> {job.address}</span>}
                {job.start_time && <span className="flex items-center gap-1"><Clock size={11} /> {new Date(job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                <span className="flex items-center gap-1"><Users size={11} /> {job.workers_needed} чел.</span>
              </div>

              <div className="bg-surface-1 border border-border rounded-xl px-3 py-2.5 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Оплата</span>
                  <span className="text-lg font-extrabold text-bg-foreground">{job.hourly_rate} ₽/час</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewResponses(job)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-primary-foreground text-sm font-semibold tap-scale"
                >
                  <Eye size={14} /> Отклики ({job.response_count})
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all"
                >
                  <Trash2 size={16} className="text-destructive" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
});
DispatcherFeedScreen.displayName = "DispatcherFeedScreen";

export default DispatcherFeedScreen;
