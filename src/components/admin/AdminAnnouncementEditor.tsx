import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  ArrowUpRight,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";

interface AnnouncementCfg {
  enabled: boolean;
  badge: string;
  title: string;
  body: string;
  image_url: string;
  cta: string;
  link_url: string;
  version: number;
}

const DEFAULT_CFG: AnnouncementCfg = {
  enabled: false,
  badge: "",
  title: "",
  body: "",
  image_url: "",
  cta: "Окей, понятно",
  link_url: "",
  version: 1,
};

export const AdminAnnouncementEditor = () => {
  const [cfg, setCfg] = useState<AnnouncementCfg>(DEFAULT_CFG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("id", "announcement_modal")
        .maybeSingle();
      const v = (data?.value as Partial<AnnouncementCfg>) || {};
      setCfg({ ...DEFAULT_CFG, ...v });
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<AnnouncementCfg>) => setCfg((p) => ({ ...p, ...patch }));

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Файл больше 3 МБ");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `announcement-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("broadcast-media")
        .upload(path, file, { contentType: file.type, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("broadcast-media").getPublicUrl(path);
      update({ image_url: data.publicUrl });
      toast.success("Картинка загружена");
    } catch (err: any) {
      toast.error(err.message || "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async (bumpVersion = false) => {
    if (cfg.link_url && !/^https?:\/\//i.test(cfg.link_url.trim())) {
      toast.error("Ссылка должна начинаться с http:// или https://");
      return;
    }
    setSaving(true);
    const value: AnnouncementCfg = {
      ...cfg,
      version: bumpVersion ? (cfg.version || 1) + 1 : cfg.version || 1,
    };
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        [{ id: "announcement_modal", value: value as any, updated_at: new Date().toISOString() }],
        { onConflict: "id" }
      );
    setSaving(false);
    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      setCfg(value);
      toast.success(bumpVersion ? "Сохранено и показано всем заново" : "Сохранено");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          Окно с обновлениями
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Показывать при входе</p>
            <p className="text-xs text-muted-foreground">
              Появляется один раз для каждого пользователя
            </p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>

        {/* Preview */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Предпросмотр</Label>
          <div className="rounded-2xl bg-background/50 p-3 border border-border/50">
            <div className="relative w-full max-w-xs mx-auto rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
              <span
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-80"
                style={{
                  background:
                    "radial-gradient(120% 60% at 50% 0%, hsl(var(--primary) / 0.18), transparent 60%)",
                }}
              />
              <button
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground"
                type="button"
              >
                <X size={16} />
              </button>
              {cfg.image_url ? (
                <div className="relative w-full aspect-[16/9] overflow-hidden border-b border-border">
                  <img src={cfg.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="relative pt-7 flex justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Sparkles size={24} className="text-primary" />
                  </div>
                </div>
              )}
              <div className="relative px-5 pt-4 pb-5 text-center">
                {cfg.badge && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/15 text-primary mb-2">
                    {cfg.badge}
                  </span>
                )}
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  {cfg.title || "Заголовок обновления"}
                </h2>
                <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
                  {cfg.body || "Краткое описание того, что нового в приложении."}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {cfg.link_url && (
                    <div className="inline-flex items-center justify-center gap-1.5 h-10 rounded-2xl bg-primary text-primary-foreground font-semibold text-[13px]">
                      {cfg.cta || "Подробнее"} <ArrowUpRight size={14} />
                    </div>
                  )}
                  <div
                    className={`h-10 rounded-2xl font-semibold text-[13px] flex items-center justify-center ${
                      cfg.link_url
                        ? "bg-muted/60 text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {cfg.link_url ? "Закрыть" : cfg.cta || "Окей, понятно"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Заголовок</Label>
            <Input
              value={cfg.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={60}
              placeholder="Что нового"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Бейдж (необязательно)</Label>
            <Input
              value={cfg.badge}
              onChange={(e) => update({ badge: e.target.value })}
              maxLength={14}
              placeholder="Обновление"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Текст</Label>
          <Textarea
            value={cfg.body}
            onChange={(e) => update({ body: e.target.value })}
            rows={5}
            maxLength={600}
            placeholder="Расскажите подробно о новостях и изменениях..."
            className="resize-none"
          />
          <p className="text-[10px] text-muted-foreground">{cfg.body.length}/600</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Ссылка (необязательно)</Label>
            <Input
              type="url"
              inputMode="url"
              value={cfg.link_url}
              onChange={(e) => update({ link_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Кнопка</Label>
            <Input
              value={cfg.cta}
              onChange={(e) => update({ cta: e.target.value })}
              maxLength={24}
              placeholder="Окей, понятно"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" /> Картинка (до 3 МБ)
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4 mr-2" />
              )}
              {cfg.image_url ? "Заменить" : "Загрузить"}
            </Button>
            {cfg.image_url && (
              <Button type="button" variant="ghost" onClick={() => update({ image_url: "" })}>
                Убрать
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImage}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button onClick={() => save(false)} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Сохранить
          </Button>
          <Button
            onClick={() => save(true)}
            disabled={saving}
            variant="outline"
            className="gap-2"
            title="Те, кто уже закрыли окно, увидят его снова"
          >
            <RotateCcw className="h-4 w-4" />
            Показать всем заново
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminAnnouncementEditor;
