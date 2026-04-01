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
      <div className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground flex-1">Детали заказа</h2>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="px-5">
        {/* Photo placeholder */}
        <div className="w-full h-44 rounded-2xl neu-inset mb-5 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">📦 Фото объекта</span>
        </div>

        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              {job.urgent && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/20 text-destructive text-[11px] font-semibold">
                  <Zap size={10} /> Срочно
                </span>
              )}
              <span className="text-[11px] text-muted-foreground neu-raised-sm px-2.5 py-1 rounded-lg">{job.type}</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">{job.title}</h1>
          </div>
        </div>

        <p className="text-2xl font-extrabold text-gradient-primary mb-4">{job.price.toLocaleString("ru-RU")} ₽</p>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{job.description}</p>

        {/* Details */}
        <div className="space-y-3 mb-6">
          {[
            { icon: MapPin, label: "Адрес", value: job.address },
            { icon: Clock, label: "Дата и время", value: `${job.date}, ${job.time}` },
            { icon: Users, label: "Грузчиков", value: `${job.workersNeeded} человек` },
            { icon: MapPin, label: "Расстояние", value: job.distance },
          ].map((detail) => (
            <div key={detail.label} className="flex items-center gap-3 p-3.5 neu-flat rounded-2xl">
              <div className="w-9 h-9 rounded-xl neu-raised-sm flex items-center justify-center flex-shrink-0">
                <detail.icon size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{detail.label}</p>
                <p className="text-sm text-foreground font-medium">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Responses */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Откликнулись ({job.responses})</h3>
          <div className="flex -space-x-2">
            {Array.from({ length: Math.min(job.responses, 5) }).map((_, i) => (
              <div key={i} className="w-10 h-10 rounded-full neu-raised border-2 border-background flex items-center justify-center">
                <User size={14} className="text-muted-foreground" />
              </div>
            ))}
            {job.responses > 5 && (
              <div className="w-10 h-10 rounded-full neu-raised-sm border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                +{job.responses - 5}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 gradient-primary text-primary-foreground py-3.5 rounded-2xl text-sm font-bold active:scale-[0.98] transition-transform">
            Откликнуться
          </button>
          <button className="w-14 h-14 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
            <MessageCircle size={18} className="text-primary" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default JobDetailScreen;
