import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, MapPin, Navigation, AlertTriangle, Loader2, PartyPopper, Wallet, Play, Square, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ContractStatusBadge from "@/components/ContractStatusBadge";

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
  { key: "confirmed", label: "Подтверждён", icon: CheckCircle2, emoji: "✓" },
  { key: "en_route", label: "Выехал", icon: Navigation, emoji: "→" },
  { key: "late", label: "Опаздываю", icon: AlertTriangle, emoji: "!" },
  { key: "arrived", label: "На месте", icon: MapPin, emoji: "•" },
];

const OrdersScreen = () => {
  const { user, role } = useAuth();
  const [jobs, setJobs] = useState<AcceptedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedJobs, setCompletedJobs] = useState<AcceptedJob[]>([]);
  const [clientOffers, setClientOffers] = useState<Record<string, any[]>>({});

  const fetchAcceptedJobs = async () => {
    setLoading(true);
    if (!user) {
      const demoMode = localStorage.getItem("gruzli_demo_worker") === "1";
      if (demoMode) {
        setJobs([{
          responseId: "demo-response-1", jobId: "demo-job-1", title: "Переезд квартиры · Сокольники",
          address: "Москва, ул. Стромынка, 18", startTime: "2026-09-30T10:00:00+03:00",
          hourlyRate: 900, durationHours: 5, dispatcherName: "Алексей", workerStatus: "confirmed",
          workStartedAt: null, workFinishedAt: null, hoursWorked: null, earned: null,
        }]);
        setCompletedJobs([{
          responseId: "demo-response-0", jobId: "demo-job-0", title: "Разгрузка фуры · Химки",
          address: "Химки, Ленинградское шоссе, 23", startTime: null, hourlyRate: 750, durationHours: 4,
          dispatcherName: "Мария", workerStatus: "completed", workStartedAt: null, workFinishedAt: null,
          hoursWorked: 4, earned: 3000,
        }]);
      } else {
        setJobs([]);
        setCompletedJobs([]);
      }
      setLoading(false);
      return;
    }
    setLoading(true);

    if (role === "client") {
      const { data: clientJobs, error: clientJobsError } = await supabase
        .from("jobs")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (clientJobsError) {
        console.error("Failed to load client jobs", clientJobsError);
        toast.error("Не удалось загрузить ваши заявки");
        setClientOffers({});
        setJobs([]);
        setCompletedJobs([]);
        setLoading(false);
        return;
      }

      const clientJobIds = (clientJobs || []).map((j) => j.id);
      let dispatcherNameMap: Record<string, string> = {};
      const assignedDispatcherIds = [...new Set((clientJobs || []).map((j) => j.dispatcher_id).filter(Boolean))] as string[];
      if (assignedDispatcherIds.length) {
        const { data: assignedProfiles } = await supabase
          .from("profiles_public" as any)
          .select("user_id, full_name")
          .in("user_id", assignedDispatcherIds);
        (assignedProfiles as any[] || []).forEach((p) => { dispatcherNameMap[p.user_id] = p.full_name; });
      }
      if (clientJobIds.length) {
        const { data: offers, error: offersError } = await supabase.from("dispatcher_offers").select("*").in("job_id", clientJobIds).eq("status", "pending").order("created_at", { ascending: false });
        if (offersError) {
          console.error("Failed to load dispatcher offers", offersError);
          setClientOffers({});
        }
        const dispatcherIds = [...new Set((offers || []).map((o: any) => o.dispatcher_id))];
        const { data: dispatcherProfiles } = dispatcherIds.length
          ? await supabase.from("profiles_public" as any).select("user_id, full_name, avatar_url").in("user_id", dispatcherIds)
          : { data: [] as any[] };
        const profileById: Record<string, any> = {};
        (dispatcherProfiles as any[] || []).forEach((p) => { profileById[p.user_id] = p; });
        const grouped: Record<string, any[]> = {};
        (offers || []).forEach((o: any) => { grouped[o.job_id] ||= []; grouped[o.job_id].push({ ...o, profile: profileById[o.dispatcher_id] }); });
        setClientOffers(grouped);
      } else setClientOffers({});
      const mapped: AcceptedJob[] = (clientJobs || []).map((j) => ({
        responseId: j.id,
        jobId: j.id,
        title: j.title,
        address: j.address,
        startTime: j.start_time,
        hourlyRate: j.hourly_rate,
        durationHours: Number(j.duration_hours) || 1,
        dispatcherName: j.dispatcher_id ? (dispatcherNameMap[j.dispatcher_id] || "Диспетчер назначен") : "Ищем диспетчера",
        workerStatus: j.status || "open",
        workStartedAt: null,
        workFinishedAt: null,
        hoursWorked: null,
        earned: null,
      }));

      setJobs(mapped.filter((j) => j.workerStatus !== "completed"));
      setCompletedJobs(mapped.filter((j) => j.workerStatus === "completed"));
      setLoading(false);
      return;
    }

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
      .from("profiles_public" as any)
      .select("user_id, full_name")
      .in("user_id", dispatcherIds);
    const nameMap: Record<string, string> = {};
    (profiles as any[])?.forEach((p) => { nameMap[p.user_id] = p.full_name; });

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
      const { data: profiles } = await supabase.from("profiles_public" as any).select("user_id, full_name").in("user_id", dispatcherIds);
      const nameMap: Record<string, string> = {};
      (profiles as any[])?.forEach((p) => { nameMap[p.user_id] = p.full_name; });

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
  }, [user, role]);

  useEffect(() => {
    fetchAcceptedJobs();

    if (!user) return;
    const channel = supabase
      .channel("my-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `client_id=eq.${user.id}` },
        () => fetchAcceptedJobs()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatcher_offers" },
        () => { if (role === "client") fetchAcceptedJobs(); }
      )
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
    const { data, error } = await supabase.rpc("worker_update_response_status", {
      _response_id: responseId,
      _next_status: "confirmed",
    });
    if (error) {
      toast.error(error.code === "P0001" ? "Заказ нельзя подтвердить в текущем статусе" : "Ошибка подтверждения");
      return;
    }
    setJobs((prev) => prev.map((j) => (j.responseId === responseId ? { ...j, workerStatus: data?.worker_status || "confirmed" } : j)));
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    toast.success("Заказ подтверждён");
  };

  const setWorkerStatus = async (responseId: string, status: string) => {
    const { data, error } = await supabase.rpc("worker_update_response_status", {
      _response_id: responseId,
      _next_status: status,
    });
    if (error) {
      toast.error(error.code === "P0001" ? "Сначала выполните предыдущий шаг" : "Ошибка обновления статуса");
      return;
    }
    setJobs((prev) =>
      prev.map((j) => (j.responseId === responseId
        ? {
            ...j,
            workerStatus: data?.worker_status || status,
            workStartedAt: data?.work_started_at ?? j.workStartedAt,
            workFinishedAt: data?.work_finished_at ?? j.workFinishedAt,
            hoursWorked: data?.hours_worked ?? j.hoursWorked,
            earned: data?.earned ?? j.earned,
          }
        : j))
    );
    if (navigator.vibrate) navigator.vibrate(50);
    const step = STATUS_STEPS.find((s) => s.key === status);
    toast.success(step?.label || "Статус обновлён");
  };

  const finishWork = async (job: AcceptedJob) => {
    const { data, error } = await supabase.rpc("worker_update_response_status", {
      _response_id: job.responseId,
      _next_status: "completed",
    });
    if (error) {
      toast.error(error.code === "P0001" ? "Сначала нужно прибыть на объект" : "Ошибка завершения");
      return;
    }

    const completedJob = {
      ...job,
      workerStatus: "completed",
      workFinishedAt: data?.work_finished_at || new Date().toISOString(),
      hoursWorked: data?.hours_worked ?? job.hoursWorked,
      earned: data?.earned ?? job.earned,
    };
    setJobs((prev) => prev.filter((j) => j.responseId !== job.responseId));
    setCompletedJobs((prev) => [completedJob, ...prev]);

    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    toast.success(`Заказ завершён. Заработано: ${Number(completedJob.earned || 0).toLocaleString("ru-RU")} ₽`);
  };

  if (loading) {
    return (
    <div className="gruzli-orders-screen app-scroll gruzli-page-enter native-surface">
        <div className="px-5 safe-top pb-4">
          <h1 className="text-lg font-bold text-foreground">Мои заказы</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (role === "client") {
    return (
      <div className="gruzli-orders-screen app-scroll gruzli-page-enter native-surface">
        <header className="px-5 safe-top pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Gruzli / CLIENT</p>
          <h1 className="text-[29px] font-extrabold text-foreground tracking-[-.045em] leading-none">Мои заявки</h1>
          <p className="text-xs text-muted-foreground mt-1">Статус заказов и назначенный диспетчер.</p>
        </header>
        <main className="px-5 pb-28 space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-6 native-surface">
              <p className="text-sm font-bold text-foreground">Заявок пока нет</p>
              <p className="text-xs text-muted-foreground mt-1">Создайте заказ в разделе заявки.</p>
            </div>
          ) : jobs.map((job) => (
            <motion.div key={job.jobId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-5 native-surface">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">ЗАКАЗ / {job.jobId.slice(0, 6).toUpperCase()}</p>
                  <h3 className="text-base font-extrabold text-foreground mt-1">{job.title}</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider rounded-full border border-border px-2.5 py-1">
                  {job.workerStatus === "open" ? "Ищем диспетчера" : job.workerStatus === "active" ? "Диспетчер выбран" : job.workerStatus === "finishing" ? "Завершается" : job.workerStatus === "closed" ? "Закрыт" : job.workerStatus === "completed" ? "Завершён" : "В работе"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div><span className="text-muted-foreground">Адрес</span><p className="font-bold mt-0.5">{job.address || "—"}</p></div>
                <div><span className="text-muted-foreground">Ставка</span><p className="font-bold mt-0.5">{job.hourlyRate} ₽/ч</p></div>
              </div>
              {job.workerStatus === "open" && (clientOffers[job.jobId] || []).length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <p className="text-xs font-extrabold uppercase tracking-wider">Предложения диспетчеров · {clientOffers[job.jobId].length}</p>
                  {clientOffers[job.jobId].map((offer: any) => (
                    <div key={offer.id} className="rounded-2xl border border-border bg-background p-3 native-surface">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold">{offer.profile?.full_name || "Диспетчер Gruzli"}</p>
                          <p className="text-[11px] text-muted-foreground">Диспетчер Gruzli</p>
                        </div>
                        <p className="text-sm font-extrabold">{offer.proposed_hourly_rate} ₽/ч</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Организует грузчиков: {offer.proposed_workers}</p>
                      {offer.message && <p className="mt-2 text-xs">{offer.message}</p>}
                      <button
                        onClick={async () => {
                          const { error } = await supabase.rpc("client_select_dispatcher_offer", { _offer_id: offer.id });
                          if (error) { toast.error(error.message.includes("unavailable") ? "Заказ уже назначен или предложение недоступно" : "Не удалось выбрать диспетчера"); return; }
                          toast.success("Диспетчер выбран");
                          await fetchAcceptedJobs();
                        }}
                        className="mt-3 w-full rounded-xl bg-foreground py-3 text-xs font-bold text-background native-press active:scale-[.98] transition-transform"
                      >ВЫБРАТЬ ДИСПЕТЧЕРА</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">{job.dispatcherName}</div>
            </motion.div>
          ))}
        </main>
      </div>
    );
  }

  const unconfirmed = jobs.filter((j) => !j.workerStatus);
  const confirmed = jobs.filter((j) => j.workerStatus && j.workerStatus !== "finishing");
  const finishing = jobs.filter((j) => j.workerStatus === "finishing");

  return (
    <div className="gruzli-orders-screen app-scroll native-surface">
      <header className="px-5 safe-top pb-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Gruzli</p>
        <h1 className="text-[29px] font-extrabold text-foreground tracking-[-.045em] leading-none">Мои заказы</h1></div>
        <p className="text-xs text-muted-foreground mt-1">Заявки, на которые вас выбрали</p>
      </header>

      <main className="px-5 pb-28 space-y-3">
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

                  <ContractStatusBadge jobId={job.jobId} />

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

              <ContractStatusBadge jobId={job.jobId} />

              {/* Work timer when arrived */}
              {job.workStartedAt && job.workerStatus === "arrived" && (
                <WorkTimer startedAt={job.workStartedAt} hourlyRate={job.hourlyRate} />
              )}

              {(() => {
                const nextByStatus: Record<string, string[]> = {
                  confirmed: ["en_route", "late"],
                  en_route: ["arrived", "late"],
                  late: ["en_route", "arrived"],
                  arrived: [],
                };
                const next = nextByStatus[job.workerStatus || "confirmed"] || [];
                return (
                  <div className="space-y-2">
                    {next.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {next.map((status) => {
                          const step = STATUS_STEPS.find((s) => s.key === status)!;
                          const Icon = step.icon;
                          return (
                            <button
                              key={status}
                              onClick={() => setWorkerStatus(job.responseId, status)}
                              className="py-3 rounded-xl bg-foreground text-primary-foreground text-xs font-bold flex flex-col items-center gap-1 active:scale-[0.98] transition-all"
                            >
                              <Icon size={15} />
                              {step.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {job.workerStatus === "arrived" && (
                      <button
                        onClick={() => finishWork(job)}
                        className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-[0.98] transition-all"
                      >
                        Завершить работу
                      </button>
                    )}
                  </div>
                );
              })()}
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
