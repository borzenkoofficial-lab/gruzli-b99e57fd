import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, FileText, DollarSign, Clock, MapPin, Train, Users, Zap, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface EditJobModalProps {
  job: Tables<"jobs">;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Tables<"jobs">) => void;
}

const Field = ({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[13px] font-semibold text-foreground/80 flex items-center gap-1.5">
      <Icon size={13} className="text-muted-foreground" /> {label}
    </label>
    {children}
  </div>
);

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-2xl px-4 py-3.5">{children}</div>
);

export default function EditJobModal({ job, open, onClose, onSaved }: EditJobModalProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(job.title || "");
  const [description, setDescription] = useState(job.description || "");
  const [hourlyRate, setHourlyRate] = useState(String(job.hourly_rate || ""));
  const [durationHours, setDurationHours] = useState(String(job.duration_hours || "4"));
  const [workersNeeded, setWorkersNeeded] = useState(String(job.workers_needed || "2"));
  const [address, setAddress] = useState(job.address || "");
  const [metro, setMetro] = useState(job.metro || "");
  const [startTime, setStartTime] = useState(
    job.start_time ? new Date(job.start_time).toISOString().slice(0, 16) : ""
  );
  const [urgent, setUrgent] = useState(!!job.urgent);
  const [quickMinimum, setQuickMinimum] = useState(!!job.quick_minimum);

  const handleSave = async () => {
    if (!title.trim() || !hourlyRate) {
      toast.error("Заполните название и оплату");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase
      .from("jobs")
      .update({
        title: title.trim(),
        description: description.trim(),
        hourly_rate: parseInt(hourlyRate),
        duration_hours: parseFloat(durationHours) || 4,
        workers_needed: parseInt(workersNeeded) || 2,
        address: address.trim(),
        metro: metro.trim(),
        start_time: startTime ? new Date(startTime).toISOString() : null,
        urgent,
        quick_minimum: quickMinimum,
        status: "active",
      })
      .eq("id", job.id)
      .select()
      .single();

    setLoading(false);

    if (error || !data) {
      toast.error("Не удалось обновить заявку");
      return;
    }
    toast.success("Заявка обновлена и опубликована заново");
    onSaved(data);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-background border-t sm:border border-border sm:rounded-3xl rounded-t-3xl flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Редактировать заявку</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              <Field label="Название" icon={FileText}>
                <Box>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent text-sm text-foreground outline-none"
                  />
                </Box>
              </Field>

              <Field label="Описание" icon={FileText}>
                <Box>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-transparent text-sm text-foreground outline-none resize-none"
                  />
                </Box>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Оплата ₽/ч" icon={DollarSign}>
                  <Box>
                    <input
                      type="number"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      className="w-full bg-transparent text-sm text-foreground outline-none"
                    />
                  </Box>
                </Field>

                <Field label="Длительность" icon={Clock}>
                  <Box>
                    <input
                      type="number"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      min="1"
                      step="0.5"
                      className="w-full bg-transparent text-sm text-foreground outline-none"
                    />
                  </Box>
                </Field>
              </div>

              <Field label="Количество грузчиков" icon={Users}>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setWorkersNeeded(String(n))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                        workersNeeded === String(n)
                          ? "bg-foreground text-primary-foreground"
                          : "bg-card border border-border text-muted-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Дата и время" icon={Clock}>
                <Box>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-transparent text-sm text-foreground outline-none"
                  />
                </Box>
              </Field>

              <Field label="Адрес" icon={MapPin}>
                <Box>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-transparent text-sm text-foreground outline-none"
                  />
                </Box>
              </Field>

              <Field label="Метро" icon={Train}>
                <Box>
                  <input
                    value={metro}
                    onChange={(e) => setMetro(e.target.value)}
                    className="w-full bg-transparent text-sm text-foreground outline-none"
                  />
                </Box>
              </Field>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setUrgent(!urgent)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold ${
                    urgent
                      ? "bg-destructive/15 text-destructive border border-destructive/30"
                      : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  <Zap size={14} /> Срочно
                </button>
                <button
                  type="button"
                  onClick={() => setQuickMinimum(!quickMinimum)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold ${
                    quickMinimum
                      ? "bg-[hsl(var(--online))]/15 text-[hsl(var(--online))] border border-[hsl(var(--online))]/30"
                      : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  <Sparkles size={14} /> Минималка
                </button>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border">
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-primary-foreground font-bold text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? "Сохраняю..." : "Сохранить и переопубликовать"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
