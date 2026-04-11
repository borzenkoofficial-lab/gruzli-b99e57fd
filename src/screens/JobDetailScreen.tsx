import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Users, Zap, MessageCircle, User, Wallet, UserPlus } from "lucide-react";
import { useRespondToJob } from "@/hooks/useRespondToJob";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface JobDetailScreenProps {
  job: Tables<"jobs">;
  onBack: () => void;
  onOpenChat?: (conversationId: string, title: string) => void;
  onOpenProfile?: (userId: string) => void;
}

const JobDetailScreen = ({ job, onBack, onOpenChat, onOpenProfile }: JobDetailScreenProps) => {
  const { respondAndOpenChat } = useRespondToJob(onOpenChat);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);
  const [dispatcherName, setDispatcherName] = useState("Диспетчер");

  useEffect(() => {
    const fetchName = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", job.dispatcher_id)
        .single();
      if (data) setDispatcherName(data.full_name || "Диспетчер");
    };
    fetchName();
  }, [job.dispatcher_id]);

  const totalPay = job.hourly_rate * (Number(job.duration_hours) || 4);

  const handleRespond = async () => {
    if (responding) return;
    setResponding(true);
    const success = await respondAndOpenChat(job);
    if (success) setResponded(true);
    setResponding(false);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 safe-top pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center active:bg-surface-1 border border-border transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground flex-1">Детали заказа</h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="px-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              {job.urgent && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/20 text-destructive text-[11px] font-semibold">
                  <Zap size={10} /> Срочно
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold text-foreground">{job.title}</h1>
            <button
              onClick={() => onOpenProfile?.(job.dispatcher_id)}
              className="flex items-center gap-1.5 mt-1.5 active:opacity-70"
            >
              <UserPlus size={12} className="text-primary" />
              <span className="text-xs text-primary font-medium">{dispatcherName}</span>
            </button>
          </div>
        </div>

        {/* Earnings */}
        <div className="bg-surface-1 border border-border rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <span className="text-sm text-muted-foreground">Ты получишь</span>
            <span className="text-2xl font-extrabold text-bg-foreground ml-auto">{totalPay.toLocaleString("ru-RU")} ₽</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{job.hourly_rate} ₽/час × {job.duration_hours || 4}ч</p>
        </div>

        {job.description && (
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{job.description}</p>
        )}

        {/* Details */}
        <div className="space-y-3 mb-6">
          {[
            job.address && { icon: MapPin, label: "Адрес", value: job.address },
            job.start_time && { icon: Clock, label: "Дата и время", value: new Date(job.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) },
            { icon: Users, label: "Грузчиков", value: `${job.workers_needed || 1} человек` },
          ].filter(Boolean).map((detail: any) => (
            <div key={detail.label} className="flex items-center gap-3 p-3.5 bg-card rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0">
                <detail.icon size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{detail.label}</p>
                <p className="text-sm text-foreground font-medium">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleRespond}
            disabled={responding || responded}
            className={`flex-1 py-3.5 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all ${
              responded
                ? "bg-online/20 text-online"
                : "bg-foreground text-primary-foreground"
            }`}
            style={!responded ? {
              boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)',
            } : {}}
          >
            {responding ? "Отправка..." : responded ? "✓ Отклик отправлен" : "Откликнуться"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default JobDetailScreen;
