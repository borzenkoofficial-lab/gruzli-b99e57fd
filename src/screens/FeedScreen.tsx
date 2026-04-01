import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Users, Zap, ChevronRight } from "lucide-react";
import { mockJobs, type Job } from "@/data/mockData";

const filters = ["Все", "Переезд", "Такелаж", "Погрузка/Разгрузка", "Межэтаж", "Срочные"];

interface FeedScreenProps {
  onOpenJob: (job: Job) => void;
}

const FeedScreen = ({ onOpenJob }: FeedScreenProps) => {
  const [activeFilter, setActiveFilter] = useState("Все");

  const filtered = activeFilter === "Все"
    ? mockJobs
    : activeFilter === "Срочные"
    ? mockJobs.filter((j) => j.urgent)
    : mockJobs.filter((j) => j.type === activeFilter);

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Лента заявок</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{mockJobs.length} доступных заказов</p>
      </div>

      {/* Filters */}
      <div className="px-5 pb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === f
                  ? "gradient-cyan text-primary-foreground shadow-soft"
                  : "bg-surface-3 text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards */}
      <div className="px-5 space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onOpenJob(job)}
              className="bg-card rounded-2xl p-4 shadow-card cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {job.urgent && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-badge/20 text-badge text-[11px] font-semibold">
                        <Zap size={10} /> Срочно
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground bg-surface-3 px-2 py-0.5 rounded-md">
                      {job.type}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-foreground leading-tight">{job.title}</h3>
                </div>
                <ChevronRight size={18} className="text-muted-foreground mt-1 flex-shrink-0" />
              </div>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><MapPin size={12} /> {job.distance}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {job.date}, {job.time}</span>
                <span className="flex items-center gap-1"><Users size={12} /> {job.workersNeeded} чел.</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold text-gradient-cyan">{job.price.toLocaleString("ru-RU")} ₽</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="gradient-cyan text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold shadow-soft active:scale-95 transition-transform"
                >
                  Откликнуться
                </button>
              </div>

              {job.responses > 0 && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  {job.responses} откликов
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FeedScreen;
