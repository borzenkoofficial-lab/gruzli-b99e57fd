import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, MapPin, Navigation, AlertTriangle, Loader2, PartyPopper, Wallet, Play, Square, Timer } from "lucide-react";
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
  workStartedAt: string | null;
  workFinishedAt: string | null;
  hoursWorked: number | null;
  earned: number | null;
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
  const [completedJobs, setCompletedJobs] = useState<AcceptedJob[]>([]);

  const fetchAcceptedJobs = async () => {
    if (!user) return;
    setLoading(true);

    const { data: responses } = await supabase
      .from("job_responses")
      .select("*")
      .eq("worker_id", user.id)
      .in("status", ["accepted"]);

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
        workStartedAt: (resp as any).work_started_at,
        workFinishedAt: (resp as any).work_finished_at,
        hoursWorked: (resp as any).hours_worked ? Number((resp as any).hours_worked) : null,
        earned: (resp as any).earned,
      };
    });

    // Separate completed from active
    const active = mapped.filter((j) => j.workerStatus !== "completed");
    const done = mapped.filter((j) => j.workerStatus === "completed");

    active.sort((a, b) => {
      if (!a.workerStatus && b.workerStatus) return -1;
      if (a.workerStatus && !b.workerStatus) return 1;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    setJobs(active);
    setCompletedJobs(done);
    setLoading(false);
  };

  // Also fetch recent completed jobs
  useEffect(() => {
    if (!user) return;
    const fetchCompleted = async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: responses } = await supabase
        .from("job_responses")
        .select("*")
        .eq("worker_id", user.id)
        .eq("worker_status", "completed")
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (!responses || responses.length === 0) return;

      const jobIds = responses.map((r) => r.job_id);
      const { data: jobsData } = await supabase.from("jobs").select("*").in("id", jobIds);
      if (!jobsData) return;

      const dispatcherIds = [...new Set(jobsData.map((j) => j.dispatcher_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", dispatcherIds);
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
          workStartedAt: (resp as any).work_started_at,
          workFinishedAt: (resp as any).work_finished_at,
          hoursWorked: (resp as any).hours_worked ? Number((resp as any).hours_worked) : null,
          earned: (resp as any).earned,
        };
      });

      setCompletedJobs(mapped);
    };
    fetchCompleted();
  }, [user]);

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
          // If dispatcher finished the job (status changed to finishing), refetch
          if (updated.worker_status === "finishing" || updated.status === "accepted") {
            fetchAcceptedJobs();
          }
          setJobs((prev) =>
            prev.map((j) =>
              j.responseId === updated.id
                ? { ...j, workerStatus: updated.worker_status, workStartedAt: updated.work_started_at, workFinishedAt: updated.work_finished_at }
                : j
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
    const updateData: any = { worker_status: status };

    // When arriving ("arrived"), start the work timer
    if (status === "arrived") {
      updateData.work_started_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("job_responses")
      .update(updateData)
      .eq("id", responseId);

    if (error) {
      toast.error("Ошибка обновления статуса");
      return;
    }

    setJobs((prev) =>
      prev.map((j) => (j.responseId === responseId
        ? { ...j, workerStatus: status, workStartedAt: status === "arrived" ? new Date().toISOString() : j.workStartedAt }
        : j))
    );
    if (navigator.vibrate) navigator.vibrate(50);
    const step = STATUS_STEPS.find((s) => s.key === status);
    toast.success(`${step?.emoji} ${step?.label}`);
  };

  const finishWork = async (job: AcceptedJob) => {
    const now = new Date();
    const startedAt = job.workStartedAt ? new Date(job.workStartedAt) : now;
    const hoursWorked = Math.max(0.5, Math.round(((now.getTime() - startedAt.getTime()) / 3600000) * 10) / 10);
    const earned = Math.round(hoursWorked * job.hourlyRate);

    const { error } = await supabase
      .from("job_responses")
      .update({
        worker_status: "completed",
        work_finished_at: now.toISOString(),
        hours_worked: hoursWorked,
        earned,
      } as any)
      .eq("id", job.responseId);

    if (error) {
      toast.error("Ошибка завершения");
      return;
    }

    // Update profile stats
    await supabase
      .from("profiles")
      .update({
        completed_orders: (0 as any), // Will use RPC
        total_earned: (0 as any),
      } as any)
      .eq("user_id", user!.id);

    // Use direct SQL-like update via rpc or manual increment
    // Actually, let's just increment manually
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("completed_orders, total_earned")
      .eq("user_id", user!.id)
      .single();

    if (currentProfile) {
      await supabase
        .from("profiles")
        .update({
          completed_orders: (currentProfile.completed_orders || 0) + 1,
          total_earned: ((currentProfile as any).total_earned || 0) + earned,
        } as any)
        .eq("user_id", user!.id);
    }

    // Move from active to completed
    const completedJob = { ...job, workerStatus: "completed", workFinishedAt: now.toISOString(), hoursWorked, earned };
    setJobs((prev) => prev.filter((j) => j.responseId !== job.responseId));
    setCompletedJobs((prev) => [completedJob, ...prev]);

    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    toast.success(`🎉 Заказ завершён! Заработано: ${earned} ₽`);
  };

  if (loading) {
    return (
      <div>
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
  const confirmed = jobs.filter((j) => j.workerStatus && j.workerStatus !== "finishing");
  const finishing = jobs.filter((j) => j.workerStatus === "finishing");

  return (
    <div>
      <div className="px-5 safe-top pb-4">
        <h1 className="text-lg font-bold text-foreground">Мои заказы</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Заявки, на которые вас выбрали</p>
      </div>

      <div className="px-5 space-y-3">
        {/* Finishing — dispatcher requested finish */}
        {finishing.length > 0 && (
          <>
            <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
              <Square size={13} /> Завершите работу ({finishing.length})
            </p>
            <AnimatePresence mode="popLayout">
              {finishing.map((job) => (
                <motion.div
                  key={job.responseId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl p-4 border-2 border-destructive/30"
                  style={{ background: "linear-gradient(135deg, hsl(var(--destructive) / 0.08), hsl(var(--background)))" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-foreground">{job.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{job.dispatcherName}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Wallet size={14} className="text-primary" />
                      <span className="text-base font-extrabold text-foreground">
                        {job.hourlyRate} ₽/ч
                      </span>
                    </div>
                  </div>

                  {job.workStartedAt && <WorkTimer startedAt={job.workStartedAt} hourlyRate={job.hourlyRate} />}

                  <p className="text-xs text-destructive font-semibold mb-3">⚠️ Диспетчер завершил заказ. Нажмите кнопку для подсчёта.</p>

                  <button
                    onClick={() => finishWork(job)}
                    className="w-full py-3.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold active:scale-95 transition-all"
                  >
                    ✅ Завершить работу
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}

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
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--background)))" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-foreground">{job.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{job.dispatcherName}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Wallet size={14} className="text-primary" />
                      <span className="text-base font-extrabold text-foreground">
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
                    className="w-full py-3.5 rounded-xl bg-foreground text-primary-foreground text-sm font-bold active:scale-95 transition-all"
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
              className="bg-card border border-border rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">{job.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{job.dispatcherName}</p>
                </div>
                <span className="text-base font-extrabold text-foreground ml-2">
                  {job.hourlyRate} ₽/ч
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

              {/* Work timer when arrived */}
              {job.workStartedAt && job.workerStatus === "arrived" && (
                <WorkTimer startedAt={job.workStartedAt} hourlyRate={job.hourlyRate} />
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
                          ? "bg-foreground text-primary-foreground"
                          : "bg-card border border-border text-muted-foreground active:bg-surface-1"
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

        {/* Completed jobs */}
        {completedJobs.length > 0 && (
          <>
            <p className="text-xs font-bold text-foreground pt-4 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-green-500" /> Завершённые
            </p>
            {completedJobs.map((job) => (
              <div key={job.responseId} className="bg-card border border-border rounded-2xl p-4 opacity-80">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
                  <span className="text-sm font-bold text-green-500">
                    +{(job.earned || 0).toLocaleString("ru-RU")} ₽
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{job.dispatcherName}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Timer size={10} /> {job.hoursWorked ? `${job.hoursWorked}ч` : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wallet size={10} /> {job.hourlyRate} ₽/ч
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {jobs.length === 0 && completedJobs.length === 0 && (
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

const WorkTimer = ({ startedAt, hourlyRate }: { startedAt: string; hourlyRate: number }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const currentEarned = Math.round((elapsed / 3600) * hourlyRate);

  return (
    <div className="flex items-center justify-between mb-3 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
      <div className="flex items-center gap-2">
        <Play size={13} className="text-green-500 fill-green-500" />
        <span className="text-xs font-bold text-green-500">
          {hours > 0 ? `${hours}ч ` : ""}{mins.toString().padStart(2, "0")}м {secs.toString().padStart(2, "0")}с
        </span>
      </div>
      <span className="text-xs font-bold text-green-500">≈ {currentEarned} ₽</span>
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
    <div className={`flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl ${isUrgent ? "bg-destructive/10" : "bg-surface-1 border border-border"}`}>
      <Clock size={13} className={isUrgent ? "text-destructive" : "text-primary"} />
      <span className={`text-xs font-bold ${isUrgent ? "text-destructive" : "text-foreground"}`}>
        До начала: {hours > 0 ? `${hours}ч ` : ""}{mins}м {secs.toString().padStart(2, "0")}с
      </span>
    </div>
  );
};

export default OrdersScreen;
