import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, MapPin, Navigation, AlertTriangle, Loader2, PartyPopper, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AcceptedJob {
  responseId: string;
  jobId: string;
  title: string;
  address: string | null;
  startTime: string | null;
  hourlyRate: number;
  durationHours: number;
  dispatcherName: string;
  workerStatus: string | null;
}

const STATUS_STEPS = [
  { key: "ready", label: "Готов", icon: CheckCircle2, emoji: "✅" },
  { key: "en_route", label: "Выехал", icon: Navigation, emoji: "🚗" },
  { key: "late", label: "Опаздываю", icon: AlertTriangle, emoji: "⚠️" },
  { key: "arrived", label: "На месте", icon: MapPin, emoji: "📍" },
];

const OrdersScreen = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<AcceptedJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAcceptedJobs = async () => {
    if (!user) return;
    setLoading(true);

    const { data: responses } = await supabase
      .from("job_responses")
      .select("*")
      .eq("worker_id", user.id)
      .eq("status", "accepted");

    if (!responses || responses.length === 0) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const jobIds = responses.map((r) => r.job_id);
    const { data: jobsData } = await supabase
      .from("jobs")
      .select("*")
      .in("id", jobIds);

    if (!jobsData) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const dispatcherIds = [...new Set(jobsData.map((j) => j.dispatcher_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", dispatcherIds);
    const nameMap: Record<string, string> = {};
    profiles?.forEach((p) => { nameMap[p.user_id] = p.full_name; });

    const mapped: AcceptedJob[] = jobsData.map((j) => {
      const resp = responses.find((r) => r.job_id === j.id)!;
      return {
        responseId: resp.id,
        jobId: j.id,
        title: j.title,
        address: j.address,
        startTime: j.start_time,
        hourlyRate: j.hourly_rate,
        durationHours: Number(j.duration_hours) || 1,
        dispatcherName: nameMap[j.dispatcher_id] || "Диспетчер",
        workerStatus: resp.worker_status,
      };
    });

    mapped.sort((a, b) => {
      // Unconfirmed first
      if (!a.workerStatus && b.workerStatus) return -1;
      if (a.workerStatus && !b.workerStatus) return 1;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    setJobs(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchAcceptedJobs();

    if (!user) return;
    const channel = supabase
      .channel("my-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "job_responses", filter: `worker_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "accepted") {
            fetchAcceptedJobs();
          }
          setJobs((prev) =>
            prev.map((j) =>
              j.responseId === updated.id ? { ...j, workerStatus: updated.worker_status } : j
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const confirmJob = async (responseId: string) => {
    const { error } = await supabase
      .from("job_responses")
      .update({ worker_status: "confirmed" })
      .eq("id", responseId);

    if (error) {
      toast.error("Ошибка подтверждения");
      return;
    }

    setJobs((prev) =>
      prev.map((j) => (j.responseId === responseId ? { ...j, workerStatus: "confirmed" } : j))
    );
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    toast.success("🎉 Заказ подтверждён!");
  };

  const setWorkerStatus = async (responseId: string, status: string) => {
    const { error } = await supabase
      .from("job_responses")
      .update({ worker_status: status })
      .eq("id", responseId);

    if (error) {
      toast.error("Ошибка обновления статуса");
      return;
    }

    setJobs((prev) =>
      prev.map((j) => (j.responseId === responseId ? { ...j, workerStatus: status } : j))
    );
    if (navigator.vibrate) navigator.vibrate(50);
    const step = STATUS_STEPS.find((s) => s.key === status);
    toast.success(`${step?.emoji} ${step?.label}`);
  };

  if (loading) {
    return (
      <div >
        <div className="px-5 safe-top pb-4">
          <h1 className="text-lg font-bold text-foreground">Мои заказы</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const unconfirmed = jobs.filter((j) => !j.workerStatus);
  const confirmed = jobs.filter((j) => j.workerStatus);

  return (
    <div >
      <div className="px-5 safe-top pb-4">
        <h1 className="text-lg font-bold text-foreground">Мои заказы</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Заявки, на которые вас выбрали</p>
      </div>

      <div className="px-5 space-y-3">
        {/* Unconfirmed — need worker confirmation */}
        {unconfirmed.length > 0 && (
          <>
            <p className="text-xs font-bold text-primary flex items-center gap-1.5">
              <PartyPopper size={13} /> Ожидают подтверждения ({unconfirmed.length})
            </p>
            <AnimatePresence mode="popLayout">
              {unconfirmed.map((job, i) => (
                <motion.div
                  key={job.responseId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl p-4 border-2 border-primary/30"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--background)))",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-foreground">{job.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{job.dispatcherName}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Wallet size={14} className="text-primary" />
                      <span className="text-base font-extrabold text-gradient-primary">
                        {(job.hourlyRate * job.durationHours).toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                    {job.startTime && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(job.startTime).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {job.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {job.address}
                      </span>
                    )}
                  </div>

                  {job.startTime && new Date(job.startTime) > new Date() && (
                    <CountdownToJob startTime={job.startTime} />
                  )}

                  <button
                    onClick={() => confirmJob(job.responseId)}
                    className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-all"
                    style={{
                      boxShadow: "6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)",
                    }}
                  >
                    ✅ Подтвердить заказ
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}

        {/* Confirmed — with status controls */}
        {confirmed.length > 0 && unconfirmed.length > 0 && (
          <p className="text-xs font-bold text-foreground pt-2">Подтверждённые</p>
        )}
        <AnimatePresence mode="popLayout">
          {confirmed.map((job, i) => (
            <motion.div
              key={job.responseId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.05 }}
              className="neu-card rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">{job.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{job.dispatcherName}</p>
                </div>
                <span className="text-base font-extrabold text-gradient-primary ml-2">
                  {(job.hourlyRate * job.durationHours).toLocaleString("ru-RU")} ₽
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                {job.startTime && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(job.startTime).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {job.address && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {job.address}
                  </span>
                )}
              </div>

              {job.startTime && new Date(job.startTime) > new Date() && (
                <CountdownToJob startTime={job.startTime} />
              )}

              <div className="grid grid-cols-4 gap-1.5">
                {STATUS_STEPS.map((step) => {
                  const isActive = job.workerStatus === step.key;
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.key}
                      onClick={() => setWorkerStatus(job.responseId, step.key)}
                      className={`py-2.5 rounded-xl text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
                        isActive
                          ? "gradient-primary text-primary-foreground"
                          : "neu-raised-sm text-muted-foreground active:neu-inset"
                      }`}
                    >
                      <Icon size={14} />
                      {step.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {jobs.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm text-muted-foreground">Пока нет принятых заказов</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Откликнитесь на заявки в ленте</p>
          </div>
        )}
      </div>
    </div>
  );
};

const CountdownToJob = ({ startTime }: { startTime: string }) => {
  const [diff, setDiff] = useState(() => Math.max(0, Math.floor((new Date(startTime).getTime() - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      setDiff(Math.max(0, Math.floor((new Date(startTime).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (diff <= 0) return null;

  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  const isUrgent = diff < 3600;

  return (
    <div className={`flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl ${isUrgent ? "bg-destructive/10" : "neu-inset"}`}>
      <Clock size={13} className={isUrgent ? "text-destructive" : "text-primary"} />
      <span className={`text-xs font-bold ${isUrgent ? "text-destructive" : "text-foreground"}`}>
        До начала: {hours > 0 ? `${hours}ч ` : ""}{mins}м {secs.toString().padStart(2, "0")}с
      </span>
    </div>
  );
};

export default OrdersScreen;
