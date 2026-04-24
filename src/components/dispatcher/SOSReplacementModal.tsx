import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  job: any | null;
  workerId: string | null;
  workerName: string;
}

const SOSReplacementModal = ({ open, onClose, job, workerId, workerName }: Props) => {
  const { user } = useAuth();
  const [bonus, setBonus] = useState("100");
  const [posting, setPosting] = useState(false);

  const handleCreate = async () => {
    if (!user || !job) return;
    setPosting(true);
    const newRate = (job.hourly_rate || 0) + (parseInt(bonus) || 0);
    // mark original worker as no_show
    if (workerId) {
      await supabase.from("job_responses").update({ worker_status: "no_show", status: "rejected" } as any)
        .eq("job_id", job.id).eq("worker_id", workerId);
    }
    const { error } = await supabase.from("jobs").insert({
      dispatcher_id: user.id,
      title: `🚨 СРОЧНО: ${job.title}`,
      description: `СРОЧНАЯ ЗАМЕНА. Грузчик не вышел.\n\n${job.description || ""}`.trim(),
      hourly_rate: newRate,
      duration_hours: job.duration_hours,
      workers_needed: 1,
      metro: job.metro,
      address: job.address,
      urgent: true,
      quick_minimum: true,
      status: "active",
      replacement_for_job_id: job.id,
      replacement_for_worker_id: workerId,
      start_time: new Date().toISOString(),
    } as any);
    setPosting(false);
    if (error) {
      toast.error("Не удалось создать срочную заявку");
      return;
    }
    toast.success("🚨 Срочная заявка опубликована! Уведомлены все грузчики онлайн.");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && job && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card rounded-t-3xl p-5 border-t border-destructive/30"
          >
            <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
                <AlertTriangle size={18} /> SOS-замена
              </h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Грузчик <span className="font-semibold text-foreground">{workerName}</span> не вышел? Опубликуем срочную замену с приоритетом.
            </p>

            <div className="bg-surface-1 border border-border rounded-2xl p-3 mb-3 space-y-1">
              <p className="text-xs text-muted-foreground">Заявка</p>
              <p className="text-sm font-bold text-foreground">{job.title}</p>
              <p className="text-[11px] text-muted-foreground">{job.address || job.metro || ""} · {job.hourly_rate} ₽/ч</p>
            </div>

            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">💰 Бонус к ставке (для скорости)</label>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="number" value={bonus} onChange={(e) => setBonus(e.target.value)}
                className="flex-1 bg-surface-1 rounded-xl p-3 text-lg font-bold text-foreground border border-border outline-none"
              />
              <span className="text-sm text-muted-foreground">₽/ч</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Новая ставка: <span className="font-bold text-green-500">{(job.hourly_rate || 0) + (parseInt(bonus) || 0)} ₽/ч</span>
            </p>

            <button onClick={handleCreate} disabled={posting} className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all">
              {posting ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
              {posting ? "Публикую..." : "🚨 Опубликовать срочную замену"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SOSReplacementModal;
