import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const supabaseUrl = (supabase as any).supabaseUrl ||
      import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid === false && d.reason === "already_unsubscribed") setStatus("already");
        else if (d.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch { setStatus("error"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 text-center shadow-lg border border-border">
        {status === "loading" && <p className="text-muted-foreground">Загрузка...</p>}
        {status === "valid" && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">Отписка от рассылки</h1>
            <p className="text-muted-foreground mb-6">Вы уверены, что хотите отписаться от email-уведомлений?</p>
            <button
              onClick={handleUnsubscribe}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold hover:opacity-90 transition"
            >
              Подтвердить отписку
            </button>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">✅ Готово</h1>
            <p className="text-muted-foreground">Вы успешно отписались от email-уведомлений.</p>
          </>
        )}
        {status === "already" && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">Уже отписаны</h1>
            <p className="text-muted-foreground">Вы уже отписаны от email-уведомлений.</p>
          </>
        )}
        {status === "invalid" && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">Ошибка</h1>
            <p className="text-muted-foreground">Недействительная или истёкшая ссылка.</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-foreground mb-4">Ошибка</h1>
            <p className="text-muted-foreground">Не удалось обработать отписку. Попробуйте позже.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default UnsubscribePage;
