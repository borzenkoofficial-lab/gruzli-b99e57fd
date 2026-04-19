import { useState, useEffect } from "react";
import { Send, Check, Loader2, Copy, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const BOT_USERNAME = "gruzli_bot";

function generateCode(): string {
  // 8-char readable code
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const TelegramLinkCard = () => {
  const { user } = useAuth();
  const [linked, setLinked] = useState<{ chat_id: number; username: string | null; first_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadStatus = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("telegram_subscribers")
      .select("chat_id, username, first_name, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    setLinked(data ?? null);
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    const newCode = generateCode();
    const { error } = await supabase
      .from("telegram_link_codes")
      .insert({ user_id: user.id, code: newCode });
    setGenerating(false);
    if (error) {
      toast.error("Не удалось создать код");
      return;
    }
    setCode(newCode);
  };

  const handleUnlink = async () => {
    if (!user || !linked) return;
    if (!confirm("Отвязать Telegram? Личные уведомления больше не будут приходить.")) return;
    await supabase
      .from("telegram_subscribers")
      .update({ user_id: null, is_active: false })
      .eq("user_id", user.id);
    setLinked(null);
    setCode(null);
    toast.success("Telegram отвязан");
  };

  const botLink = code
    ? `https://t.me/${BOT_USERNAME}?start=${code}`
    : `https://t.me/${BOT_USERNAME}`;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Send size={16} className="text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telegram-уведомления</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : linked ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Check size={18} className="text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Аккаунт привязан</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {linked.username ? `@${linked.username}` : linked.first_name || `chat ${linked.chat_id}`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Личные сообщения, отклики и статусы заявок приходят вам в Telegram.
              </p>
            </div>
          </div>
          <button
            onClick={handleUnlink}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-bold tap-scale"
          >
            <Unlink size={14} />
            Отвязать Telegram
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Привяжите свой Telegram, чтобы получать <b>личные</b> уведомления: новые сообщения,
            отклики на ваши заявки и изменения статусов работы.
          </p>

          {code ? (
            <>
              <div className="bg-surface-1 border border-border rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ваш код</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-base font-mono font-bold text-foreground tracking-wider">
                    {code}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(code);
                      toast.success("Код скопирован");
                    }}
                    className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center active:opacity-70"
                  >
                    <Copy size={14} className="text-muted-foreground" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Действует 30 минут. Нажмите кнопку ниже — бот привяжет ваш аккаунт автоматически.
                </p>
              </div>
              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale"
              >
                <Send size={16} />
                Открыть бота и привязать
              </a>
            </>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {generating ? "Создаю код..." : "Привязать Telegram"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
