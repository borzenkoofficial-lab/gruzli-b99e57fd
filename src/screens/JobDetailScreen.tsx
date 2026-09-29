import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Clock, Users, Zap, MessageCircle, UserPlus,
  Check, ShieldCheck, X, ShieldAlert, ChevronDown, AlignLeft, Wallet,
  CalendarDays, Navigation, CircleDollarSign
} from "lucide-react";
import { useRespondToJob } from "@/hooks/useRespondToJob";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";
import ReportFraudModal from "@/components/ReportFraudModal";
import MetroBadge from "@/components/MetroBadge";

interface JobDetailScreenProps {
  job: Tables<"jobs"> & { is_official?: boolean };
  onBack: () => void;
  onOpenChat?: (conversationId: string, title: string) => void;
  onOpenProfile?: (userId: string) => void;
}

const JobDetailScreen = ({ job, onBack, onOpenChat, onOpenProfile }: JobDetailScreenProps) => {
  const { user } = useAuth();
  const { respondAndOpenChat } = useRespondToJob(onOpenChat);
  const [responding, setResponding] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyDismissed, setSafetyDismissed] = useState(() => localStorage.getItem("job_safety_tip_dismissed") === "1");
  const [reportOpen, setReportOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [dispatcherName, setDispatcherName] = useState("Диспетчер");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!job.dispatcher_id) return;
      const { data } = await supabase.from("profiles_public" as any).select("full_name").eq("user_id", job.dispatcher_id).single();
      if (!cancelled && data) setDispatcherName((data as any).full_name || "Диспетчер");
    })();
    return () => { cancelled = true; };
  }, [job.dispatcher_id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("job_responses").select("id, status").eq("job_id", job.id).eq("worker_id", user.id).maybeSingle();
      if (!cancelled && data) {
        setResponseId(data.id);
        setResponseStatus(data.status);
      }
    })();
    return () => { cancelled = true; };
  }, [user, job.id]);

  const totalPay = job.hourly_rate * (Number(job.duration_hours) || 4);
  const hasPending = responseStatus === "pending";
  const isAccepted = responseStatus === "accepted";
  const responded = !!responseId && responseStatus !== "withdrawn" && responseStatus !== "rejected";
  const isOfficial = job.is_official;
  const dateLabel = job.start_time
    ? new Date(job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "long" })
    : "Сегодня";
  const timeLabel = job.start_time
    ? new Date(job.start_time).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "Уточняется";

  const handleRespond = async () => {
    if (responding) return;
    setResponding(true);
    const success = await respondAndOpenChat(job);
    if (success) {
      const { data } = await supabase.from("job_responses").select("id, status").eq("job_id", job.id).eq("worker_id", user!.id).maybeSingle();
      if (data) { setResponseId(data.id); setResponseStatus(data.status); }
    }
    setResponding(false);
  };

  const handleWithdraw = async () => {
    if (!responseId || withdrawing) return;
    if (responseStatus === "accepted") {
      toast.error("Нельзя отозвать — диспетчер уже выбрал вас");
      return;
    }
    setWithdrawing(true);
    const { error } = await supabase.rpc("worker_withdraw_response", { _response_id: responseId });
    setWithdrawing(false);
    if (error) {
      toast.error(error.code === "P0001" ? "Этот отклик уже нельзя отозвать" : "Не удалось отозвать отклик");
      return;
    }
    setResponseId(null);
    setResponseStatus(null);
    if (navigator.vibrate) navigator.vibrate(50);
    toast.success("Отклик отозван");
  };

  return (
    <div className="gruzli-job-detail app-scroll min-h-screen bg-background pb-36 native-surface">
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur-2xl">
        <button onClick={onBack} aria-label="Назад" className="native-press grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-card shadow-sm">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-extrabold uppercase tracking-[.16em] text-muted-foreground">GRUZLI / ORDER</p>
          <p className="truncate text-[15px] font-extrabold tracking-[-.02em]">Детали заявки</p>
        </div>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[9px] font-bold text-muted-foreground">
          {isOfficial ? "OFFICIAL" : "ОТКРЫТА"}
        </span>
      </div>

      <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }} className="mx-auto w-full max-w-2xl px-4 pt-4">
        {isOfficial && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-yellow-400/35 bg-yellow-400/10 p-3">
            <img src={gruzliLogo} alt="Gruzli" className="h-10 w-10 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-yellow-700 dark:text-yellow-300">
                Официальная заявка <ShieldCheck size={13} />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Публикация от команды Gruzli</p>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
          <div className="relative p-5 pb-4">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {job.urgent && <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/12 px-2.5 py-1 text-[10px] font-bold text-destructive"><Zap size={10} /> СРОЧНО</span>}
                {job.quick_minimum && <span className="rounded-lg border border-online/20 bg-online/10 px-2.5 py-1 text-[10px] font-bold text-online">БЫСТРАЯ МИНИМАЛКА</span>}
                <span className="rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">№ {job.id.slice(0, 6).toUpperCase()}</span>
              </div>
              <h1 className="max-w-xl text-[29px] font-extrabold leading-[1.03] tracking-[-.05em] text-foreground">{job.title}</h1>
              <button onClick={() => !isOfficial && job.dispatcher_id ? onOpenProfile?.(job.dispatcher_id) : undefined} className="native-press mt-3 flex items-center gap-2 text-left">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-[10px] font-extrabold text-background">
                  {isOfficial ? <img src={gruzliLogo} alt="" className="h-full w-full rounded-full object-cover" /> : dispatcherName.slice(0, 1)}
                </span>
                <span>
                  <span className="block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Диспетчер</span>
                  <span className="flex items-center gap-1 text-[12px] font-bold">{isOfficial ? "Gruzli" : dispatcherName} {isOfficial && <Check size={11} className="text-primary" />}</span>
                </span>
                {!isOfficial && <UserPlus size={13} className="ml-1 text-primary" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-border/70">
            <div className="p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-muted-foreground">ЗАРАБОТОК</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[27px] font-extrabold tracking-[-.05em]">{totalPay.toLocaleString("ru-RU")}</span>
                <span className="text-xs font-bold text-muted-foreground">₽</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{job.hourly_rate.toLocaleString("ru-RU")} ₽/ч × {job.duration_hours || 4} ч</p>
            </div>
            <div className="border-l border-border/70 p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-muted-foreground">КОМАНДА</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[27px] font-extrabold tracking-[-.05em]">{job.workers_needed || 1}</span>
                <span className="text-xs font-bold text-muted-foreground">чел.</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Нужно на объект</p>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[24px] border border-border/70 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-muted-foreground">КОГДА И ГДЕ</p>
              <h2 className="mt-1 text-[15px] font-extrabold">Выход на объект</h2>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Navigation size={16} /></div>
          </div>
          <div className="relative pl-8">
            <div className="absolute bottom-4 left-[11px] top-4 w-px bg-border" />
            <div className="relative mb-4 flex gap-3">
              <span className="absolute -left-8 top-1 grid h-6 w-6 place-items-center rounded-full border-4 border-card bg-primary" />
              <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">МЕСТО</p>{job.metro && <MetroBadge value={job.metro} className="mt-1" />}<p className="mt-1 text-[14px] font-bold">{job.address || (!job.metro ? "Москва" : "")}</p></div>
            </div>
            <div className="relative flex gap-3">
              <span className="absolute -left-8 top-1 grid h-6 w-6 place-items-center rounded-full border-4 border-card bg-foreground" />
              <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">ВЫХОД</p><p className="text-[14px] font-bold">{dateLabel} · {timeLabel}</p><p className="text-[10px] text-muted-foreground">{job.duration_hours || 4} часа работы</p></div>
            </div>
          </div>
        </section>

        {job.description && (
          <section className="mt-3 rounded-[24px] border border-border/70 bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><AlignLeft size={15} className="text-primary" /><h2 className="text-[14px] font-extrabold">Что нужно сделать</h2></div>
            <p className="whitespace-pre-wrap break-words text-[14px] leading-6 text-foreground/90">{job.description}</p>
          </section>
        )}

        <section className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-[22px] border border-border/70 bg-card p-4">
            <CalendarDays size={16} className="text-primary" />
            <p className="mt-3 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Дата</p>
            <p className="mt-1 text-[13px] font-bold">{dateLabel}</p>
          </div>
          <div className="rounded-[22px] border border-border/70 bg-card p-4">
            <CircleDollarSign size={16} className="text-primary" />
            <p className="mt-3 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Ставка</p>
            <p className="mt-1 text-[13px] font-bold">{job.hourly_rate.toLocaleString("ru-RU")} ₽/час</p>
          </div>
        </section>

        {!isOfficial && !safetyDismissed && (
          <section className="mt-3 overflow-hidden rounded-[22px] border border-amber-500/25 bg-amber-500/5">
            <button type="button" onClick={() => setSafetyOpen(v => !v)} className="native-press flex w-full items-center gap-3 p-4 text-left">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10"><ShieldAlert size={16} className="text-amber-500" /></div>
              <div className="min-w-0 flex-1"><p className="text-[12px] font-bold">Безопасность сделки</p><p className="text-[10px] text-muted-foreground">Проверьте условия до выхода</p></div>
              <ChevronDown size={15} className={`text-muted-foreground transition-transform ${safetyOpen ? "rotate-180" : ""}`} />
            </button>
            {safetyOpen && <div className="space-y-2 border-t border-amber-500/15 px-4 pb-4 pt-3">{[
              "Проверьте рейтинг и отзывы диспетчера.",
              "До выхода согласуйте ставку, время и адрес.",
              "Не передавайте документы и деньги неизвестным лицам."
            ].map((tip, i) => <div key={i} className="flex gap-2.5 text-[11px] leading-5"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500/10 text-[9px] font-bold text-amber-600">{i + 1}</span><span>{tip}</span></div>)}
              <button onClick={() => { localStorage.setItem("job_safety_tip_dismissed", "1"); setSafetyDismissed(true); }} className="mt-1 text-[10px] font-semibold text-muted-foreground">Больше не показывать</button>
            </div>}
          </section>
        )}

        {!isOfficial && (
          <button onClick={() => setReportOpen(true)} className="native-press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 py-3 text-[11px] font-bold text-destructive">
            <ShieldAlert size={13} /> Пожаловаться на заявку
          </button>
        )}
      </motion.main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2 rounded-[24px] border border-border bg-background/90 p-2 shadow-[0_-8px_35px_rgba(0,0,0,.12)] backdrop-blur-2xl">
          {responded ? (
            <div className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[17px] text-[13px] font-extrabold ${isAccepted ? "bg-online/15 text-online" : "bg-primary/12 text-primary"}`}>
              <Check size={16} strokeWidth={3} /> {isAccepted ? "Вы выбраны" : "Отклик отправлен"}
            </div>
          ) : (
            <button onClick={handleRespond} disabled={responding} className="native-press min-h-[52px] flex-1 rounded-[17px] bg-foreground px-5 text-[14px] font-extrabold text-background shadow-lg disabled:opacity-60">
              {responding ? "Отправляем..." : "Откликнуться на заявку"}
            </button>
          )}
          {hasPending && <button onClick={handleWithdraw} disabled={withdrawing} className="native-press grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[17px] border border-destructive/25 bg-card text-destructive disabled:opacity-50" aria-label="Отозвать отклик"><X size={17} /></button>}
        </div>
      </div>

      <ReportFraudModal open={reportOpen} onClose={() => setReportOpen(false)} jobId={job.id} dispatcherId={job.dispatcher_id ?? undefined} />
    </div>
  );
};

export default JobDetailScreen;
