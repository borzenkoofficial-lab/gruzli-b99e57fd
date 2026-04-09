import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Users, Zap, Wallet, X, Train } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface NewJobAlertProps {
  job: Tables<"jobs"> | null;
  onRespond: (job: Tables<"jobs">) => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 30000;

const NewJobAlert = ({ job, onRespond, onDismiss }: NewJobAlertProps) => {
  const [timeLeft, setTimeLeft] = useState(AUTO_DISMISS_MS / 1000);

  useEffect(() => {
    if (!job) return;
    setTimeLeft(AUTO_DISMISS_MS / 1000);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [job, onDismiss]);

  if (!job) return null;

  const totalPay = job.hourly_rate * (Number(job.duration_hours) || 4);

  return (
    <AnimatePresence>
      <motion.div
        key={job.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(12px)" }}
      >
        <motion.div
          initial={{ scale: 0.85, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.85, y: 40 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="w-full max-w-sm neu-card rounded-3xl p-5 relative"
        >
          {/* Close */}
          <button onClick={onDismiss} className="absolute top-4 right-4 text-muted-foreground">
            <X size={20} />
          </button>

          {/* Timer bar */}
          <div className="w-full h-1 rounded-full bg-muted mb-4 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(195 100% 50%))" }}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
            />
          </div>

          {/* Header */}
          <div className="text-center mb-4">
            <span className="text-3xl">🆕</span>
            <h2 className="text-lg font-bold text-foreground mt-2">Новый заказ!</h2>
            <p className="text-xs text-muted-foreground">Автоскрытие через {timeLeft}с</p>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-3 justify-center flex-wrap">
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
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-foreground text-center mb-3">{job.title}</h3>

          {/* Pay */}
          <div className="neu-inset rounded-xl px-3 py-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground">Заработок</span>
              <span className="text-lg font-extrabold text-gradient-primary ml-auto">
                {totalPay.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {job.hourly_rate} ₽/час × {job.duration_hours || 4}ч
            </p>
          </div>

          {/* Details */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-5 flex-wrap justify-center">
            {job.address && (
              <span className="flex items-center gap-1"><MapPin size={11} /> {job.address}</span>
            )}
            {job.metro && (
              <span className="flex items-center gap-1"><Train size={11} /> {job.metro}</span>
            )}
            {job.start_time && (
              <span className="flex items-center gap-1">
                <Clock size={11} />{" "}
                {new Date(job.start_time).toLocaleString("ru-RU", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
            <span className="flex items-center gap-1"><Users size={11} /> {job.workers_needed} чел.</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-3 rounded-xl neu-raised-sm text-sm font-semibold text-muted-foreground active:neu-inset transition-all"
            >
              Пропустить
            </button>
            <button
              onClick={() => onRespond(job)}
              className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold active:scale-95 transition-all"
              style={{
                boxShadow: "6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)",
              }}
            >
              Откликнуться!
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewJobAlert;
