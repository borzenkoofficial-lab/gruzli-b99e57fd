import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Clock, MapPin, Train, Users, FileText, Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CreateJobScreenProps {
  onBack: () => void;
  onCreated: () => void;
}

const Field = ({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
      <Icon size={12} /> {label}
    </label>
    {children}
  </div>
);

const CreateJobScreen = ({ onBack, onCreated }: CreateJobScreenProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState("4");
  const [address, setAddress] = useState("");
  const [metro, setMetro] = useState("");
  const [workersNeeded, setWorkersNeeded] = useState("2");
  const [urgent, setUrgent] = useState(false);
  const [quickMinimum, setQuickMinimum] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !hourlyRate) {
      toast.error("Заполните название и оплату");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("jobs").insert({
      dispatcher_id: user.id,
      title: title.trim(),
      description: description.trim(),
      hourly_rate: parseInt(hourlyRate),
      start_time: startTime ? new Date(startTime).toISOString() : null,
      duration_hours: parseFloat(durationHours) || 4,
      address: address.trim(),
      metro: metro.trim(),
      workers_needed: parseInt(workersNeeded) || 2,
      urgent,
      quick_minimum: quickMinimum,
    });

    if (error) {
      toast.error("Ошибка создания заявки");
    } else {
      toast.success("Заявка создана!");
      onCreated();
    }
    setLoading(false);
  };


  return (
    <div className="fixed inset-0 bg-background flex flex-col" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      <div className="flex items-center gap-3 px-4 safe-top pb-4 flex-shrink-0">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Создать заявку</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 space-y-4 flex-1 overflow-y-auto pb-8 overscroll-contain">
        <Field label="Название заявки" icon={FileText}>
          <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Переезд 2-комнатной квартиры" className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" required />
          </div>
        </Field>

        <Field label="Описание работы" icon={FileText}>
          <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Опишите, что нужно сделать..." rows={3} className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
          </div>
        </Field>

        <Field label="Оплата за час (₽)" icon={DollarSign}>
          <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
            <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="300" className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" required />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата и время начала" icon={Clock}>
            <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-transparent text-sm text-foreground outline-none" />
            </div>
          </Field>

          <Field label="Длительность (часов)" icon={Clock}>
            <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
              <input type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} min="1" max="24" step="0.5" className="w-full bg-transparent text-sm text-foreground outline-none" />
            </div>
          </Field>
        </div>

        <Field label="Адрес" icon={MapPin}>
          <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. Ленина, 45" className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
        </Field>

        <Field label="Станция метро" icon={Train}>
          <div className="bg-surface-1 border border-border rounded-xl px-4 py-3">
            <input value={metro} onChange={(e) => setMetro(e.target.value)} placeholder="Площадь Революции" className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
        </Field>

        <Field label="Сколько грузчиков" icon={Users}>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setWorkersNeeded(n.toString())}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  workersNeeded === n.toString() ? "bg-foreground text-primary-foreground" : "bg-card border border-border text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        {/* Toggles */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setUrgent(!urgent)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              urgent ? "bg-destructive/20 text-destructive" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            <Zap size={14} /> Срочно
          </button>
          <button
            type="button"
            onClick={() => setQuickMinimum(!quickMinimum)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              quickMinimum ? "bg-online/20 text-online" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            ⚡ Быстрая минималка
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 tap-scale disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Опубликовать заявку"}
        </button>
      </form>
    </div>
  );
};

export default CreateJobScreen;
