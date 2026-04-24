import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Target, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ChecklistItem { id: string; text: string; done: boolean }

interface Props {
  open: boolean;
  onClose: () => void;
  todayProfit: number;
  weekProfit: number;
}

const todayDate = () => new Date().toISOString().slice(0, 10);

const GoalsModal = ({ open, onClose, todayProfit, weekProfit }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dayGoal, setDayGoal] = useState("");
  const [weekGoal, setWeekGoal] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("dispatcher_goals")
        .select("*")
        .eq("dispatcher_id", user.id)
        .maybeSingle();
      if (data) {
        setDayGoal(String(data.daily_profit_goal || ""));
        setWeekGoal(String(data.weekly_profit_goal || ""));
        const stillToday = data.checklist_date === todayDate();
        setChecklist(stillToday ? ((data.checklist as any) || []) : []);
      }
      setLoading(false);
    };
    load();
  }, [open, user?.id]);

  const persist = async (next: { day?: string; week?: string; list?: ChecklistItem[] }) => {
    if (!user) return;
    const payload: any = {
      dispatcher_id: user.id,
      daily_profit_goal: parseInt(next.day ?? dayGoal) || 0,
      weekly_profit_goal: parseInt(next.week ?? weekGoal) || 0,
      checklist: next.list ?? checklist,
      checklist_date: todayDate(),
    };
    const { error } = await supabase.from("dispatcher_goals").upsert(payload, { onConflict: "dispatcher_id" });
    if (error) toast.error("Не удалось сохранить");
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    const next = [...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }];
    setChecklist(next);
    setNewItem("");
    persist({ list: next });
  };

  const toggleItem = (id: string) => {
    const next = checklist.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    setChecklist(next);
    persist({ list: next });
  };

  const removeItem = (id: string) => {
    const next = checklist.filter((i) => i.id !== id);
    setChecklist(next);
    persist({ list: next });
  };

  const dayGoalNum = parseInt(dayGoal) || 0;
  const weekGoalNum = parseInt(weekGoal) || 0;
  const dayPct = dayGoalNum > 0 ? Math.min(100, Math.round((todayProfit / dayGoalNum) * 100)) : 0;
  const weekPct = weekGoalNum > 0 ? Math.min(100, Math.round((weekProfit / weekGoalNum) * 100)) : 0;
  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-card px-5 pt-3 pb-2 border-b border-border z-10">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Target size={18} className="text-primary" /> Цели и план
                </h3>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Day goal */}
                <div className="bg-surface-1 border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">🎯 Цель на день</span>
                    <span className="text-[11px] text-muted-foreground">{todayProfit.toLocaleString("ru-RU")} / {dayGoalNum.toLocaleString("ru-RU")} ₽</span>
                  </div>
                  <input
                    type="number" value={dayGoal}
                    onChange={(e) => setDayGoal(e.target.value)}
                    onBlur={() => persist({ day: dayGoal })}
                    placeholder="Введите цель в ₽"
                    className="w-full bg-card rounded-lg p-2.5 text-sm font-bold text-foreground border border-border outline-none mb-2"
                  />
                  <div className="h-2 bg-card rounded-full overflow-hidden">
                    <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${dayPct}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{dayPct}% выполнено</p>
                </div>

                {/* Week goal */}
                <div className="bg-surface-1 border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">📆 Цель на неделю</span>
                    <span className="text-[11px] text-muted-foreground">{weekProfit.toLocaleString("ru-RU")} / {weekGoalNum.toLocaleString("ru-RU")} ₽</span>
                  </div>
                  <input
                    type="number" value={weekGoal}
                    onChange={(e) => setWeekGoal(e.target.value)}
                    onBlur={() => persist({ week: weekGoal })}
                    placeholder="Введите цель в ₽"
                    className="w-full bg-card rounded-lg p-2.5 text-sm font-bold text-foreground border border-border outline-none mb-2"
                  />
                  <div className="h-2 bg-card rounded-full overflow-hidden">
                    <motion.div className="h-full bg-green-500" initial={{ width: 0 }} animate={{ width: `${weekPct}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{weekPct}% выполнено</p>
                </div>

                {/* Checklist */}
                <div className="bg-surface-1 border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground">✅ План на сегодня</span>
                    <span className="text-[11px] text-muted-foreground">{doneCount}/{checklist.length}</span>
                  </div>
                  <div className="space-y-1.5 mb-2">
                    {checklist.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Добавьте задачи на день</p>
                    )}
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 group">
                        <button
                          onClick={() => toggleItem(item.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${item.done ? "bg-primary border-primary" : "border-border bg-card"}`}
                        >
                          {item.done && <Check size={12} className="text-primary-foreground" />}
                        </button>
                        <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</span>
                        <button onClick={() => removeItem(item.id)} className="text-muted-foreground/50 active:text-destructive p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                      placeholder="Новая задача..."
                      className="flex-1 bg-card rounded-lg p-2 text-sm text-foreground border border-border outline-none"
                    />
                    <button onClick={addItem} className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoalsModal;
