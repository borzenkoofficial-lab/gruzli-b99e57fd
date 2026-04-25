import { useState, useEffect } from "react";
import { Megaphone, Check, Loader2, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const BOT_USERNAME = "gruzli_bot";

type Channel = {
  id: string;
  chat_id: number;
  title: string | null;
  username: string | null;
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const TelegramChannelsCard = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const loadChannels = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("telegram_user_channels")
      .select("id, chat_id, title, username")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setChannels((data as Channel[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-refresh every 5s while a code is shown so a freshly linked channel appears
  useEffect(() => {
    if (!code) return;
    const t = setInterval(loadChannels, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user?.id]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    const newCode = generateCode();
    const { error } = await supabase
      .from("telegram_link_codes")
      .insert({ user_id: user.id, code: newCode, purpose: "channel" });
    setGenerating(false);
    if (error) {
      toast.error("Не удалось создать код");
      return;
    }
    setCode(newCode);
    setShowHelp(true);
  };

  const handleRemove = async (channelId: string) => {
    if (!confirm("Отвязать канал? Заявки больше не будут публиковаться.")) return;
    const { error } = await supabase
      .from("telegram_user_channels")
      .delete()
      .eq("id", channelId);
    if (error) {
      toast.error("Не удалось отвязать");
      return;
    }
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    toast.success("Канал отвязан");
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone size={16} className="text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Telegram-каналы
        </p>
      </div>

      <p className="text-[12px] text-muted-foreground leading-relaxed">
        Добавьте бота <b>@{BOT_USERNAME}</b> в свой Telegram-канал — и все новые заявки
        будут автоматически публиковаться там.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {channels.length > 0 && (
            <div className="space-y-2">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20"
                >
                  <Check size={16} className="text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {ch.title || (ch.username ? `@${ch.username}` : `Канал ${ch.chat_id}`)}
                    </p>
                    {ch.username && (
                      <p className="text-[11px] text-muted-foreground truncate">@{ch.username}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(ch.id)}
                    className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center active:opacity-70 shrink-0"
                    aria-label="Отвязать"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {code ? (
        <div className="bg-surface-1 border border-border rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Код привязки канала
          </p>
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
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Действует 30 минут. Опубликуйте этот код сообщением в свой канал — бот
            автоматически привяжет канал.
          </p>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-foreground text-primary-foreground text-sm font-bold tap-scale disabled:opacity-50"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
          {generating ? "Создаю код..." : "Привязать канал"}
        </button>
      )}

      <button
        onClick={() => setShowHelp((v) => !v)}
        className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground py-1"
      >
        Как привязать канал {showHelp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {showHelp && (
        <ol className="text-[11px] text-muted-foreground space-y-1.5 pl-4 list-decimal leading-relaxed">
          <li>
            Откройте свой Telegram-канал → <b>Управление</b> → <b>Администраторы</b> →{" "}
            <b>Добавить администратора</b>.
          </li>
          <li>
            Найдите бота <b>@{BOT_USERNAME}</b> и добавьте. Достаточно прав «Публикация
            сообщений».
          </li>
          <li>
            Нажмите <b>«Привязать канал»</b> выше — получите код.
          </li>
          <li>
            Опубликуйте этот код сообщением в свой канал. Бот сразу подтвердит привязку, и
            заявки начнут приходить.
          </li>
        </ol>
      )}
    </div>
  );
};
