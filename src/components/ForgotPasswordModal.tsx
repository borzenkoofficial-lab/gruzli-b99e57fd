import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, KeyRound, Phone, Lock, CheckCircle2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal = ({ open, onClose }: ForgotPasswordModalProps) => {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password-with-code", {
        body: {
          identifier: identifier.trim(),
          recovery_code: code.trim(),
          new_password: newPassword,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSuccess((data as any)?.new_recovery_code || null);
      toast.success("Пароль изменён!");
    } catch (err: any) {
      toast.error(err.message || "Не удалось сбросить пароль");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIdentifier("");
    setCode("");
    setNewPassword("");
    setSuccess(null);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        onClick={handleClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-5 z-10"
        >
          <button onClick={handleClose} className="absolute top-4 right-4 text-muted-foreground">
            <X size={18} />
          </button>

          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Восстановление пароля</h3>
              <p className="text-[11px] text-muted-foreground">По коду восстановления</p>
            </div>
          </div>

          {success !== null ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center py-4">
                <CheckCircle2 size={48} className="text-primary mb-3" />
                <p className="text-sm font-bold text-foreground">Пароль изменён!</p>
                <p className="text-xs text-muted-foreground mt-1">Можете войти с новым паролем</p>
              </div>

              {success && (
                <div className="bg-muted/40 rounded-xl p-3 border border-border">
                  <p className="text-[11px] text-muted-foreground mb-2">
                    ⚠️ Новый код восстановления (старый больше не работает):
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-base font-bold text-foreground tracking-wider">{success}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(success);
                        toast.success("Скопировано");
                      }}
                      className="p-2 rounded-lg bg-background hover:bg-muted"
                    >
                      <Copy size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Сохраните его — он понадобится для следующего восстановления.
                  </p>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold"
              >
                Готово
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Введите ваш телефон/email, код восстановления (выдан при регистрации) и новый пароль.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  Телефон или email
                </label>
                <div className="neu-inset rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Phone size={14} className="text-muted-foreground shrink-0" />
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="+7..."
                    required
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  Код восстановления (10 символов)
                </label>
                <div className="neu-inset rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <KeyRound size={14} className="text-muted-foreground shrink-0" />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCDE12345"
                    required
                    maxLength={10}
                    minLength={10}
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none uppercase tracking-wider font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  Новый пароль
                </label>
                <div className="neu-inset rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Lock size={14} className="text-muted-foreground shrink-0" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    required
                    minLength={6}
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Сбросить пароль"}
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
