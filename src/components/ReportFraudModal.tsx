import { useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  jobId?: string | null;
  dispatcherId?: string | null;
}

const REASONS = [
  "Не платит / обманывает с оплатой",
  "Просит предоплату или комиссию",
  "Заявка фейковая / нет такого адреса",
  "Угрозы или грубое поведение",
  "Запрашивает личные данные / документы",
  "Другое",
];

export const ReportFraudModal = ({ open, onClose, jobId, dispatcherId }: Props) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!user) {
      toast.error("Войдите, чтобы пожаловаться");
      return;
    }
    if (!reason) {
      toast.error("Выберите причину");
      return;
    }
    if (details.length > 1000) {
      toast.error("Описание слишком длинное");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("fraud_reports").insert({
      reporter_id: user.id,
      job_id: jobId ?? null,
      dispatcher_id: dispatcherId ?? null,
      reason,
      details: details.trim().slice(0, 1000),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Не удалось отправить жалобу");
      return;
    }
    if (navigator.vibrate) navigator.vibrate(40);
    toast.success("Жалоба отправлена. Спасибо!");
    setReason("");
    setDetails("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={18} className="text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground">Пожаловаться на мошенников</h3>
            <p className="text-[12px] text-muted-foreground">Жалоба попадёт в админку для проверки</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[12px] font-semibold text-muted-foreground mb-2">Причина</p>
        <div className="space-y-2 mb-4">
          {REASONS.map((r) => {
            const active = reason === r;
            return (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`w-full text-left px-3.5 py-3 rounded-xl border text-[13px] transition-all active:scale-[0.99] ${
                  active
                    ? "border-destructive/60 bg-destructive/10 text-foreground font-semibold"
                    : "border-border bg-surface-1 text-foreground/90"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        <p className="text-[12px] font-semibold text-muted-foreground mb-2">Описание (необязательно)</p>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Расскажите, что произошло"
          className="w-full px-3.5 py-3 rounded-xl border border-border bg-surface-1 text-[13px] text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary/60 resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right mt-1">{details.length}/1000</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-surface-1 border border-border text-foreground text-sm font-semibold active:scale-[0.98]"
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={submitting || !reason}
            className="flex-1 py-3 rounded-2xl bg-destructive text-destructive-foreground text-sm font-bold active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportFraudModal;
