import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, Clock, MapPin, Train, Users, FileText, Loader2, DollarSign, Info, ChevronDown, Sparkles, AlertCircle, Eye, Wallet, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CreateJobScreenProps {
  onBack: () => void;
  onCreated: () => void;
}

const JOB_POSTING_FEE = 20;

const Section = ({ title, icon: Icon, hint, children }: { title: string; icon: any; hint?: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="space-y-2"
  >
    <div className="flex items-center justify-between">
      <label className="text-[13px] font-semibold text-foreground/80 flex items-center gap-1.5">
        <Icon size={13} className="text-muted-foreground" /> {title}
      </label>
      {hint && (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info size={10} /> {hint}
        </span>
      )}
    </div>
    {children}
  </motion.div>
);

const InputBox = ({ children, focused }: { children: React.ReactNode; focused?: boolean }) => (
  <div className={`bg-card border rounded-2xl px-4 py-3.5 transition-all duration-200 ${focused ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border"}`}>
    {children}
  </div>
);

const CreateJobScreen = ({ onBack, onCreated }: CreateJobScreenProps) => {
  const { user, profile } = useAuth();
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const balance = profile?.balance || 0;
  const canAfford = balance >= JOB_POSTING_FEE;
  const totalCost = parseInt(hourlyRate || "0") * parseFloat(durationHours || "0") * parseInt(workersNeeded || "0");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !hourlyRate) {
      toast.error("Заполните название и оплату");
      return;
    }
    if (!canAfford) {
      toast.error(`Недостаточно средств. Нужно ${JOB_POSTING_FEE} ₽, на балансе ${balance} ₽`);
      return;
    }

    setLoading(true);
    const { error: feeError } = await supabase
      .from("profiles")
      .update({ balance: balance - JOB_POSTING_FEE })
      .eq("user_id", user.id);

    if (feeError) {
      toast.error("Ошибка списания");
      setLoading(false);
      return;
    }

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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-3 flex-shrink-0">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:scale-95 transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Новая заявка</h1>
          <p className="text-[11px] text-muted-foreground -mt-0.5">Заполните детали работы</p>
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-1.5">
          <DollarSign size={12} className="text-muted-foreground" />
          <span className={`text-xs font-bold ${canAfford ? "text-foreground" : "text-destructive"}`}>{balance} ₽</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 flex-1 overflow-y-auto pb-8 overscroll-contain">
        <div className="space-y-5">
          {/* Title */}
          <Section title="Название" icon={FileText} hint="Кратко и понятно">
            <InputBox focused={focusedField === "title"}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => setFocusedField("title")}
                onBlur={() => setFocusedField(null)}
                placeholder="Например: Переезд 2-комн. квартиры"
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                required
              />
            </InputBox>
          </Section>

          {/* Description */}
          <Section title="Описание" icon={FileText} hint="Необязательно">
            <InputBox focused={focusedField === "desc"}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setFocusedField("desc")}
                onBlur={() => setFocusedField(null)}
                placeholder="Что нужно сделать, особенности, этаж, лифт..."
                rows={3}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none"
              />
            </InputBox>
          </Section>

          {/* Payment + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <Section title="Оплата/час" icon={DollarSign}>
              <InputBox focused={focusedField === "rate"}>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    onFocus={() => setFocusedField("rate")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="300"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                    required
                  />
                  <span className="text-xs text-muted-foreground shrink-0">₽/ч</span>
                </div>
              </InputBox>
            </Section>

            <Section title="Длительность" icon={Clock}>
              <InputBox focused={focusedField === "dur"}>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    onFocus={() => setFocusedField("dur")}
                    onBlur={() => setFocusedField(null)}
                    min="1"
                    max="24"
                    step="0.5"
                    className="w-full bg-transparent text-sm text-foreground outline-none"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">ч</span>
                </div>
              </InputBox>
            </Section>
          </div>

          {/* Workers selector */}
          <Section title="Количество грузчиков" icon={Users}>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <motion.button
                  key={n}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setWorkersNeeded(n.toString())}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                    workersNeeded === n.toString()
                      ? "bg-foreground text-primary-foreground shadow-lg"
                      : "bg-card border border-border text-muted-foreground hover:border-foreground/20"
                  }`}
                >
                  {n}
                </motion.button>
              ))}
            </div>
          </Section>

          {/* Tags: urgent + quick */}
          <div className="flex gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setUrgent(!urgent)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                urgent
                  ? "bg-destructive/15 text-destructive border border-destructive/30"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <Zap size={15} className={urgent ? "fill-current" : ""} /> Срочно
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setQuickMinimum(!quickMinimum)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                quickMinimum
                  ? "bg-[hsl(var(--online))]/15 text-[hsl(var(--online))] border border-[hsl(var(--online))]/30"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <Sparkles size={15} /> Минималка
            </motion.button>
          </div>

          {/* Advanced toggle */}
          <motion.button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
          >
            <span>Адрес и метро</span>
            <motion.div animate={{ rotate: showAdvanced ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden space-y-4"
              >
                <Section title="Адрес" icon={MapPin}>
                  <InputBox focused={focusedField === "addr"}>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onFocus={() => setFocusedField("addr")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="ул. Ленина, 45"
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                    />
                  </InputBox>
                </Section>

                <Section title="Дата и время начала" icon={Clock}>
                  <InputBox focused={focusedField === "time"}>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      onFocus={() => setFocusedField("time")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full bg-transparent text-sm text-foreground outline-none"
                    />
                  </InputBox>
                </Section>

                <Section title="Станция метро" icon={Train}>
                  <InputBox focused={focusedField === "metro"}>
                    <input
                      value={metro}
                      onChange={(e) => setMetro(e.target.value)}
                      onFocus={() => setFocusedField("metro")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Площадь Революции"
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                    />
                  </InputBox>
                </Section>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-4 space-y-3"
          >
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Итого</div>
            
            <div className="space-y-2">
              {totalCost > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Оплата грузчикам</span>
                  <span className="text-[13px] font-semibold text-foreground">~{totalCost.toLocaleString()} ₽</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Публикация заявки</span>
                <span className="text-[13px] font-semibold text-foreground">{JOB_POSTING_FEE} ₽</span>
              </div>
              <div className="border-t border-border my-1" />
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Ваш баланс</span>
                <span className={`text-[13px] font-bold ${canAfford ? "text-foreground" : "text-destructive"}`}>{balance} ₽</span>
              </div>
            </div>

            {!canAfford && (
              <div className="flex items-center gap-2 bg-destructive/10 rounded-xl px-3 py-2">
                <AlertCircle size={14} className="text-destructive shrink-0" />
                <span className="text-xs text-destructive">Недостаточно средств для публикации</span>
              </div>
            )}
          </motion.div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading || !canAfford}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all shadow-lg"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Sparkles size={15} />
                Опубликовать за {JOB_POSTING_FEE} ₽
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default CreateJobScreen;
