import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Bell, Filter } from "lucide-react";
import {
  CATEGORIES,
  type CategoryKey,
  loadSubscribedCategories,
  saveSubscribedCategories,
} from "@/lib/jobCategories";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (cats: CategoryKey[]) => void;
  /** true → показывает вводный «первый раз» вариант с приветствием */
  firstRun?: boolean;
}

const CategorySubscriptionModal = ({ open, onClose, onSaved, firstRun }: Props) => {
  const [selected, setSelected] = useState<CategoryKey[]>([]);

  useEffect(() => {
    if (open) {
      const stored = loadSubscribedCategories();
      setSelected(stored ?? CATEGORIES.map((c) => c.key));
    }
  }, [open]);

  const toggle = (key: CategoryKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelected(CATEGORIES.map((c) => c.key));

  const save = () => {
    if (selected.length === 0) {
      toast.error("Выберите хотя бы одну категорию");
      return;
    }
    saveSubscribedCategories(selected);
    toast.success("Подписка обновлена");
    onSaved?.(selected);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-[0_-8px_40px_-4px_rgba(0,0,0,0.5)]"
          >
            {/* Decorative gradient header */}
            <div className="relative px-5 pt-6 pb-4 overflow-hidden">
              <div className="absolute inset-0 bg-primary/5" />
              <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-online/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-foreground/10 blur-3xl" />

              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-foreground/10 text-[10.5px] font-semibold text-foreground mb-2">
                    <Bell size={10} />
                    Подписка на вакансии
                  </div>
                  <h2 className="text-xl font-bold text-foreground tracking-tight leading-snug">
                    {firstRun ? "Кем вы работаете?" : "Настройте ленту"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {firstRun
                      ? "Выберите категории — покажем только те заявки, что вам подходят."
                      : "Отметьте, какие заявки хотите видеть в ленте."}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="shrink-0 h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-foreground/30 transition-colors"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Category list */}
            <div className="px-4 pb-3 space-y-2 max-h-[52vh] overflow-y-auto">
              {CATEGORIES.map((c) => {
                const active = selected.includes(c.key);
                const Icon = c.icon;
                return (
                  <motion.button
                    key={c.key}
                    layout
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggle(c.key)}
                    className={`w-full relative flex items-center gap-3 p-3 rounded-2xl border transition-all overflow-hidden text-left ${
                      active
                        ? "border-foreground/30 bg-card"
                        : "border-border bg-card/60 hover:border-foreground/15"
                    }`}
                    style={
                      active
                        ? {
                            boxShadow: "inset 0 0 0 1px hsl(var(--primary) / 0.28), 0 4px 16px -8px hsl(var(--primary) / 0.18)",
                            background: "hsl(var(--primary) / 0.06)",
                          }
                        : undefined
                    }
                  >
                    <div
                      className="shrink-0 h-11 w-11 rounded-xl bg-foreground flex items-center justify-center text-background shadow-sm"
                    >
                      <Icon size={20} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-semibold text-foreground">
                          {c.label}
                        </span>
                        <span className="text-sm">{c.emoji}</span>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                        {c.description}
                      </p>
                    </div>
                    <div
                      className={`shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        active
                          ? "bg-foreground border-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {active && (
                        <Check size={14} className="text-background" strokeWidth={3} />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="px-4 pt-2 pb-5 safe-bottom border-t border-border bg-card">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[11px] text-muted-foreground">
                  Выбрано:{" "}
                  <span className="text-foreground font-semibold">
                    {selected.length}
                  </span>{" "}
                  из {CATEGORIES.length}
                </span>
                <button
                  onClick={selectAll}
                  className="text-[11px] font-semibold text-foreground/80 hover:text-foreground transition-colors"
                >
                  Выбрать все
                </button>
              </div>
              <button
                onClick={save}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-foreground to-foreground/85 text-background text-[14px] font-semibold tap-scale shadow-[0_6px_20px_-6px_hsl(var(--foreground)/0.5)] flex items-center justify-center gap-2"
              >
                <Filter size={14} />
                Сохранить и применить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CategorySubscriptionModal;
