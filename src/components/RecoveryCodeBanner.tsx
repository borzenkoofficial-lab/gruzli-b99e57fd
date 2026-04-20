import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, KeyRound, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RecoveryCodeBannerProps {
  userId: string;
  onClose: () => void;
}

/** Shown right after signup — displays the recovery code that the user must save. */
export const RecoveryCodeBanner = ({ userId, onClose }: RecoveryCodeBannerProps) => {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Wait briefly for the trigger to populate
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from("profiles")
          .select("recovery_code")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (data?.recovery_code) {
          setCode(data.recovery_code);
          return;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-5 z-10"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground">
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <KeyRound size={26} className="text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">Сохраните код восстановления</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Это единственный способ восстановить доступ, если забудете пароль.
            </p>
          </div>

          <div className="bg-muted/40 rounded-xl p-4 border border-border mb-4">
            {code ? (
              <div className="flex items-center justify-between gap-2">
                <code className="text-xl font-bold text-foreground tracking-widest font-mono">{code}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(code);
                    toast.success("Скопировано");
                  }}
                  className="p-2 rounded-lg bg-background hover:bg-muted"
                >
                  <Copy size={16} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="text-center text-xs text-muted-foreground py-2">Загрузка…</div>
            )}
          </div>

          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-4">
            <p className="text-[11px] text-destructive leading-relaxed">
              ⚠️ Запишите код в надёжное место. Без него и без пароля вы не сможете войти в аккаунт.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={!code}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            Я сохранил код
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
