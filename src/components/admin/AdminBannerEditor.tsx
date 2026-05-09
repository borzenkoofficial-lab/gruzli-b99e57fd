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
  Megaphone,
  ArrowUpRight,
  Image as ImageIcon,
  Loader2,
  X,
  RotateCcw,
} from "lucide-react";

interface BannerCfg {
  enabled: boolean;
  title: string;
  subtitle: string;
  badge: string;
  cta: string;
  link_url: string;
  image_url: string;
  version: number;
}

const DEFAULT_CFG: BannerCfg = {
  enabled: false,
  title: "",
  subtitle: "",
  badge: "",
  cta: "Открыть",
  link_url: "",
  image_url: "",
  version: 1,
};

export const AdminBannerEditor = () => {
  const [cfg, setCfg] = useState<BannerCfg>(DEFAULT_CFG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("id", "feed_banner")
        .maybeSingle();
      const v = (data?.value as Partial<BannerCfg>) || {};
      setCfg({ ...DEFAULT_CFG, ...v });
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<BannerCfg>) => setCfg((p) => ({ ...p, ...patch }));

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
      const path = `banner-${Date.now()}.${ext}`;
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
    const value: BannerCfg = {
      ...cfg,
      version: bumpVersion ? (cfg.version || 1) + 1 : cfg.version || 1,
    };
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        [{ id: "feed_banner", value: value as any, updated_at: new Date().toISOString() }],
        { onConflict: "id" }
      );
    setSaving(false);
    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      setCfg(value);
      toast.success(
        bumpVersion ? "Сохранено и показано всем заново" : "Сохранено"
      );
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
          <Megaphone className="h-5 w-5 text-primary" />
          Баннер на ленте
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enabled */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Показывать баннер</p>
            <p className="text-xs text-muted-foreground">Виден всем пользователям в ленте</p>
          </div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
        </div>

        {/* Live preview */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Предпросмотр</Label>
          <div className="rounded-2xl bg-background/50 p-3 border border-border/50">
            <div className="relative flex items-center gap-3 rounded-2xl p-3 overflow-hidden border border-border bg-card">
              <span
                aria-hidden
                className="absolute inset-0 opacity-60 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--primary) / 0) 60%)",
                }}
              />
              <div className="relative shrink-0 w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center overflow-hidden">
                {cfg.image_url ? (
                  <img src={cfg.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Megaphone size={18} className="text-primary" />
                )}
              </div>
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-bold text-foreground truncate">
                    {cfg.title || "Заголовок баннера"}
                  </p>
                  {cfg.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                      {cfg.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {cfg.subtitle || "Краткое описание или новость"}
                </p>
              </div>
              {cfg.link_url && (
                <div className="relative shrink-0 flex items-center gap-1">
                  {cfg.cta && (
                    <span className="text-[11px] font-semibold text-primary">{cfg.cta}</span>
                  )}
                  <ArrowUpRight size={14} className="text-primary" />
                </div>
              )}
              <button className="relative shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground">
                <X size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Заголовок</Label>
            <Input
              value={cfg.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={60}
              placeholder="Например: Новости Грузли"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Бейдж (необязательно)</Label>
            <Input
              value={cfg.badge}
              onChange={(e) => update({ badge: e.target.value })}
              maxLength={10}
              placeholder="new"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Описание</Label>
          <Textarea
            value={cfg.subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
            rows={2}
            maxLength={120}
            placeholder="Что важного хотите сообщить?"
            className="resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
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
              maxLength={20}
              placeholder="Открыть"
              disabled={!cfg.link_url}
            />
          </div>
        </div>

        {/* Image */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" /> Иконка/картинка (до 3 МБ)
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => update({ image_url: "" })}
              >
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

        {/* Actions */}
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
            title="Те, кто уже скрыли баннер, увидят его снова"
          >
            <RotateCcw className="h-4 w-4" />
            Показать всем заново
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminBannerEditor;
