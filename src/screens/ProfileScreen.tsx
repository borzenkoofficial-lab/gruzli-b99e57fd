import { motion } from "framer-motion";
import { Star, Briefcase, Wallet, Calendar, ChevronRight, Settings, LogOut, Shield, Menu, Bell } from "lucide-react";

const skills = ["Переезды", "Такелаж", "Сборка мебели", "Погрузка", "Межэтаж"];

const ProfileScreen = () => {
  return (
    <div className="pb-28">
      {/* Header */}
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Menu size={18} className="text-muted-foreground" />
        </button>
        <button className="w-11 h-11 rounded-2xl neu-raised flex items-center justify-center">
          <Bell size={18} className="text-muted-foreground" />
        </button>
      </div>

      <div className="px-5 pt-6 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground" style={{ boxShadow: '6px 6px 14px hsl(228 22% 6%), -4px -4px 10px hsl(228 18% 20%), 0 4px 20px hsl(230 60% 58% / 0.35)' }}>
            ИС
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Иван Смирнов</h1>
            <div className="flex items-center gap-1 mt-1">
              <Star size={14} className="text-primary fill-primary" />
              <span className="text-sm font-bold text-foreground">4.9</span>
              <span className="text-xs text-muted-foreground ml-1">· 156 отзывов</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Shield size={12} className="text-online" />
              <span className="text-xs text-online font-semibold">Верифицирован</span>
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
              className="neu-card rounded-2xl p-3 text-center"
            >
              <stat.icon size={18} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-bold text-foreground mb-3">Навыки</h2>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span key={skill} className="px-3 py-2 rounded-xl neu-raised-sm text-xs font-medium text-muted-foreground">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="px-5 pb-5">
        <h2 className="text-sm font-bold text-foreground mb-3">Доступность</h2>
        <div className="grid grid-cols-7 gap-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => {
            const available = [0, 1, 2, 4, 5].includes(i);
            return (
              <div
                key={day}
                className={`py-2.5 rounded-xl text-center text-xs font-semibold transition-all ${
                  available ? "gradient-primary text-primary-foreground" : "neu-raised-sm text-muted-foreground"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Menu */}
      <div className="px-5 space-y-2">
        {[
          { label: "Настройки", icon: Settings },
          { label: "Выйти", icon: LogOut },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl neu-flat active:neu-inset transition-all"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground flex-1 text-left">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfileScreen;
