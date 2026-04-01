import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Users, Zap, ChevronRight, Menu, Search } from "lucide-react";
import { mockJobs, type Job } from "@/data/mockData";

const filters = ["Все", "Переезд", "Такелаж", "Погрузка", "Межэтаж", "Срочные"];

interface FeedScreenProps {
  onOpenJob: (job: Job) => void;
}

const FeedScreen = ({ onOpenJob }: FeedScreenProps) => {
  const [activeFilter, setActiveFilter] = useState("Все");

  const filtered = activeFilter === "Все"
    ? mockJobs
    : activeFilter === "Срочные"
    ? mockJobs.filter((j) => j.urgent)
    : activeFilter === "Погрузка"
    ? mockJobs.filter((j) => j.type === "Погрузка/Разгрузка")
    : mockJobs.filter((j) => j.type === activeFilter);

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <Menu size={18} className="text-muted-foreground" />
        </button>
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center active:neu-inset transition-all">
          <Search size={18} className="text-muted-foreground" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-5">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Заявки</h1>
        <p className="text-sm text-muted-foreground mt-1">({mockJobs.length} доступных)</p>
      </div>

      {/* Filters - neumorphic pills */}
      <div className="px-5 pb-5 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeFilter === f
                  ? "gradient-primary text-primary-foreground"
                  : "neu-raised-sm text-muted-foreground active:neu-inset"
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
              className="neu-card rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    {job.urgent && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-destructive/20 text-destructive text-[11px] font-semibold">
                        <Zap size={10} /> Срочно
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground neu-raised-sm px-2 py-0.5 rounded-lg">
                      {job.type}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-foreground leading-tight">{job.title}</h3>
                </div>
                <div className="w-8 h-8 rounded-xl neu-raised-sm flex items-center justify-center ml-2 flex-shrink-0">
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{job.description}</p>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
                <span className="flex items-center gap-1"><MapPin size={11} /> {job.distance}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {job.date}</span>
                <span className="flex items-center gap-1"><Users size={11} /> {job.workersNeeded} чел.</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold text-gradient-primary">{job.price.toLocaleString("ru-RU")} ₽</span>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="gradient-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                >
                  Откликнуться
                </button>
              </div>

              {job.responses > 0 && (
                <p className="text-[11px] text-muted-foreground mt-2.5">
                  👥 {job.responses} откликов
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
