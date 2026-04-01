import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Users, Zap, MessageCircle, User } from "lucide-react";
import type { Job } from "@/data/mockData";

interface JobDetailScreenProps {
  job: Job;
  onBack: () => void;
}

const JobDetailScreen = ({ job, onBack }: JobDetailScreenProps) => {
  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-base font-semibold text-foreground flex-1">Детали заказа</h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="px-5">
        {/* Photo placeholder */}
        <div className="w-full h-44 rounded-2xl bg-surface-3 mb-4 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">📦 Фото объекта</span>
        </div>

        {/* Title & price */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {job.urgent && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-badge/20 text-badge text-[11px] font-semibold">
                  <Zap size={10} /> Срочно
                </span>
              )}
              <span className="text-[11px] text-muted-foreground bg-surface-3 px-2 py-0.5 rounded-md">{job.type}</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">{job.title}</h1>
          </div>
        </div>

        <p className="text-2xl font-bold text-gradient-cyan mb-4">{job.price.toLocaleString("ru-RU")} ₽</p>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{job.description}</p>

        {/* Details */}
        <div className="space-y-3 mb-6">
          {[
            { icon: MapPin, label: "Адрес", value: job.address },
            { icon: Clock, label: "Дата и время", value: `${job.date}, ${job.time}` },
            { icon: Users, label: "Грузчиков", value: `${job.workersNeeded} человек` },
            { icon: MapPin, label: "Расстояние", value: job.distance },
          ].map((detail) => (
            <div key={detail.label} className="flex items-center gap-3 p-3 bg-card rounded-xl">
              <detail.icon size={16} className="text-primary flex-shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">{detail.label}</p>
                <p className="text-sm text-foreground font-medium">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Responses */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Откликнулись ({job.responses})</h3>
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(job.responses, 5) }).map((_, i) => (
              <div key={i} className="w-9 h-9 rounded-full bg-surface-4 border-2 border-background flex items-center justify-center">
                <User size={14} className="text-muted-foreground" />
              </div>
            ))}
            {job.responses > 5 && (
              <div className="w-9 h-9 rounded-full bg-surface-3 border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                +{job.responses - 5}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 gradient-cyan text-primary-foreground py-3 rounded-xl text-sm font-semibold shadow-soft active:scale-[0.98] transition-transform">
            Откликнуться
          </button>
          <button className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center active:scale-95 transition-transform">
            <MessageCircle size={18} className="text-primary" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default JobDetailScreen;
