import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield } from "lucide-react";

const skills = ["Переезды", "Такелаж", "Сборка мебели", "Погрузка/Разгрузка", "Межэтаж"];

const ProfileScreen = () => {
  return (
    <div className="pb-24">
      <div className="px-5 pt-12 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full gradient-cyan flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-soft">
            ИС
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Иван Смирнов</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-semibold text-foreground">4.9</span>
              <span className="text-xs text-muted-foreground ml-1">· 156 отзывов</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Shield size={12} className="text-primary" />
              <span className="text-xs text-primary font-medium">Верифицирован</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Briefcase, label: "Заказов", value: "234" },
            { icon: Wallet, label: "За месяц", value: "87 500 ₽" },
            { icon: Calendar, label: "Стаж", value: "2 года" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-2xl p-3 shadow-card text-center"
            >
              <stat.icon size={18} className="text-primary mx-auto mb-1.5" />
              <p className="text-base font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Навыки</h2>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span key={skill} className="px-3 py-1.5 rounded-xl bg-surface-3 text-xs font-medium text-muted-foreground">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Доступность на неделю</h2>
        <div className="grid grid-cols-7 gap-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => {
            const available = [0, 1, 2, 4, 5].includes(i);
            return (
              <div
                key={day}
                className={`py-2 rounded-xl text-center text-xs font-medium ${
                  available ? "gradient-cyan text-primary-foreground" : "bg-surface-3 text-muted-foreground"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Menu */}
      <div className="px-5 space-y-1">
        {[
          { label: "Настройки", icon: Settings },
          { label: "Выйти", icon: LogOut },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-3/50 transition-colors"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="text-sm text-foreground flex-1 text-left">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfileScreen;
