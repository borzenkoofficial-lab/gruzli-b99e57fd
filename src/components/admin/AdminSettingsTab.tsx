import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Users, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

const AdminSettingsTab = () => {
  const [botEnabled, setBotEnabled] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(15247);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .in("id", ["bot_jobs_enabled", "fake_subscribers"]);

    if (data) {
      data.forEach((row) => {
        if (row.id === "bot_jobs_enabled") {
          setBotEnabled((row.value as any)?.enabled ?? false);
        }
        if (row.id === "fake_subscribers") {
          setSubscriberCount((row.value as any)?.count ?? 15247);
        }
      });
    }
    setLoading(false);
  };

  const updateSetting = async (id: string, value: any) => {
    const { error } = await supabase
      .from("app_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      toast.success("Сохранено");
    }
  };

  const toggleBotJobs = async (enabled: boolean) => {
    setBotEnabled(enabled);
    await updateSetting("bot_jobs_enabled", { enabled });
  };

  const saveSubscribers = async () => {
    await updateSetting("fake_subscribers", { count: subscriberCount });
  };

  const generateBotJobs = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-bot-jobs", {
        body: { count: 3 },
      });
      if (error) throw error;
      toast.success("Бот-заявки сгенерированы");
    } catch {
      toast.error("Ошибка генерации");
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Bot Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-primary" />
            Бот-заявки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Автогенерация заявок</p>
              <p className="text-xs text-muted-foreground">
                Боты создают заявки, которые отображаются как «место занято»
              </p>
            </div>
            <Switch checked={botEnabled} onCheckedChange={toggleBotJobs} />
          </div>
          <Button
            onClick={generateBotJobs}
            disabled={generating}
            variant="outline"
            className="w-full gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Сгенерировать сейчас (3 шт.)
          </Button>
        </CardContent>
      </Card>

      {/* Fake Subscribers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Подписчики канала
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">
              Отображаемое число подписчиков в канале
            </p>
            <Input
              type="number"
              value={subscriberCount}
              onChange={(e) => setSubscriberCount(Number(e.target.value))}
              min={0}
            />
          </div>
          <Button onClick={saveSubscribers} className="w-full">
            Сохранить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettingsTab;
