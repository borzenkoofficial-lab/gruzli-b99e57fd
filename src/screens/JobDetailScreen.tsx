import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Users, Zap, MessageCircle, User, Wallet, UserPlus, Check, ShieldCheck, X, ShieldAlert, ChevronDown, AlignLeft } from "lucide-react";
import { useRespondToJob } from "@/hooks/useRespondToJob";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import gruzliLogo from "@/assets/gruzli-logo.jpeg";
import ReportFraudModal from "@/components/ReportFraudModal";

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
    const fetchName = async () => {
      const { data } = await supabase
        .from("profiles_public" as any)
        .select("full_name")
        .eq("user_id", job.dispatcher_id)
        .single();
      if (data) setDispatcherName((data as any).full_name || "Диспетчер");
    };
    fetchName();
  }, [job.dispatcher_id]);

  // Check if current user already responded
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("job_responses")
        .select("id, status")
        .eq("job_id", job.id)
        .eq("worker_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setResponseId(data.id);
        setResponseStatus(data.status);
      }
    })();
    return () => { cancelled = true; };
  }, [user, job.id]);

  const totalPay = job.hourly_rate * (Number(job.duration_hours) || 4);

  const handleRespond = async () => {
    if (responding) return;
    setResponding(true);
    const success = await respondAndOpenChat(job);
    if (success) {
      // Refresh response state
      const { data } = await supabase
        .from("job_responses")
        .select("id, status")
        .eq("job_id", job.id)
        .eq("worker_id", user!.id)
        .maybeSingle();
      if (data) {
        setResponseId(data.id);
        setResponseStatus(data.status);
      }
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
    const { error } = await supabase
      .from("job_responses")
      .update({ status: "withdrawn" })
      .eq("id", responseId);
    setWithdrawing(false);
    if (error) {
      toast.error("Не удалось отозвать отклик");
      return;
    }
    setResponseId(null);
    setResponseStatus(null);
    if (navigator.vibrate) navigator.vibrate(50);
    toast.success("Отклик отозван");
  };

  const hasPending = responseStatus === "pending";
  const isAccepted = responseStatus === "accepted";
  const responded = !!responseId && responseStatus !== "withdrawn" && responseStatus !== "rejected";

  const isOfficial = job.is_official;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground flex-1">Детали заказа</h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="px-5">
        {/* Official Gruzli banner */}
        {isOfficial && (
          <div
            className="mb-4 rounded-2xl p-4 border border-yellow-400/40 flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg, hsl(45 95% 55% / 0.18), hsl(38 90% 50% / 0.08))",
              boxShadow: "0 8px 24px -8px hsl(45 90% 55% / 0.35)",
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-yellow-400 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-yellow-500">
              <img src={gruzliLogo} alt="Gruzli" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">Официальная заявка</span>
                <ShieldCheck size={14} className="text-yellow-500" />
              </div>
              <p className="text-[11.5px] text-yellow-700/80 dark:text-yellow-300/70 leading-tight mt-0.5">
                От команды Gruzli — гарантированная оплата
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              {job.urgent && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/20 text-destructive text-[11px] font-semibold">
                  <Zap size={10} /> Срочно
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-foreground">{job.title}</h1>
            {isOfficial ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center overflow-hidden">
                  <img src={gruzliLogo} alt="Gruzli" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">Gruzli</span>
                <Check size={11} strokeWidth={3} className="text-yellow-500" />
              </div>
            ) : (
              <button
                onClick={() => onOpenProfile?.(job.dispatcher_id)}
                className="flex items-center gap-1.5 mt-1.5 active:opacity-70"
              >
                <UserPlus size={12} className="text-primary" />
                <span className="text-xs text-primary font-medium">{dispatcherName}</span>
              </button>
            )}
          </div>
        </div>

        {/* Earnings */}
        <div className="bg-surface-1 border border-border rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <span className="text-sm text-muted-foreground">Ты получишь</span>
            <span className="text-2xl font-extrabold text-bg-foreground ml-auto">{totalPay.toLocaleString("ru-RU")} ₽</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{job.hourly_rate} ₽/час × {job.duration_hours || 4}ч</p>
        </div>

        {job.description && (
          <div className="relative mb-5 rounded-2xl border border-border bg-card/60 p-4 pl-5 overflow-hidden">
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-2xl" />
            <div className="flex items-center gap-1.5 mb-2">
              <AlignLeft size={13} className="text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Описание</span>
            </div>
            <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {job.description}
            </p>
          </div>
        )}

        {/* Safety / anti-fraud tip for workers */}
        {!isOfficial && !safetyDismissed && (
          <div
            className="mb-5 rounded-2xl border border-amber-500/30 overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, hsl(38 95% 55% / 0.12), hsl(20 90% 50% / 0.04))",
            }}
          >
            <button
              type="button"
              onClick={() => setSafetyOpen((v) => !v)}
              className="w-full flex items-center gap-3 p-3.5 text-left active:opacity-80"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                <ShieldAlert size={16} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground">Как не нарваться на мошенников</p>
                <p className="text-[11px] text-muted-foreground">3 простых правила безопасности</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-muted-foreground transition-transform ${safetyOpen ? "rotate-180" : ""}`}
              />
            </button>
            {safetyOpen && (
              <div className="px-4 pb-4 pt-1 space-y-2.5">
                {[
                  "Проверяйте рейтинг и отзывы диспетчера перед откликом.",
                  "Если не уверены — попросите аванс до начала работы.",
                  "Договоритесь с диспетчером, чтобы клиент перевёл оплату напрямую вам.",
                ].map((tip, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-amber-500">{i + 1}</span>
                    </div>
                    <p className="text-[12.5px] text-foreground/90 leading-snug flex-1">{tip}</p>
                  </div>
                ))}
                <button
                  onClick={() => {
                    localStorage.setItem("job_safety_tip_dismissed", "1");
                    setSafetyDismissed(true);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground active:opacity-70 mt-1"
                >
                  Больше не показывать
                </button>
              </div>
            )}
          </div>
        )}


        {/* Details */}
        <div className="space-y-3 mb-6">
          {[
            job.address && { icon: MapPin, label: "Адрес", value: job.address },
            job.start_time && { icon: Clock, label: "Дата и время", value: new Date(job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) },
            { icon: Users, label: "Грузчиков", value: `${job.workers_needed || 1} человек` },
          ].filter(Boolean).map((detail: any) => (
            <div key={detail.label} className="flex items-center gap-3 p-3.5 bg-card rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0">
                <detail.icon size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{detail.label}</p>
                <p className="text-sm text-foreground font-medium">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleRespond}
            disabled={responding || responded}
            className={`flex-1 py-3.5 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all ${
              responded
                ? isAccepted
                  ? "bg-online/20 text-online"
                  : "bg-primary/15 text-primary"
                : "bg-foreground text-primary-foreground"
            }`}
            style={!responded ? {
              boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)',
            } : {}}
          >
            {responding
              ? "Отправка..."
              : isAccepted
                ? "✓ Вы выбраны"
                : hasPending
                  ? "✓ Отклик отправлен"
                  : "Откликнуться"}
          </button>
          {hasPending && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="px-4 py-3.5 rounded-2xl bg-card border border-destructive/40 text-destructive text-sm font-bold flex items-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50"
              title="Отозвать отклик"
            >
              <X size={14} /> {withdrawing ? "..." : "Отозвать"}
            </button>
          )}
        </div>

        {!isOfficial && (
          <button
            onClick={() => setReportOpen(true)}
            className="mt-4 w-full py-3 rounded-2xl bg-card border border-destructive/30 text-destructive text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <ShieldAlert size={14} /> Пожаловаться на мошенников
          </button>
        )}
      </motion.div>

      <ReportFraudModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        jobId={job.id}
        dispatcherId={job.dispatcher_id}
      />
    </div>
  );
};

export default JobDetailScreen;
