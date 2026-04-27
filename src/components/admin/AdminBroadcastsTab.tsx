import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone,
  Image as ImageIcon,
  Link2,
  Send,
  Trash2,
  Users,
  Hash,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface Broadcast {
  id: string;
  text: string;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
  target_personal: boolean;
  target_channels: boolean;
  status: string;
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface AudienceCounts {
  subscribers: number;
  channels: number;
}

const AdminBroadcastsTab = () => {
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [targetPersonal, setTargetPersonal] = useState(true);
  const [targetChannels, setTargetChannels] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [counts, setCounts] = useState<AudienceCounts>({ subscribers: 0, channels: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as Broadcast[]) || []);
  };

  const loadCounts = async () => {
    const [{ count: subs }, { count: chans }] = await Promise.all([
      supabase
        .from("telegram_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("telegram_user_channels")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ]);
    setCounts({ subscribers: subs || 0, channels: chans || 0 });
  };

  useEffect(() => {
    loadHistory();
    loadCounts();
  }, []);

  const handleImagePick = () => fileInputRef.current?.click();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл больше 5 МБ");
      return;
    }

    setImageUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("broadcast-media")
        .upload(path, file, { contentType: file.type, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("broadcast-media").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Картинка загружена");
    } catch (err: any) {
      toast.error(err.message || "Ошибка загрузки");
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = () => setImageUrl(null);

  const reset = () => {
    setText("");
    setLinkUrl("");
    setLinkLabel("");
    setImageUrl(null);
  };

  const validateAndConfirm = () => {
    if (!text.trim() && !imageUrl) {
      toast.error("Добавьте текст или картинку");
      return;
    }
    if (!targetPersonal && !targetChannels) {
      toast.error("Выберите аудиторию");
      return;
    }
    if (linkUrl && !linkLabel.trim()) {
      toast.error("Укажите подпись для ссылки");
      return;
    }
    if (linkUrl && !/^https?:\/\//i.test(linkUrl.trim())) {
      toast.error("Ссылка должна начинаться с http:// или https://");
      return;
    }
    setConfirmOpen(true);
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-broadcast-telegram", {
        body: {
          text: text.trim(),
          link_url: linkUrl.trim() || null,
          link_label: linkLabel.trim() || null,
          image_url: imageUrl,
          target_personal: targetPersonal,
          target_channels: targetChannels,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Отправлено: ${data?.sent ?? 0} из ${data?.total ?? 0}`);
      reset();
      await loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  const audienceTotal =
    (targetPersonal ? counts.subscribers : 0) + (targetChannels ? counts.channels : 0);

  return (
    <div className="space-y-6 mt-4">
      {/* Composer */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">Новая рассылка</h2>
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            Текст сообщения
          </Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что вы хотите написать пользователям?"
            rows={5}
            maxLength={1024}
            className="resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {text.length} / 1024
          </p>
        </div>

        {/* Link */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" />
              Ссылка (необязательно)
            </Label>
            <Input
              type="url"
              inputMode="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Подпись кнопки
            </Label>
            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Открыть"
              maxLength={32}
              disabled={!linkUrl}
            />
          </div>
        </div>

        {/* Image */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            Картинка (необязательно, до 5 МБ)
          </Label>
          {imageUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-border max-w-xs">
              <img src={imageUrl} alt="preview" className="w-full max-h-64 object-cover" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleImagePick}
              disabled={imageUploading}
              className="w-full sm:w-auto"
            >
              {imageUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Загрузка…
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" /> Прикрепить картинку
                </>
              )}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        {/* Audience */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground">
            Кому отправить
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                targetPersonal ? "border-primary bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <Checkbox
                checked={targetPersonal}
                onCheckedChange={(v) => setTargetPersonal(Boolean(v))}
              />
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Личные подписчики</p>
                <p className="text-[11px] text-muted-foreground">
                  {counts.subscribers} активных
                </p>
              </div>
            </label>
            <label
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                targetChannels ? "border-primary bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <Checkbox
                checked={targetChannels}
                onCheckedChange={(v) => setTargetChannels(Boolean(v))}
              />
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Каналы и группы</p>
                <p className="text-[11px] text-muted-foreground">
                  {counts.channels} привязано
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Send */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground flex-1">
            Получателей: <span className="font-bold text-foreground">{audienceTotal}</span>
          </p>
          <Button
            onClick={validateAndConfirm}
            disabled={sending || (!text.trim() && !imageUrl) || audienceTotal === 0}
            className="w-full sm:w-auto"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Отправка…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" /> Отправить
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* History */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            История рассылок
          </h2>
          <Button variant="ghost" size="sm" onClick={loadHistory}>
            Обновить
          </Button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Рассылок ещё не было
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((b) => {
              const ok = b.status === "sent";
              const failed = b.status === "failed";
              const sending = b.status === "sending" || b.status === "pending";
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    {b.image_url && (
                      <img
                        src={b.image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2 break-words">
                        {b.text || "(без текста)"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(b.created_at).toLocaleString("ru-RU")}
                        </span>
                        {b.target_personal && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                            личные
                          </span>
                        )}
                        {b.target_channels && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                            каналы
                          </span>
                        )}
                        {b.link_url && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted flex items-center gap-1">
                            <Link2 className="h-2.5 w-2.5" /> ссылка
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {ok && (
                        <CheckCircle2 className="h-4 w-4 text-primary inline" />
                      )}
                      {failed && <XCircle className="h-4 w-4 text-destructive inline" />}
                      {sending && (
                        <Loader2 className="h-4 w-4 text-muted-foreground inline animate-spin" />
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {b.sent_count}/{b.total_targets}
                        {b.failed_count > 0 && (
                          <span className="text-destructive"> · {b.failed_count} ✕</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отправить рассылку?</AlertDialogTitle>
            <AlertDialogDescription>
              Сообщение получат примерно <strong>{audienceTotal}</strong>{" "}
              {targetPersonal && targetChannels
                ? "подписчиков и каналов"
                : targetPersonal
                ? "личных подписчиков"
                : "каналов и групп"}
              . Отменить отправку будет нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>Отправить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBroadcastsTab;
